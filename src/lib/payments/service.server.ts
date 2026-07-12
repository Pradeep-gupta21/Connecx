// PaymentService: server-only orchestration layer built on Supabase + Razorpay.
// All mutations funnel through here so business logic + audit + notifications
// stay in one place.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { razorpay } from "./razorpay.server";
import { sendPushNotification } from "@/lib/push.server";
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentStatus,
  WalletSnapshot,
  WalletTxnType,
  FeeBreakdown,
} from "./types";

// Loose-typed alias: generated Supabase types lag new payment columns/enums.
// Writes are validated by zod at the RPC boundary and RLS on the DB side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin: any = supabaseAdmin;

function toMinor(amount: number): number {
  return Math.round(amount * 100);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Fee breakdown for a campaign budget.
 *  subtotal              = negotiated creator amount (== creator_earnings)
 *  platform_fee          = subtotal * feePct/100     (marketplace commission)
 *  gst                   = (subtotal + fee) * gstPct/100
 *  total_payable         = subtotal + platform_fee + gst   (what advertiser pays)
 */
export function computeBreakdown(
  budget: number,
  platformFeePct = 10,
  gstPct = 18,
): FeeBreakdown {
  const subtotal = round2(budget);
  const platform_fee = round2(subtotal * (platformFeePct / 100));
  const gst = round2((subtotal + platform_fee) * (gstPct / 100));
  const total_payable = round2(subtotal + platform_fee + gst);
  return {
    subtotal,
    platform_fee,
    gst,
    creator_earnings: subtotal,
    total_payable,
    platform_fee_pct: platformFeePct,
    gst_pct: gstPct,
    currency: "INR",
  };
}

// -------------------- primitives --------------------

async function log(args: {
  paymentId: string;
  actorId?: string | null;
  action: string;
  from?: PaymentStatus | null;
  to?: PaymentStatus | null;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  await admin.from("payment_logs").insert({
    payment_id: args.paymentId,
    actor_id: args.actorId ?? null,
    action: args.action,
    from_status: args.from ?? null,
    to_status: args.to ?? null,
    message: args.message ?? null,
    metadata: args.metadata ?? {},
  });
}

async function audit(args: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await admin.from("activity_logs").insert({
    user_id: args.actorId ?? null,
    action: args.action,
    entity_type: args.entityType,
    entity_id: args.entityId,
    metadata: args.metadata ?? {},
  });
}

async function notify(args: {
  userId: string | null | undefined;
  type: string;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
}) {
  if (!args.userId) return;
  await admin.from("notifications").insert({
    user_id: args.userId,
    type: args.type,
    title: args.title,
    body: args.body ?? null,
    payload: args.payload ?? {},
  });

  // Send OS-level push notification for background/closed-tab alerts
  try {
    await sendPushNotification(args.userId, args.title, args.body ?? "", args.payload);
  } catch (err) {
    console.error("Failed to send background push notification:", err);
  }
}

async function applyWalletTxn(args: {
  userId: string;
  type: WalletTxnType;
  amount: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await admin.rpc("apply_wallet_txn", {
    _user_id: args.userId,
    _type: args.type,
    _amount: args.amount,
    _reference_type: args.referenceType ?? null,
    _reference_id: args.referenceId ?? null,
    _description: args.description ?? null,
    _metadata: args.metadata ?? {},
  });
  if (error) throw new Error(`Wallet mutation failed: ${error.message}`);
}

// -------------------- Double-entry ledger --------------------
// Chart of accounts. User accounts are namespaced by uuid so per-user
// balances can be reconstructed by SUM(credits) - SUM(debits) on the account.
export const ACCT = {
  platformCash: "platform:cash",           // funds in Razorpay/bank
  platformEscrow: "platform:escrow",       // held liability
  platformFees: "platform:revenue:fees",   // marketplace commission
  platformGst: "platform:revenue:gst",     // tax collected
  platformPayoutsPending: "platform:payouts_pending",
  userWallet: (uid: string) => `user:${uid}:wallet`,
} as const;

async function postLedger(args: {
  event: string;
  amount: number;
  currency?: string;
  debit: string;
  credit: string;
  debitUser?: string | null;
  creditUser?: string | null;
  paymentId?: string | null;
  contractId?: string | null;
  campaignId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  actorId?: string | null;
}): Promise<string | null> {
  if (!Number.isFinite(args.amount) || args.amount <= 0) return null;
  const { data, error } = await admin.rpc("post_ledger_entry", {
    _event_type: args.event,
    _amount: args.amount,
    _currency: args.currency ?? "INR",
    _debit_account: args.debit,
    _credit_account: args.credit,
    _debit_user: args.debitUser ?? null,
    _credit_user: args.creditUser ?? null,
    _payment_id: args.paymentId ?? null,
    _contract_id: args.contractId ?? null,
    _campaign_id: args.campaignId ?? null,
    _description: args.description ?? null,
    _metadata: args.metadata ?? {},
    _idempotency_key: args.idempotencyKey,
    _created_by: args.actorId ?? null,
  });
  if (error) {
    console.error("[ledger] post failed", args.event, args.idempotencyKey, error.message);
    return null;
  }
  return (data as string) ?? null;
}

async function nextReceipt(): Promise<string> {
  const { data } = await admin.rpc("next_receipt_number");
  return (data as string) ?? `RCPT-${Date.now()}`;
}
async function nextInvoice(): Promise<string> {
  const { data } = await admin.rpc("next_invoice_number");
  return (data as string) ?? `INV-${Date.now()}`;
}

// -------------------- public API --------------------

export const PaymentService = {
  computeBreakdown,

  // -------- Campaign funding (Advertiser) --------

  async createCampaignOrder(input: {
    campaignId: string;
    payerId: string;
  }): Promise<CreateOrderResult & { breakdown: FeeBreakdown }> {
    const { data: c, error } = await admin
      .from("campaigns")
      .select("id, advertiser_id, title, budget_max, budget_min, platform_fee_pct, gst_pct, funded, status, deleted_at")
      .eq("id", input.campaignId)
      .single();
    if (error || !c) throw new Error("Campaign not found");
    if (c.deleted_at) throw new Error("Campaign has been deleted");
    if (c.advertiser_id !== input.payerId) throw new Error("Only the campaign owner can fund it");
    if (c.funded) throw new Error("Campaign is already funded");
    if (c.status && !["draft", "open", "published", "receiving_pitches"].includes(c.status as string)) {
      throw new Error(`Cannot fund a ${c.status} campaign`);
    }

    const budget = Number(c.budget_max ?? c.budget_min ?? 0);
    if (!budget || budget <= 0) throw new Error("Set a campaign budget before funding");
    const breakdown = computeBreakdown(
      budget,
      Number(c.platform_fee_pct ?? 10),
      Number(c.gst_pct ?? 18),
    );

    const receipt = await nextReceipt();
    const invoice = await nextInvoice();

    // Reserve payment row. payee_id = advertiser (self) until a creator is
    // accepted; we retarget the payee when the contract is created.
    const { data: pay, error: pErr } = await admin
      .from("payments")
      .insert({
        amount: breakdown.total_payable,
        gross_amount: breakdown.subtotal,
        platform_fee: breakdown.platform_fee,
        gst: breakdown.gst,
        creator_earnings: breakdown.creator_earnings,
        currency: "INR",
        status: "pending",
        status_v2: "pending",
        type: "campaign_payment",
        provider: "razorpay",
        payer_id: input.payerId,
        payee_id: input.payerId, // provisional
        campaign_id: c.id,
        receipt_number: receipt,
        invoice_number: invoice,
        notes: { title: c.title, kind: "campaign_funding" },
      } as any)
      .select("id")
      .single();
    if (pErr || !pay) throw new Error(`Failed to create payment: ${pErr?.message}`);

    const order = await razorpay.createOrder({
      amountMinor: toMinor(breakdown.total_payable),
      currency: "INR",
      receipt,
      notes: {
        payment_id: pay.id,
        campaign_id: c.id,
        payer_id: input.payerId,
        kind: "campaign_funding",
      },
    });

    await admin.from("payments").update({ razorpay_order_id: order.id }).eq("id", pay.id);

    await log({
      paymentId: pay.id,
      actorId: input.payerId,
      action: "order.created",
      to: "pending",
      metadata: { razorpay_order_id: order.id, breakdown },
    });
    await audit({
      actorId: input.payerId,
      action: "campaign.fund.initiated",
      entityType: "campaign",
      entityId: c.id,
      metadata: { payment_id: pay.id, amount: breakdown.total_payable },
    });

    return {
      orderId: order.id,
      paymentId: pay.id,
      amount: toMinor(breakdown.total_payable),
      currency: "INR",
      keyId: razorpay.publicKeyId(),
      mode: razorpay.mode(),
      breakdown,
    };
  },

  async createContractPaymentOrder(input: {
    contractId: string;
    payerId: string;
  }): Promise<CreateOrderResult & { breakdown: FeeBreakdown }> {
    console.log("[PaymentService.createContractPaymentOrder] called with input:", input);
    const { data: contract, error: cErr } = await admin
      .from("contracts")
      .select("id, advertiser_id, creator_id, campaign_id, title, amount, currency, application_id")
      .eq("id", input.contractId)
      .single();
    if (cErr || !contract) {
      console.error("[PaymentService.createContractPaymentOrder] Contract not found in DB. Error:", cErr, "contractId:", input.contractId);
      throw new Error("Contract not found");
    }
    console.log("[PaymentService.createContractPaymentOrder] Contract found:", contract);
    if (contract.advertiser_id !== input.payerId) throw new Error("Only the contract advertiser can fund it");

    const { data: c, error } = await admin
      .from("campaigns")
      .select("id, platform_fee_pct, gst_pct, title")
      .eq("id", contract.campaign_id)
      .single();
    if (error || !c) throw new Error("Campaign not found");

    const budget = Number(contract.amount);
    if (!budget || budget <= 0) throw new Error("Contract amount must be greater than zero");

    const breakdown = computeBreakdown(
      budget,
      Number(c.platform_fee_pct ?? 10),
      Number(c.gst_pct ?? 18),
    );

    const receipt = await nextReceipt();
    const invoice = await nextInvoice();

    // Create payment record mapped to the contract
    const { data: pay, error: pErr } = await admin
      .from("payments")
      .insert({
        amount: breakdown.total_payable,
        gross_amount: breakdown.subtotal,
        platform_fee: breakdown.platform_fee,
        gst: breakdown.gst,
        creator_earnings: breakdown.creator_earnings,
        currency: "INR",
        status: "pending",
        status_v2: "pending",
        type: "campaign_payment",
        provider: "razorpay",
        payer_id: contract.advertiser_id,
        payee_id: contract.creator_id,
        advertiser_id: contract.advertiser_id,
        creator_id: contract.creator_id,
        campaign_id: contract.campaign_id,
        contract_id: contract.id,
        pitch_id: contract.application_id,
        receipt_number: receipt,
        invoice_number: invoice,
        notes: { title: c.title, kind: "contract_payment" },
      } as any)
      .select("id")
      .single();
    if (pErr || !pay) throw new Error(`Failed to create payment: ${pErr?.message}`);

    const order = await razorpay.createOrder({
      amountMinor: toMinor(breakdown.total_payable),
      currency: "INR",
      receipt,
      notes: {
        payment_id: pay.id,
        campaign_id: c.id,
        contract_id: contract.id,
        payer_id: input.payerId,
        kind: "contract_payment",
      },
    });

    await admin.from("payments").update({ razorpay_order_id: order.id }).eq("id", pay.id);

    await log({
      paymentId: pay.id,
      actorId: input.payerId,
      action: "order.created",
      to: "pending",
      metadata: { razorpay_order_id: order.id, breakdown },
    });
    await audit({
      actorId: input.payerId,
      action: "payment_secured_initiated",
      entityType: "campaign",
      entityId: c.id,
      metadata: { payment_id: pay.id, amount: breakdown.total_payable },
    });

    // Also associate payment with the contract
    await admin.from("contracts").update({ payment_id: pay.id }).eq("id", contract.id);

    return {
      orderId: order.id,
      paymentId: pay.id,
      amount: toMinor(breakdown.total_payable),
      currency: "INR",
      keyId: razorpay.publicKeyId(),
      mode: razorpay.mode(),
      breakdown,
    };
  },

  // Generic order (kept for compatibility)
  async createOrder(input: CreateOrderInput, payerId: string): Promise<CreateOrderResult> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Invalid amount");
    const currency = input.currency ?? "INR";
    const { data: pay, error } = await admin
      .from("payments")
      .insert({
        amount: input.amount,
        currency,
        status: "pending",
        status_v2: "pending",
        type: "campaign_payment",
        provider: "razorpay",
        payer_id: payerId,
        payee_id: input.payeeId,
        contract_id: input.contractId ?? null,
        campaign_id: input.campaignId ?? null,
        notes: input.notes ?? {},
      })
      .select("id")
      .single();
    if (error || !pay) throw new Error(`Failed to create payment: ${error?.message}`);
    const order = await razorpay.createOrder({
      amountMinor: toMinor(input.amount),
      currency,
      receipt: pay.id,
      notes: { ...(input.notes ?? {}), payment_id: pay.id },
    });
    await admin.from("payments").update({ razorpay_order_id: order.id }).eq("id", pay.id);
    await log({ paymentId: pay.id, actorId: payerId, action: "order.created", to: "pending" });
    return {
      orderId: order.id,
      paymentId: pay.id,
      amount: toMinor(input.amount),
      currency,
      keyId: razorpay.publicKeyId(),
      mode: razorpay.mode(),
    };

  },

  // -------- Verify & mark as HELD (client callback) --------

  async verifyAndCapture(input: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    actorId: string;
  }) {
    if (!razorpay.verifyCheckoutSignature({
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    })) {
      throw new Error("Invalid Razorpay signature");
    }

    const { data: pay, error } = await admin
      .from("payments")
      .select("id, status_v2")
      .eq("razorpay_order_id", input.razorpay_order_id)
      .single();
    if (error || !pay) throw new Error("Payment order not found");

    // Persist signature for auditability (won't change once set)
    await admin.from("payments")
      .update({ razorpay_signature: input.razorpay_signature })
      .eq("id", pay.id);

    return this.finalizeCapture({
      paymentId: pay.id,
      razorpayPaymentId: input.razorpay_payment_id,
      actorId: input.actorId,
      source: "client",
    });
  },

  /**
   * Idempotent "mark payment as HELD" side-effects. Called from BOTH the
   * client verifyAndCapture flow and the razorpay webhook safety net so
   * campaigns activate even if the browser never round-trips back.
   *
   * Concurrency-safe via a compare-and-swap on status_v2 IN ('pending','failed').
   * postLedger uses per-payment idempotency keys, so a duplicate call is a no-op.
   */
  async finalizeCapture(input: {
    paymentId: string;
    razorpayPaymentId: string;
    actorId?: string | null;
    fee?: number;   // in major units (rupees), from webhook
    tax?: number;
    source: "client" | "webhook";
  }): Promise<{ paymentId: string; status: PaymentStatus }> {
    const { data: pay, error } = await admin
      .from("payments")
      .select("id, amount, currency, payer_id, payee_id, campaign_id, status_v2, type, platform_fee, gst, creator_earnings, contract_id")
      .eq("id", input.paymentId)
      .single();
    if (error || !pay) throw new Error("Payment not found");
    if (pay.status_v2 && !["pending", "failed"].includes(pay.status_v2)) {
      // Already finalized — still safely record razorpay_payment_id + fee/tax.
      await admin.from("payments").update({
        razorpay_payment_id: input.razorpayPaymentId,
        ...(input.fee !== undefined ? { fee: input.fee } : {}),
        ...(input.tax !== undefined ? { tax: input.tax } : {}),
      }).eq("id", pay.id);
      return { paymentId: pay.id, status: pay.status_v2 as PaymentStatus };
    }

    // CAS flip pending → held. Losing racer sees rowCount 0 and returns.
    const { data: flipped } = await admin.from("payments")
      .update({
        status: "held",
        status_v2: "held",
        razorpay_payment_id: input.razorpayPaymentId,
        ...(input.fee !== undefined ? { fee: input.fee } : {}),
        ...(input.tax !== undefined ? { tax: input.tax } : {}),
        processed_at: new Date().toISOString(),
      })
      .eq("id", pay.id)
      .in("status_v2", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!flipped) {
      return { paymentId: pay.id, status: "held" as PaymentStatus };
    }

    // Mark campaign as payment secured
    if (pay.campaign_id) {
      await admin.from("campaigns")
        .update({
          funded: true,
          funded_amount: Number(pay.amount),
          funded_at: new Date().toISOString(),
          funded_payment_id: pay.id,
          status: "payment_secured",
        })
        .eq("id", pay.campaign_id);
    }

    const currency = (pay.currency as string) ?? "INR";
    const creatorAmt = Number(pay.creator_earnings ?? pay.amount ?? 0);
    const feeAmt = Number(pay.platform_fee ?? 0);
    const gstAmt = Number(pay.gst ?? 0);

    // Set contract status to active (in progress)
    if (pay.contract_id) {
      await admin.from("contracts")
        .update({
          status: "active",
          payment_id: pay.id,
        })
        .eq("id", pay.contract_id);
    }

    // Hold creator earnings in pending_balance
    if (creatorAmt > 0 && pay.payee_id) {
      await applyWalletTxn({
        userId: pay.payee_id,
        type: "hold",
        amount: creatorAmt,
        referenceType: "payment",
        referenceId: pay.id,
        description: `Funds secured for campaign payment`,
      });
    }

    // Log to payment_events
    await admin.from("payment_events").insert({
      campaign_id: pay.campaign_id,
      pitch_id: pay.pitch_id,
      user_id: pay.payer_id,
      event_type: "payment_completed",
      metadata: { payment_id: pay.id, amount: pay.amount },
    } as any);

    // Double-entry ledger: cash in → escrow liability + fee + gst revenue.
    // Idempotent per payment id — safe if webhook + client both fire.
    if (creatorAmt > 0) {
      await postLedger({
        event: "campaign.funded.escrow",
        amount: creatorAmt, currency,
        debit: ACCT.platformCash, credit: ACCT.platformEscrow,
        debitUser: pay.payer_id, creditUser: pay.payee_id,
        paymentId: pay.id, contractId: pay.contract_id, campaignId: pay.campaign_id,
        description: "Escrow hold from campaign funding",
        idempotencyKey: `pay:${pay.id}:escrow`,
        actorId: input.actorId,
      });
    }
    if (feeAmt > 0) {
      await postLedger({
        event: "campaign.funded.fee",
        amount: feeAmt, currency,
        debit: ACCT.platformCash, credit: ACCT.platformFees,
        debitUser: pay.payer_id, creditUser: null,
        paymentId: pay.id, campaignId: pay.campaign_id,
        description: "Platform commission",
        idempotencyKey: `pay:${pay.id}:fee`,
        actorId: input.actorId,
      });
    }
    if (gstAmt > 0) {
      await postLedger({
        event: "campaign.funded.gst",
        amount: gstAmt, currency,
        debit: ACCT.platformCash, credit: ACCT.platformGst,
        debitUser: pay.payer_id, creditUser: null,
        paymentId: pay.id, campaignId: pay.campaign_id,
        description: "GST collected",
        idempotencyKey: `pay:${pay.id}:gst`,
        actorId: input.actorId,
      });
    }

    await log({
      paymentId: pay.id,
      actorId: input.actorId,
      action: `payment.captured.${input.source}`,
      from: "pending",
      to: "held",
      metadata: { razorpay_payment_id: input.razorpayPaymentId },
    });
    await audit({
      actorId: input.actorId,
      action: "payment.captured",
      entityType: "payment",
      entityId: pay.id,
      metadata: { campaign_id: pay.campaign_id, source: input.source },
    });

    await notify({
      userId: pay.payer_id,
      type: "payment_success",
      title: "Payment successful",
      body: `Your campaign is funded. Ref ${input.razorpayPaymentId}.`,
      payload: { payment_id: pay.id, campaign_id: pay.campaign_id },
    });
    if (pay.campaign_id) {
      await notify({
        userId: pay.payer_id,
        type: "campaign_funded",
        title: "Campaign is live",
        body: "Creators can now apply. You'll get pitches shortly.",
        payload: { campaign_id: pay.campaign_id, payment_id: pay.id },
      });
    }

    return { paymentId: pay.id, status: "held" as PaymentStatus };
  },

  // -------- Accept creator: build contract, retarget payee --------

  async acceptCreator(args: {
    campaignId: string;
    applicationId: string;
    creatorId: string;
    actorId: string;
  }) {
    console.log("[PaymentService.acceptCreator] called with:", args);
    const { data: c, error } = await admin
      .from("campaigns")
      .select("id, advertiser_id, title")
      .eq("id", args.campaignId)
      .single();
    if (error || !c) {
      console.error("[PaymentService.acceptCreator] Campaign not found in DB. Error:", error, "campaignId:", args.campaignId);
      throw new Error("Campaign not found");
    }
    console.log("[PaymentService.acceptCreator] Campaign found:", c);
    if (c.advertiser_id !== args.actorId) throw new Error("Only the campaign owner can accept creators");

    // Get the accepted pitch price
    const { data: pitch, error: pErr } = await admin
      .from("campaign_pitches")
      .select("id, quoted_price, final_price")
      .eq("id", args.applicationId)
      .single();
    if (pErr || !pitch) throw new Error("Pitch not found");

    const contractAmount = Number(pitch.final_price ?? pitch.quoted_price ?? 0);

    // 1. Mark this pitch as accepted
    await admin.from("campaign_pitches").update({ status: "accepted" })
      .eq("id", args.applicationId);

    // 2. Reject all other active pitches for this campaign
    await admin.from("campaign_pitches")
      .update({ status: "rejected" })
      .eq("campaign_id", args.campaignId)
      .neq("id", args.applicationId)
      .in("status", ["submitted", "under_review", "negotiating"]);

    // 3. Update campaign status to 'creator_selected'
    await admin.from("campaigns").update({ status: "creator_selected" }).eq("id", args.campaignId);

    // 4. Create contract in draft state
    const { data: existing } = await admin
      .from("contracts")
      .select("id")
      .eq("campaign_id", c.id)
      .eq("creator_id", args.creatorId)
      .maybeSingle();

    let contractId = existing?.id as string | undefined;
    if (!contractId) {
      const { data: inserted, error: cErr } = await admin
        .from("contracts")
        .insert({
          campaign_id: c.id,
          advertiser_id: c.advertiser_id,
          creator_id: args.creatorId,
          application_id: args.applicationId,
          title: c.title,
          amount: contractAmount,
          currency: "INR",
          status: "draft",
        })
        .select("id")
        .single();
      if (cErr || !inserted) throw new Error(`Contract creation failed: ${cErr?.message}`);
      contractId = inserted.id;
    } else {
      await admin.from("contracts").update({ status: "draft", amount: contractAmount }).eq("id", contractId);
    }

    // 5. Log payment event
    await admin.from("payment_events").insert({
      campaign_id: c.id,
      pitch_id: args.applicationId,
      user_id: args.actorId,
      event_type: "creator_approved",
      metadata: { creator_id: args.creatorId, amount: contractAmount },
    } as any);

    await audit({
      actorId: args.actorId,
      action: "creator.accepted",
      entityType: "contract",
      entityId: contractId!,
      metadata: { campaign_id: c.id, creator_id: args.creatorId },
    });

    await notify({
      userId: args.creatorId,
      type: "creator_accepted",
      title: `You're in — ${c.title}`,
      body: "The advertiser accepted your pitch. Upload deliverables when ready.",
      payload: { campaign_id: c.id, contract_id: contractId },
    });

    return { contractId: contractId! };
  },

  // -------- Deliverables (Creator) --------

  async submitDeliverables(args: {
    contractId: string;
    creatorId: string;
    urls: { name: string; url: string }[];
    notes?: string;
  }) {
    const { data: contract, error } = await admin
      .from("contracts")
      .select("id, creator_id, advertiser_id, campaign_id, title, status")
      .eq("id", args.contractId)
      .single();
    if (error || !contract) throw new Error("Contract not found");
    if (contract.creator_id !== args.creatorId) throw new Error("Not your contract");

    await admin.from("contracts").update({
      deliverable_urls: args.urls,
      submission_notes: args.notes ?? null,
      submitted_at: new Date().toISOString(),
      status: "submitted",
    }).eq("id", args.contractId);

    await audit({
      actorId: args.creatorId,
      action: "deliverables.submitted",
      entityType: "contract",
      entityId: args.contractId,
      metadata: { count: args.urls.length },
    });
    await notify({
      userId: contract.advertiser_id,
      type: "deliverables_uploaded",
      title: `Deliverables uploaded — ${contract.title}`,
      body: `${args.urls.length} file(s) ready for review.`,
      payload: { contract_id: args.contractId, campaign_id: contract.campaign_id },
    });
  },

  async requestRevision(args: {
    contractId: string;
    actorId: string;
    notes: string;
  }) {
    const { data: contract, error } = await admin
      .from("contracts")
      .select("id, advertiser_id, creator_id, campaign_id, title, revision_count")
      .eq("id", args.contractId)
      .single();
    if (error || !contract) throw new Error("Contract not found");
    if (contract.advertiser_id !== args.actorId) throw new Error("Only the advertiser can request revisions");

    await admin.from("contracts").update({
      status: "revision_requested",
      revision_notes: args.notes,
      revision_count: (contract.revision_count ?? 0) + 1,
      reviewed_at: new Date().toISOString(),
    }).eq("id", args.contractId);

    // Also mark linked payment as revision_requested for a global signal
    const { data: pay } = await admin
      .from("contracts")
      .select("payment_id")
      .eq("id", args.contractId)
      .single();
    if (pay?.payment_id) {
      await admin.from("payments")
        .update({ status: "processing", status_v2: "revision_requested" })
        .eq("id", pay.payment_id);
      await log({
        paymentId: pay.payment_id,
        actorId: args.actorId,
        action: "payment.revision_requested",
        to: "revision_requested",
      });
    }

    await audit({
      actorId: args.actorId,
      action: "deliverables.revision_requested",
      entityType: "contract",
      entityId: args.contractId,
      metadata: { notes: args.notes },
    });
    await notify({
      userId: contract.creator_id,
      type: "revision_requested",
      title: `Revision requested — ${contract.title}`,
      body: args.notes.slice(0, 160),
      payload: { contract_id: args.contractId, campaign_id: contract.campaign_id },
    });
  },

  async approveDeliverables(args: { contractId: string; actorId: string }) {
    const { data: contract, error } = await admin
      .from("contracts")
      .select("id, advertiser_id, creator_id, campaign_id, title, payment_id, application_id")
      .eq("id", args.contractId)
      .single();
    if (error || !contract) throw new Error("Contract not found");
    if (contract.advertiser_id !== args.actorId) throw new Error("Only the advertiser can approve");
    if (!contract.payment_id) throw new Error("Contract has no linked payment — cannot approve work");

    await admin.from("contracts").update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    }).eq("id", args.contractId);

    if (contract.campaign_id) {
      await admin.from("campaigns").update({
        status: "under_review",
      }).eq("id", contract.campaign_id);
    }

    await admin.from("payment_events").insert({
      campaign_id: contract.campaign_id,
      pitch_id: contract.application_id,
      user_id: args.actorId,
      event_type: "work_approved",
      metadata: { contract_id: contract.id },
    } as any);

    await audit({
      actorId: args.actorId,
      action: "deliverables.approved",
      entityType: "contract",
      entityId: args.contractId,
    });

    await notify({
      userId: contract.creator_id,
      type: "system",
      title: "Deliverables Approved",
      body: `Your work for "${contract.title}" has been approved! The admin will release the secured funds shortly.`,
      payload: { contract_id: contract.id, campaign_id: contract.campaign_id },
    });
  },

  // -------- Release (HELD → RELEASED, credit creator wallet) --------

  async releasePayment(paymentId: string, actorId: string) {
    const { data: pay, error } = await admin
      .from("payments")
      .select("id, amount, creator_earnings, payee_id, payer_id, campaign_id, contract_id, pitch_id, status_v2")
      .eq("id", paymentId)
      .single();
    if (error || !pay) throw new Error("Payment not found");
    if (!pay.status_v2) throw new Error("Payment has no captured status — cannot release");
    if (!["held", "revision_requested"].includes(pay.status_v2)) {
      throw new Error(`Cannot release from ${pay.status_v2}`);
    }

    await admin.from("payments")
      .update({ status: "succeeded", status_v2: "released", released_at: new Date().toISOString() })
      .eq("id", paymentId);

    const releaseAmt = Number(pay.creator_earnings ?? pay.amount ?? 0);
    await applyWalletTxn({
      userId: pay.payee_id,
      type: "release",
      amount: releaseAmt,
      referenceType: "payment",
      referenceId: pay.id,
      description: "Funds released to available balance",
    });

    // Ledger: escrow liability → creator wallet
    await postLedger({
      event: "escrow.released",
      amount: releaseAmt, currency: "INR",
      debit: ACCT.platformEscrow, credit: ACCT.userWallet(pay.payee_id),
      debitUser: pay.payer_id, creditUser: pay.payee_id,
      paymentId: pay.id, campaignId: pay.campaign_id,
      description: "Escrow released to creator",
      idempotencyKey: `pay:${pay.id}:release`,
      actorId,
    });

    // Update contract status to completed
    if (pay.contract_id) {
      await admin.from("contracts").update({ status: "completed" }).eq("id", pay.contract_id);
    }

    // Update campaign status to completed
    if (pay.campaign_id) {
      await admin.from("campaigns").update({ status: "completed" }).eq("id", pay.campaign_id);
    }

    // Log to payment_events
    await admin.from("payment_events").insert({
      campaign_id: pay.campaign_id,
      pitch_id: pay.pitch_id,
      user_id: actorId,
      event_type: "funds_released",
      metadata: { payment_id: paymentId, amount: releaseAmt },
    } as any);

    await log({ paymentId, actorId, action: "payment.released", from: "held", to: "released" });
    await audit({ actorId, action: "payment.released", entityType: "payment", entityId: paymentId });

    await notify({
      userId: pay.payee_id,
      type: "payment_released",
      title: "Earnings approved 🎉",
      body: `₹${releaseAmt.toLocaleString("en-IN")} is now eligible for payout.`,
      payload: { payment_id: paymentId, campaign_id: pay.campaign_id },
    });
    await notify({
      userId: pay.payer_id,
      type: "payment_released",
      title: "Deliverables approved",
      body: `Creator earnings for payment ${paymentId.slice(0, 8)} are now eligible for payout.`,
      payload: { payment_id: paymentId },
    });
  },

  // -------- Refunds — approval workflow --------
  //
  // State machine:
  //   REQUESTED  → user files, admin reviews
  //   APPROVED   → admin approved (short-lived; immediately calls Razorpay)
  //   PROCESSING → Razorpay accepted the refund; awaiting refund.processed webhook
  //   COMPLETED  → funds returned + escrow / wallet reversed
  //   REJECTED   → admin denied; requester notified
  //   FAILED     → Razorpay / internal error
  //
  // Duplicate protection: a partial unique index on refunds(payment_id) WHERE
  // status IN (requested/approved/processing/pending) prevents concurrent
  // filings against the same payment. Admin approve/reject use compare-and-swap
  // on status='requested' so only one admin action wins.

  async createRefund(args: {
    paymentId: string;
    amount?: number;
    reason?: string;
    actorId: string;
  }) {
    const { data: pay, error } = await admin
      .from("payments")
      .select("id, amount, creator_earnings, currency, payer_id, payee_id, campaign_id, razorpay_payment_id, status_v2")
      .eq("id", args.paymentId)
      .single();
    if (error || !pay) throw new Error("Payment not found");
    if (!pay.razorpay_payment_id) throw new Error("Nothing to refund — payment not captured");
    if (!["held", "revision_requested", "released"].includes(pay.status_v2 ?? "")) {
      throw new Error(`Cannot refund from ${pay.status_v2 ?? "unknown"}`);
    }

    // Cap refund at the creator earnings component. Platform fee + GST are
    // non-refundable revenue; refunding beyond that would leave the ledger
    // and Razorpay refund amount out of sync.
    const refundCap = Number(pay.creator_earnings ?? pay.amount ?? 0);
    const refundAmount = args.amount ?? refundCap;
    if (refundAmount <= 0) throw new Error("Invalid refund amount");
    if (refundAmount > refundCap) {
      throw new Error(
        `Refund cannot exceed the creator earnings portion (₹${refundCap.toLocaleString("en-IN")}). Platform fee and GST are non-refundable.`,
      );
    }

    const { data: refundRow, error: rErr } = await admin
      .from("refunds")
      .insert({
        payment_id: pay.id,
        requested_by: args.actorId,
        amount: refundAmount,
        currency: pay.currency ?? "INR",
        reason: args.reason ?? null,
        status: "requested",
      })
      .select("id")
      .single();
    if (rErr || !refundRow) {
      // 23505 unique_violation → open refund already exists
      if (rErr?.code === "23505") throw new Error("A refund request is already open for this payment");
      throw new Error(`Refund request failed: ${rErr?.message}`);
    }

    await log({
      paymentId: pay.id,
      actorId: args.actorId,
      action: "refund.requested",
      metadata: { refund_id: refundRow.id, amount: refundAmount, reason: args.reason },
    });
    await audit({
      actorId: args.actorId,
      action: "refund.requested",
      entityType: "refund",
      entityId: refundRow.id,
      metadata: { payment_id: pay.id, amount: refundAmount, reason: args.reason },
    });

    // Notify admins & the payment counterparty that a refund is pending review.
    await notify({
      userId: pay.payee_id,
      type: "refund_requested",
      title: "Refund requested",
      body: `A refund of ₹${refundAmount.toLocaleString("en-IN")} is pending admin review.`,
      payload: { payment_id: pay.id, refund_id: refundRow.id },
    });

    return { refundId: refundRow.id, status: "requested" as const };
  },

  async adminApproveRefund(args: { refundId: string; adminId: string; notes?: string }) {
    // Compare-and-swap: only lock a refund that is still 'requested'.
    const { data: locked, error } = await admin
      .from("refunds")
      .update({
        status: "approved",
        reviewed_by: args.adminId,
        reviewed_at: new Date().toISOString(),
        admin_notes: args.notes ?? null,
      })
      .eq("id", args.refundId)
      .eq("status", "requested")
      .select("id, payment_id, amount, currency, reason")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!locked) throw new Error("Refund is no longer pending — another admin may have handled it");

    const { data: pay } = await admin
      .from("payments")
      .select("id, payer_id, payee_id, campaign_id, razorpay_payment_id, status_v2")
      .eq("id", locked.payment_id)
      .single();
    if (!pay || !pay.razorpay_payment_id) {
      await admin.from("refunds").update({
        status: "failed",
        failure_reason: "Payment missing Razorpay reference",
      }).eq("id", locked.id);
      throw new Error("Payment cannot be refunded via Razorpay");
    }

    try {
      const rzp = await razorpay.createRefund({
        paymentId: pay.razorpay_payment_id,
        amountMinor: toMinor(Number(locked.amount)),
        notes: { refund_id: locked.id, reason: locked.reason ?? "" },
      });
      await admin.from("refunds")
        .update({ status: "processing", razorpay_refund_id: rzp.id })
        .eq("id", locked.id);
      await admin.from("payments")
        .update({ status: "processing", status_v2: "refund_pending" })
        .eq("id", pay.id);

      await log({
        paymentId: pay.id, actorId: args.adminId, action: "refund.approved",
        to: "refund_pending",
        metadata: { refund_id: locked.id, razorpay_refund_id: rzp.id },
      });
      await audit({
        actorId: args.adminId, action: "refund.approved",
        entityType: "refund", entityId: locked.id,
        metadata: { payment_id: pay.id, amount: locked.amount },
      });
      await notify({
        userId: pay.payer_id, type: "refund_approved",
        title: "Refund approved",
        body: `Your refund of ₹${Number(locked.amount).toLocaleString("en-IN")} is being processed.`,
        payload: { payment_id: pay.id, refund_id: locked.id },
      });
      return { refundId: locked.id, status: "processing" as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("refunds").update({
        status: "failed",
        failure_reason: msg,
      }).eq("id", locked.id);
      await log({
        paymentId: pay.id, actorId: args.adminId, action: "refund.failed",
        metadata: { refund_id: locked.id, error: msg },
      });
      throw new Error(`Razorpay refund failed: ${msg}`);
    }
  },

  async adminRejectRefund(args: { refundId: string; adminId: string; reason: string }) {
    if (!args.reason || args.reason.trim().length < 3) {
      throw new Error("Rejection reason is required");
    }
    const { data: locked, error } = await admin
      .from("refunds")
      .update({
        status: "rejected",
        reviewed_by: args.adminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: args.reason,
      })
      .eq("id", args.refundId)
      .eq("status", "requested")
      .select("id, payment_id, amount, requested_by")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!locked) throw new Error("Refund is no longer pending — another admin may have handled it");

    await log({
      paymentId: locked.payment_id, actorId: args.adminId,
      action: "refund.rejected",
      metadata: { refund_id: locked.id, reason: args.reason },
    });
    await audit({
      actorId: args.adminId, action: "refund.rejected",
      entityType: "refund", entityId: locked.id,
      metadata: { payment_id: locked.payment_id, reason: args.reason },
    });
    await notify({
      userId: locked.requested_by,
      type: "refund_rejected",
      title: "Refund rejected",
      body: args.reason.slice(0, 200),
      payload: { payment_id: locked.payment_id, refund_id: locked.id },
    });
    return { refundId: locked.id, status: "rejected" as const };
  },

  async markRefundCompleted(args: { refundId: string }) {
    const { data: refund } = await admin
      .from("refunds").select("id, payment_id, amount, status")
      .eq("id", args.refundId).single();
    if (!refund || refund.status === "completed") return;
    await admin.from("refunds")
      .update({ status: "completed", processed_at: new Date().toISOString() })
      .eq("id", refund.id);
    const { data: pay } = await admin
      .from("payments").select("id, payer_id, payee_id, campaign_id, status_v2, creator_earnings, amount, currency")
      .eq("id", refund.payment_id).single();
    if (!pay) return;

    const prevStatus = pay.status_v2 as string | null;
    await admin.from("payments")
      .update({ status: "refunded", status_v2: "refunded" }).eq("id", pay.id);

    const refundAmt = Number(refund.amount);
    const creatorAmt = Number(pay.creator_earnings ?? pay.amount ?? refundAmt);
    const currency = (pay.currency as string) ?? "INR";
    try {
      if (prevStatus === "held" || prevStatus === "revision_requested" || prevStatus === "refund_pending") {
        // Determine reversal source by whether wallet has any held funds
        const unwind = Math.min(creatorAmt, refundAmt);
        await admin.rpc("ensure_wallet", { _user_id: pay.payee_id });
        const { data: wallet } = await admin
          .from("wallets")
          .select("id, held_balance, pending_balance")
          .eq("user_id", pay.payee_id)
          .single();
        if (wallet && Number(wallet.held_balance) > 0) {
          const newHeld = Math.max(Number(wallet.held_balance) - unwind, 0);
          const newPending = Math.max(Number(wallet.pending_balance) - unwind, 0);
          await admin.from("wallets")
            .update({ held_balance: newHeld, pending_balance: newPending })
            .eq("id", wallet.id);
          await admin.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            user_id: pay.payee_id,
            type: "refund",
            amount: unwind,
            balance_after: null,
            reference_type: "refund",
            reference_id: refund.id,
            description: "Held funds returned (refund)",
            metadata: { payment_id: pay.id, from_status: prevStatus },
          });
        }
        // Ledger: escrow liability → cash out
        await postLedger({
          event: "refund.from_escrow",
          amount: refundAmt, currency,
          debit: ACCT.platformEscrow, credit: ACCT.platformCash,
          debitUser: pay.payee_id, creditUser: pay.payer_id,
          paymentId: pay.id, campaignId: pay.campaign_id,
          description: "Refund from escrow to advertiser",
          idempotencyKey: `refund:${refund.id}:escrow`,
        });
      } else if (prevStatus === "released") {
        await applyWalletTxn({
          userId: pay.payee_id,
          type: "refund",
          amount: refundAmt,
          referenceType: "refund",
          referenceId: refund.id,
          description: "Refund clawback from available balance",
        });
        // Ledger: creator wallet → cash out
        await postLedger({
          event: "refund.clawback",
          amount: refundAmt, currency,
          debit: ACCT.userWallet(pay.payee_id), credit: ACCT.platformCash,
          debitUser: pay.payee_id, creditUser: pay.payer_id,
          paymentId: pay.id, campaignId: pay.campaign_id,
          description: "Refund clawback from creator wallet",
          idempotencyKey: `refund:${refund.id}:clawback`,
        });
      }
    } catch (e) {
      console.error("[refund] wallet reversal failed", e);
    }
    await log({ paymentId: pay.id, action: "refund.completed", to: "refunded", metadata: { from_status: prevStatus } });
    await notify({
      userId: pay.payer_id,
      type: "refund_completed",
      title: "Refund completed",
      body: `₹${refundAmt.toLocaleString("en-IN")} refunded to your source account.`,
      payload: { payment_id: pay.id, refund_id: refund.id },
    });
    await notify({
      userId: pay.payee_id,
      type: "refund_completed",
      title: "Refund processed",
      body: `A refund of ₹${refundAmt.toLocaleString("en-IN")} was completed on this payment.`,
      payload: { payment_id: pay.id, refund_id: refund.id },
    });
  },

  /**
   * Razorpay reported the refund as failed. Roll the refund row to 'failed'
   * and restore the payment's status_v2 so it can be retried. Idempotent.
   */
  async markRefundFailed(args: { refundId: string; reason?: string }) {
    const { data: refund } = await admin
      .from("refunds").select("id, payment_id, amount, requested_by, status")
      .eq("id", args.refundId).single();
    if (!refund) return;
    if (refund.status === "failed" || refund.status === "completed") return;

    await admin.from("refunds")
      .update({ status: "failed", failure_reason: args.reason ?? "Razorpay refund failed" })
      .eq("id", refund.id);

    // If the payment was flipped to refund_pending, put it back to held so it
    // can be released or refunded again. Only touch payments still in that state.
    const { data: pay } = await admin
      .from("payments")
      .select("id, status_v2")
      .eq("id", refund.payment_id).single();
    if (pay?.status_v2 === "refund_pending") {
      await admin.from("payments")
        .update({ status: "held", status_v2: "held" })
        .eq("id", pay.id);
      await log({
        paymentId: pay.id, action: "refund.failed",
        from: "refund_pending", to: "held",
        metadata: { refund_id: refund.id, reason: args.reason },
      });
    } else {
      await log({
        paymentId: refund.payment_id, action: "refund.failed",
        metadata: { refund_id: refund.id, reason: args.reason },
      });
    }

    await notify({
      userId: refund.requested_by,
      type: "refund_rejected",
      title: "Refund failed",
      body: args.reason ?? "The payment provider could not process this refund. Please try again or contact support.",
      payload: { payment_id: refund.payment_id, refund_id: refund.id },
    });
  },

  // -------- Withdrawals (Creator → Admin approve → Payout) --------


  async requestWithdrawal(args: {
    userId: string;
    amount: number;
    payoutMethodId: string;
  }) {
    const { MIN_WITHDRAWAL_INR, MAX_WITHDRAWAL_INR } = await import("@/lib/constants");
    if (!Number.isFinite(args.amount) || args.amount <= 0) throw new Error("Invalid amount");
    if (args.amount < MIN_WITHDRAWAL_INR) {
      throw new Error(`Minimum withdrawal is ₹${MIN_WITHDRAWAL_INR.toLocaleString("en-IN")}`);
    }
    if (args.amount > MAX_WITHDRAWAL_INR) {
      throw new Error(`Maximum per-request withdrawal is ₹${MAX_WITHDRAWAL_INR.toLocaleString("en-IN")}`);
    }

    // Verify payout method is owned + verified
    const { data: pm, error: pmErr } = await (admin as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> };
        };
      };
    })
      .from("payout_methods")
      .select(
        "id, user_id, method_type, verification_status, account_holder_name, bank_name, account_number_last4, ifsc, account_type, upi_id",
      )
      .eq("id", args.payoutMethodId)
      .maybeSingle();
    if (pmErr) throw new Error(pmErr.message);
    if (!pm || pm.user_id !== args.userId) throw new Error("Payout method not found");
    if (pm.verification_status !== "verified") {
      throw new Error("Selected payout account is not verified yet");
    }

    const { data: wallet, error: wErr } = await admin
      .from("wallets")
      .select("id, available_balance, currency")
      .eq("user_id", args.userId)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet) throw new Error("Wallet not found");
    if (Number(wallet.available_balance) < args.amount) throw new Error("Insufficient balance");

    const isBank = pm.method_type === "bank";
    const method = isBank ? "bank_transfer" : "upi";
    const destination: Record<string, unknown> = isBank
      ? {
          payout_method_id: pm.id,
          account_holder_name: pm.account_holder_name,
          bank_name: pm.bank_name,
          account_number_last4: pm.account_number_last4,
          ifsc: pm.ifsc,
          account_type: pm.account_type,
        }
      : { payout_method_id: pm.id, vpa: pm.upi_id };

    const { data: wd, error: iErr } = await admin
      .from("withdrawals")
      .insert({
        user_id: args.userId,
        wallet_id: wallet.id,
        amount: args.amount,
        currency: wallet.currency ?? "INR",
        method,
        destination,
        payout_method_id: pm.id as string,
        status: "requested",
      } as never)
      .select("id")
      .single();
    if (iErr || !wd) throw new Error(`Withdrawal failed: ${iErr?.message}`);

    // Move funds out of available immediately to prevent double-spend.
    await applyWalletTxn({
      userId: args.userId,
      type: "withdrawal_request",
      amount: args.amount,
      referenceType: "withdrawal",
      referenceId: wd.id,
      description: "Withdrawal requested",
    });

    // Ledger: creator wallet → payouts_pending liability
    await postLedger({
      event: "withdrawal.requested",
      amount: args.amount, currency: wallet.currency ?? "INR",
      debit: ACCT.userWallet(args.userId), credit: ACCT.platformPayoutsPending,
      debitUser: args.userId, creditUser: null,
      description: "Withdrawal reserved from wallet",
      idempotencyKey: `wd:${wd.id}:reserve`,
      actorId: args.userId,
    });

    await audit({
      actorId: args.userId,
      action: "withdrawal.requested",
      entityType: "withdrawal",
      entityId: wd.id,
      metadata: { amount: args.amount },
    });
    return { withdrawalId: wd.id };
  },

  async adminApproveWithdrawal(args: {
    withdrawalId: string;
    adminId: string;
    notes?: string;
    triggerPayout?: boolean;
  }) {
    // CAS approve — only one admin wins.
    const { data: wd, error } = await admin
      .from("withdrawals")
      .update({
        status: "approved",
        approved_by: args.adminId,
        approved_at: new Date().toISOString(),
        admin_notes: args.notes ?? null,
      })
      .eq("id", args.withdrawalId)
      .eq("status", "requested")
      .select("id, user_id, amount, currency, method, destination, payout_method_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!wd) throw new Error("Withdrawal is no longer pending");

    await audit({
      actorId: args.adminId,
      action: "withdrawal.approved",
      entityType: "withdrawal",
      entityId: wd.id,
    });
    await notify({
      userId: wd.user_id,
      type: "withdrawal_approved",
      title: "Withdrawal approved",
      body: `Your withdrawal of ₹${Number(wd.amount).toLocaleString("en-IN")} was approved.`,
      payload: { withdrawal_id: wd.id },
    });

    // Optional payout via RazorpayX (self-bootstraps contacts & fund accounts if needed)
    if (args.triggerPayout) {
      try {
        const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
        if (!accountNumber) {
          throw new Error("RAZORPAYX_ACCOUNT_NUMBER env variable is not configured");
        }

        // Fetch payout method
        const { data: pm } = await admin
          .from("payout_methods")
          .select("*")
          .eq("id", wd.payout_method_id)
          .maybeSingle();

        if (!pm) {
          throw new Error("Payout method not found for this withdrawal");
        }

        // Fetch creator details
        let email = "";
        try {
          const { data: creatorUser } = await admin.auth.admin.getUserById(wd.user_id);
          email = creatorUser?.user?.email ?? "";
        } catch (authErr) {
          console.warn("[payout] Failed to fetch creator email", authErr);
        }

        const { data: creatorProfile } = await admin
          .from("profiles")
          .select("display_name")
          .eq("id", wd.user_id)
          .maybeSingle();
        const name = creatorProfile?.display_name ?? "Creator";

        // Create contact
        let contactId = pm.razorpay_contact_id;
        if (!contactId) {
          const contact = await razorpay.createContact({
            name,
            email,
            referenceId: wd.user_id,
          });
          contactId = contact.id;
          await admin
            .from("payout_methods")
            .update({ razorpay_contact_id: contactId })
            .eq("id", pm.id);
        }

        // Create fund account
        let fundAccountId = pm.razorpay_fund_account_id;
        if (!fundAccountId) {
          const fa = await razorpay.createFundAccount({
            contactId,
            accountType: pm.method_type === "bank" ? "bank_account" : "vpa",
            bankAccount: pm.method_type === "bank" ? {
              name,
              ifsc: pm.ifsc,
              accountNumber: pm.account_number,
            } : undefined,
            vpa: pm.method_type === "upi" ? {
              address: pm.upi_id,
            } : undefined,
          });
          fundAccountId = fa.id;
          await admin
            .from("payout_methods")
            .update({ razorpay_fund_account_id: fundAccountId })
            .eq("id", pm.id);
        }

        // Create payout
        const payout = await razorpay.createPayout({
          accountNumber,
          fundAccountId,
          amountMinor: Math.round(Number(wd.amount) * 100),
          currency: wd.currency ?? "INR",
          mode: (wd.method === "upi" ? "UPI" : "IMPS") as "IMPS" | "UPI",
          purpose: "payout",
          referenceId: wd.id,
        });

        // Update withdrawal with processing status and transfer reference
        await admin.from("withdrawals").update({
          status: "processing",
          payout_id: payout.id,
          payout_ref: payout.id,
          razorpay_payout_id: payout.id,
        }).eq("id", wd.id);

        // Also trigger completion immediately if it is mock/sandbox mode!
        const isMockPayout = payout.id.startsWith("payout_mock_");
        if (isMockPayout) {
          await PaymentService.markWithdrawalCompleted({
            withdrawalId: wd.id,
            payoutRef: payout.id,
          });
        }

      } catch (e) {
        console.error("[payout] failed", e);
        await admin.from("withdrawals").update({
          status: "failed",
          failure_reason: e instanceof Error ? e.message : String(e),
        }).eq("id", wd.id);
        throw e;
      }
    } else {
      // Manual payout — mark processing; ops will mark completed
      await admin.from("withdrawals").update({ status: "processing" }).eq("id", wd.id);
    }
  },

  async adminRejectWithdrawal(args: {
    withdrawalId: string;
    adminId: string;
    reason?: string;
  }) {
    // CAS: only reject if still 'requested'. Prevents two admins from acting.
    const { data: wd, error } = await admin
      .from("withdrawals")
      .update({
        status: "rejected",
        approved_by: args.adminId,
        approved_at: new Date().toISOString(),
        admin_notes: args.reason ?? null,
      })
      .eq("id", args.withdrawalId)
      .eq("status", "requested")
      .select("id, user_id, amount")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!wd) throw new Error("Withdrawal is no longer pending");

    // Restore the reserved amount to available (which also reverses the transaction)
    const amt = Number(wd.amount);
    await applyWalletTxn({
      userId: wd.user_id,
      type: "withdrawal_failed",
      amount: amt,
      referenceType: "withdrawal",
      referenceId: wd.id,
      description: "Withdrawal rejected — funds restored",
    });

    // Ledger: reverse the reservation
    await postLedger({
      event: "withdrawal.reversed",
      amount: amt, currency: "INR",
      debit: ACCT.platformPayoutsPending, credit: ACCT.userWallet(wd.user_id),
      debitUser: null, creditUser: wd.user_id,
      description: "Withdrawal rejected — reservation reversed",
      idempotencyKey: `wd:${wd.id}:reverse`,
      actorId: args.adminId,
    });

    await audit({
      actorId: args.adminId, action: "withdrawal.rejected",
      entityType: "withdrawal", entityId: wd.id,
      metadata: { reason: args.reason, amount: amt },
    });
    await notify({
      userId: wd.user_id,
      type: "withdrawal_completed",
      title: "Withdrawal rejected",
      body: args.reason ?? "Your withdrawal was rejected. Funds returned to wallet.",
      payload: { withdrawal_id: wd.id },
    });
  },

  /**
   * Razorpay reported the payout as failed. Restore the creator's available
   * balance, undo the reserved 'withdrawn' bump, and reverse the ledger.
   * Idempotent — only acts on withdrawals still in flight.
   */
  async markWithdrawalFailed(args: { withdrawalId: string; reason?: string }) {
    const { data: wd } = await admin
      .from("withdrawals")
      .update({
        status: "failed",
        failure_reason: args.reason ?? "Payout failed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", args.withdrawalId)
      .in("status", ["approved", "processing"])
      .select("id, user_id, amount, currency")
      .maybeSingle();
    if (!wd) return;

    const amt = Number(wd.amount);
    await applyWalletTxn({
      userId: wd.user_id,
      type: "withdrawal_failed",
      amount: amt,
      referenceType: "withdrawal",
      referenceId: wd.id,
      description: "Payout failed — funds restored",
    });

    await postLedger({
      event: "withdrawal.failed",
      amount: amt, currency: (wd.currency as string) ?? "INR",
      debit: ACCT.platformPayoutsPending, credit: ACCT.userWallet(wd.user_id),
      debitUser: null, creditUser: wd.user_id,
      description: "Payout failed — reservation reversed",
      idempotencyKey: `wd:${wd.id}:failed`,
    });

    await audit({
      actorId: null, action: "withdrawal.failed",
      entityType: "withdrawal", entityId: wd.id,
      metadata: { reason: args.reason, amount: amt },
    });
    await notify({
      userId: wd.user_id,
      type: "withdrawal_completed",
      title: "Payout failed",
      body: args.reason ?? "Your payout did not go through. The amount has been returned to your wallet.",
      payload: { withdrawal_id: wd.id },
    });
  },

  async markWithdrawalCompleted(args: { withdrawalId: string; payoutRef?: string }) {
    // Idempotent: only completes an in-flight withdrawal.
    const { data: wd, error } = await admin
      .from("withdrawals")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        payout_ref: args.payoutRef ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", args.withdrawalId)
      .in("status", ["approved", "processing"])
      .select("id, user_id, amount, currency")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!wd) return; // already completed or not eligible

    // Update creator's withdrawn balance upon successful completion of payout
    await applyWalletTxn({
      userId: wd.user_id,
      type: "withdrawal_completed",
      amount: Number(wd.amount),
      referenceType: "withdrawal",
      referenceId: wd.id,
      description: "Payout completed — withdrawn balance updated",
    });

    // Ledger: payouts_pending → cash out (leaves the platform bank)
    await postLedger({
      event: "withdrawal.completed",
      amount: Number(wd.amount), currency: (wd.currency as string) ?? "INR",
      debit: ACCT.platformPayoutsPending, credit: ACCT.platformCash,
      debitUser: null, creditUser: wd.user_id,
      description: "Payout completed",
      idempotencyKey: `wd:${wd.id}:complete`,
    });

    await audit({
      actorId: null, action: "withdrawal.completed",
      entityType: "withdrawal", entityId: wd.id,
      metadata: { amount: wd.amount, payoutRef: args.payoutRef },
    });
    await notify({
      userId: wd.user_id,
      type: "withdrawal_completed",
      title: "Withdrawal completed",
      body: `₹${Number(wd.amount).toLocaleString("en-IN")} sent to your account.`,
      payload: { withdrawal_id: wd.id },
    });
  },

  // -------- Wallet snapshot --------

  async getWallet(userId: string): Promise<WalletSnapshot> {
    await admin.rpc("ensure_wallet", { _user_id: userId });
    const { data, error } = await admin
      .from("wallets")
      .select("id, currency, available_balance, held_balance, pending_balance, withdrawn_balance, lifetime_earned")
      .eq("user_id", userId)
      .single();
    if (error || !data) throw new Error("Wallet unavailable");
    return {
      id: data.id,
      currency: data.currency,
      available_balance: Number(data.available_balance),
      held_balance: Number(data.held_balance),
      pending_balance: Number(data.pending_balance),
      withdrawn_balance: Number(data.withdrawn_balance),
      lifetime_earned: Number(data.lifetime_earned),
    };
  },

  // Exposed for webhook use
  _applyWalletTxn: applyWalletTxn,
  _log: log,
  _notify: notify,
  _audit: audit,
};
