// PaymentService: server-only orchestration layer built on Supabase + Razorpay.
// All mutations funnel through here so business logic + audit + notifications
// stay in one place.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { razorpay } from "./razorpay.server";
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
      .select("id, advertiser_id, title, budget_max, budget_min, platform_fee_pct, gst_pct, funded, status")
      .eq("id", input.campaignId)
      .single();
    if (error || !c) throw new Error("Campaign not found");
    if (c.advertiser_id !== input.payerId) throw new Error("Only the campaign owner can fund it");
    if (c.funded) throw new Error("Campaign is already funded");

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
      })
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
      .select("id, amount, currency, payer_id, payee_id, campaign_id, status_v2, type, platform_fee, gst, creator_earnings, contract_id")
      .eq("razorpay_order_id", input.razorpay_order_id)
      .single();
    if (error || !pay) throw new Error("Payment order not found");
    if (pay.status_v2 && !["pending", "failed"].includes(pay.status_v2)) {
      return { paymentId: pay.id, status: pay.status_v2 as PaymentStatus };
    }

    // 1) Paid → 2) Held (funds escrowed by platform)
    await admin.from("payments")
      .update({
        status: "held",
        status_v2: "held",
        razorpay_payment_id: input.razorpay_payment_id,
        razorpay_signature: input.razorpay_signature,
        processed_at: new Date().toISOString(),
      })
      .eq("id", pay.id);

    // Mark campaign as funded
    if (pay.campaign_id) {
      await admin.from("campaigns")
        .update({
          funded: true,
          funded_amount: Number(pay.amount),
          funded_at: new Date().toISOString(),
          funded_payment_id: pay.id,
          status: "open",
        })
        .eq("id", pay.campaign_id);
    }

    // Double-entry ledger: cash in → escrow liability + fee + gst revenue.
    // Idempotent per payment id — safe if webhook + client both fire.
    const currency = (pay.currency as string) ?? "INR";
    const creatorAmt = Number(pay.creator_earnings ?? pay.amount ?? 0);
    const feeAmt = Number(pay.platform_fee ?? 0);
    const gstAmt = Number(pay.gst ?? 0);
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
      action: "payment.captured",
      from: "pending",
      to: "held",
      metadata: { razorpay_payment_id: input.razorpay_payment_id },
    });
    await audit({
      actorId: input.actorId,
      action: "payment.captured",
      entityType: "payment",
      entityId: pay.id,
      metadata: { campaign_id: pay.campaign_id },
    });

    // Notifications
    await notify({
      userId: pay.payer_id,
      type: "payment_success",
      title: "Payment successful",
      body: `Your campaign is funded. Ref ${input.razorpay_payment_id}.`,
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
    const { data: c, error } = await admin
      .from("campaigns")
      .select("id, advertiser_id, title, funded, funded_payment_id, funded_amount")
      .eq("id", args.campaignId)
      .single();
    if (error || !c) throw new Error("Campaign not found");
    if (c.advertiser_id !== args.actorId) throw new Error("Only the campaign owner can accept creators");
    if (!c.funded) throw new Error("Fund the campaign before accepting creators");

    // Mark application accepted; reject others (optional but common for single-slot campaigns)
    await admin.from("applications").update({ status: "accepted" })
      .eq("id", args.applicationId);

    // Retarget the funded payment to the accepted creator
    if (c.funded_payment_id) {
      await admin.from("payments").update({ payee_id: args.creatorId }).eq("id", c.funded_payment_id);
      // Hold credit in creator wallet (pending release)
      const { data: pay } = await admin
        .from("payments")
        .select("creator_earnings, amount")
        .eq("id", c.funded_payment_id)
        .single();
      const holdAmount = Number(pay?.creator_earnings ?? pay?.amount ?? 0);
      if (holdAmount > 0) {
        await applyWalletTxn({
          userId: args.creatorId,
          type: "hold",
          amount: holdAmount,
          referenceType: "payment",
          referenceId: c.funded_payment_id,
          description: `Funds held for "${c.title}"`,
        });
      }
    }

    // Create contract
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
          amount: Number(c.funded_amount ?? 0),
          currency: "INR",
          status: "active",
          payment_id: c.funded_payment_id,
        })
        .select("id")
        .single();
      if (cErr || !inserted) throw new Error(`Contract failed: ${cErr?.message}`);
      contractId = inserted.id;
    } else {
      await admin.from("contracts").update({ status: "active" }).eq("id", contractId);
    }

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
      .select("id, advertiser_id, creator_id, campaign_id, title, payment_id")
      .eq("id", args.contractId)
      .single();
    if (error || !contract) throw new Error("Contract not found");
    if (contract.advertiser_id !== args.actorId) throw new Error("Only the advertiser can approve");
    if (!contract.payment_id) throw new Error("Contract has no linked escrow payment — cannot release funds");

    await admin.from("contracts").update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    }).eq("id", args.contractId);

    await this.releasePayment(contract.payment_id, args.actorId);

    await admin.from("contracts").update({ status: "completed" }).eq("id", args.contractId);

    await audit({
      actorId: args.actorId,
      action: "deliverables.approved",
      entityType: "contract",
      entityId: args.contractId,
    });
  },

  // -------- Release (HELD → RELEASED, credit creator wallet) --------

  async releasePayment(paymentId: string, actorId: string) {
    const { data: pay, error } = await admin
      .from("payments")
      .select("id, amount, creator_earnings, payee_id, payer_id, campaign_id, status_v2")
      .eq("id", paymentId)
      .single();
    if (error || !pay) throw new Error("Payment not found");
    if (!pay.status_v2) throw new Error("Payment has no captured status — cannot release");
    if (!["held", "revision_requested"].includes(pay.status_v2)) {
      throw new Error(`Cannot release from ${pay.status_v2}`);
    }

    await admin.from("payments")
      .update({ status: "succeeded", status_v2: "released" })
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

    await log({ paymentId, actorId, action: "payment.released", from: "held", to: "released" });
    await audit({ actorId, action: "payment.released", entityType: "payment", entityId: paymentId });

    await notify({
      userId: pay.payee_id,
      type: "payment_released",
      title: "Payment released 🎉",
      body: `₹${releaseAmt.toLocaleString("en-IN")} is now available in your wallet.`,
      payload: { payment_id: paymentId, campaign_id: pay.campaign_id },
    });
    await notify({
      userId: pay.payer_id,
      type: "payment_released",
      title: "Funds released to creator",
      body: `Payment ${paymentId.slice(0, 8)} settled.`,
      payload: { payment_id: paymentId },
    });
  },

  // -------- Refunds --------

  async createRefund(args: {
    paymentId: string;
    amount?: number;
    reason?: string;
    actorId: string;
  }) {
    const { data: pay, error } = await admin
      .from("payments")
      .select("id, amount, currency, payer_id, payee_id, campaign_id, razorpay_payment_id, status_v2")
      .eq("id", args.paymentId)
      .single();
    if (error || !pay) throw new Error("Payment not found");
    if (!pay.razorpay_payment_id) throw new Error("Nothing to refund — payment not captured");

    const refundAmount = args.amount ?? Number(pay.amount);
    if (refundAmount <= 0) throw new Error("Invalid refund amount");

    const { data: refundRow, error: rErr } = await admin
      .from("refunds")
      .insert({
        payment_id: pay.id,
        requested_by: args.actorId,
        amount: refundAmount,
        currency: pay.currency ?? "INR",
        reason: args.reason ?? null,
        status: "processing",
      })
      .select("id")
      .single();
    if (rErr || !refundRow) throw new Error(`Refund insert failed: ${rErr?.message}`);

    const rzp = await razorpay.createRefund({
      paymentId: pay.razorpay_payment_id,
      amountMinor: toMinor(refundAmount),
      notes: { refund_id: refundRow.id, reason: args.reason ?? "" },
    });

    await admin.from("refunds").update({ razorpay_refund_id: rzp.id }).eq("id", refundRow.id);
    await admin.from("payments")
      .update({ status: "processing", status_v2: "refund_pending" })
      .eq("id", pay.id);

    await log({
      paymentId: pay.id,
      actorId: args.actorId,
      action: "refund.requested",
      to: "refund_pending",
      metadata: { refund_id: refundRow.id, razorpay_refund_id: rzp.id, amount: refundAmount },
    });
    await audit({
      actorId: args.actorId,
      action: "refund.requested",
      entityType: "payment",
      entityId: pay.id,
      metadata: { amount: refundAmount, reason: args.reason },
    });

    return { refundId: refundRow.id, razorpayRefundId: rzp.id };
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
      .from("payments").select("id, payer_id, payee_id, campaign_id, status_v2, creator_earnings, amount")
      .eq("id", refund.payment_id).single();
    if (!pay) return;

    const prevStatus = pay.status_v2 as string | null;
    await admin.from("payments")
      .update({ status: "refunded", status_v2: "refunded" }).eq("id", pay.id);

    // Reverse creator-side balances.
    // - If still HELD/revision_requested: unwind the hold (held & pending).
    // - If already RELEASED: debit available_balance (creator was paid, now clawed back).
    // - Otherwise: no creator wallet impact (payee was never credited).
    const refundAmt = Number(refund.amount);
    const creatorAmt = Number(pay.creator_earnings ?? pay.amount ?? refundAmt);
    try {
      if (prevStatus === "held" || prevStatus === "revision_requested") {
        const unwind = Math.min(creatorAmt, refundAmt);
        await admin.rpc("ensure_wallet", { _user_id: pay.payee_id });
        const { data: wallet } = await admin
          .from("wallets")
          .select("id, held_balance, pending_balance")
          .eq("user_id", pay.payee_id)
          .single();
        if (wallet) {
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
            description: "Held funds released back to advertiser (refund)",
            metadata: { payment_id: pay.id, from_status: prevStatus },
          });
        }
      } else if (prevStatus === "released") {
        await applyWalletTxn({
          userId: pay.payee_id,
          type: "refund",
          amount: refundAmt,
          referenceType: "refund",
          referenceId: refund.id,
          description: "Refund clawback from available balance",
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
  },

  // -------- Withdrawals (Creator → Admin approve → Payout) --------

  async requestWithdrawal(args: {
    userId: string;
    amount: number;
    method?: string;
    destination: Record<string, unknown>;
  }) {
    const { MIN_WITHDRAWAL_INR, MAX_WITHDRAWAL_INR } = await import("@/lib/constants");
    if (!Number.isFinite(args.amount) || args.amount <= 0) throw new Error("Invalid amount");
    if (args.amount < MIN_WITHDRAWAL_INR) {
      throw new Error(`Minimum withdrawal is ₹${MIN_WITHDRAWAL_INR.toLocaleString("en-IN")}`);
    }
    if (args.amount > MAX_WITHDRAWAL_INR) {
      throw new Error(`Maximum per-request withdrawal is ₹${MAX_WITHDRAWAL_INR.toLocaleString("en-IN")}`);
    }
    const { data: wallet, error: wErr } = await admin
      .from("wallets")
      .select("id, available_balance, currency")
      .eq("user_id", args.userId)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet) throw new Error("Wallet not found");
    if (Number(wallet.available_balance) < args.amount) throw new Error("Insufficient balance");


    const { data: wd, error: iErr } = await admin
      .from("withdrawals")
      .insert({
        user_id: args.userId,
        wallet_id: wallet.id,
        amount: args.amount,
        currency: wallet.currency ?? "INR",
        method: args.method ?? "bank_transfer",
        destination: args.destination,
        status: "requested",
      })
      .select("id")
      .single();
    if (iErr || !wd) throw new Error(`Withdrawal failed: ${iErr?.message}`);

    // Move funds out of available immediately to prevent double-spend.
    await applyWalletTxn({
      userId: args.userId,
      type: "withdrawal",
      amount: args.amount,
      referenceType: "withdrawal",
      referenceId: wd.id,
      description: "Withdrawal requested",
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
    const { data: wd, error } = await admin
      .from("withdrawals")
      .select("id, user_id, amount, currency, method, destination, status")
      .eq("id", args.withdrawalId)
      .single();
    if (error || !wd) throw new Error("Withdrawal not found");
    if (wd.status !== "requested") throw new Error(`Cannot approve from ${wd.status}`);

    await admin.from("withdrawals").update({
      status: "approved",
      approved_by: args.adminId,
      approved_at: new Date().toISOString(),
      admin_notes: args.notes ?? null,
    }).eq("id", wd.id);

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

    // Optional payout via RazorpayX (requires a fund_account_id in destination)
    if (args.triggerPayout) {
      try {
        const dest = wd.destination as Record<string, unknown>;
        const fundAccountId = dest?.fund_account_id as string | undefined;
        const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
        if (fundAccountId && accountNumber) {
          const payout = await razorpay.createPayout({
            accountNumber,
            fundAccountId,
            amountMinor: Math.round(Number(wd.amount) * 100),
            currency: wd.currency ?? "INR",
            mode: (wd.method === "upi" ? "UPI" : "IMPS") as "IMPS" | "UPI",
            purpose: "payout",
            referenceId: wd.id,
          });
          await admin.from("withdrawals").update({
            status: "processing",
            payout_id: payout.id,
            payout_ref: payout.id,
            razorpay_payout_id: payout.id,
          }).eq("id", wd.id);

        } else {
          // Manual payout — mark processing; ops will mark completed
          await admin.from("withdrawals").update({ status: "processing" }).eq("id", wd.id);
        }
      } catch (e) {
        console.error("[payout] failed", e);
        await admin.from("withdrawals").update({
          status: "failed",
          failure_reason: e instanceof Error ? e.message : String(e),
        }).eq("id", wd.id);
      }
    }
  },

  async adminRejectWithdrawal(args: {
    withdrawalId: string;
    adminId: string;
    reason?: string;
  }) {
    const { data: wd, error } = await admin
      .from("withdrawals")
      .select("id, user_id, amount, status")
      .eq("id", args.withdrawalId)
      .single();
    if (error || !wd) throw new Error("Withdrawal not found");
    if (wd.status !== "requested") throw new Error(`Cannot reject from ${wd.status}`);

    await admin.from("withdrawals").update({
      status: "rejected",
      approved_by: args.adminId,
      approved_at: new Date().toISOString(),
      admin_notes: args.reason ?? null,
    }).eq("id", wd.id);

    // Restore the reserved amount to available AND unwind the withdrawn_balance
    // that requestWithdrawal bumped (otherwise "lifetime withdrawn" drifts up on every reject).
    const amt = Number(wd.amount);
    await admin.rpc("ensure_wallet", { _user_id: wd.user_id });
    const { data: wallet } = await admin
      .from("wallets")
      .select("id, available_balance, withdrawn_balance")
      .eq("user_id", wd.user_id)
      .single();
    if (wallet) {
      await admin.from("wallets").update({
        available_balance: Number(wallet.available_balance) + amt,
        withdrawn_balance: Math.max(Number(wallet.withdrawn_balance) - amt, 0),
      }).eq("id", wallet.id);
      await admin.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        user_id: wd.user_id,
        type: "adjustment",
        amount: amt,
        balance_after: Number(wallet.available_balance) + amt,
        reference_type: "withdrawal",
        reference_id: wd.id,
        description: "Withdrawal rejected — funds restored",
      });
    }

    await notify({
      userId: wd.user_id,
      type: "withdrawal_completed",
      title: "Withdrawal rejected",
      body: args.reason ?? "Your withdrawal was rejected. Funds returned to wallet.",
      payload: { withdrawal_id: wd.id },
    });
  },

  async markWithdrawalCompleted(args: { withdrawalId: string; payoutRef?: string }) {
    const { data: wd } = await admin
      .from("withdrawals")
      .select("id, user_id, amount, status")
      .eq("id", args.withdrawalId).single();
    if (!wd || wd.status === "completed") return;
    await admin.from("withdrawals").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      payout_ref: args.payoutRef ?? null,
      processed_at: new Date().toISOString(),
    }).eq("id", wd.id);
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
