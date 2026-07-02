// PaymentService: server-only orchestration layer built on Supabase + Razorpay.
// All mutations funnel through here so business logic + audit stays in one place.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// Loose-typed alias: generated Supabase types lag new payment columns/enums.
// Writes are validated by zod at the RPC boundary and RLS on the DB side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin: any = supabaseAdmin;
import { razorpay } from "./razorpay.server";
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentStatus,
  WalletSnapshot,
  WalletTxnType,
} from "./types";

function toMinor(amount: number): number {
  return Math.round(amount * 100);
}
function toMajor(minor: number): number {
  return Math.round(minor) / 100;
}

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
  } as never);
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

export const PaymentService = {
  async createOrder(input: CreateOrderInput, payerId: string): Promise<CreateOrderResult> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Invalid amount");
    }
    const currency = input.currency ?? "INR";
    const amountMinor = toMinor(input.amount);

    // 1. Reserve internal payment row first so we have a receipt id.
    const { data: pay, error: payErr } = await admin
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
        notes: input.notes ?? {},
      })
      .select("id")
      .single();
    if (payErr || !pay) throw new Error(`Failed to create payment row: ${payErr?.message}`);

    // 2. Create Razorpay order
    const order = await razorpay.createOrder({
      amountMinor,
      currency,
      receipt: pay.id,
      notes: { ...(input.notes ?? {}), payment_id: pay.id, payer_id: payerId, payee_id: input.payeeId },
    });

    // 3. Persist razorpay ids
    const { error: updErr } = await admin
      .from("payments")
      .update({ razorpay_order_id: order.id })
      .eq("id", pay.id);
    if (updErr) throw new Error(`Failed to attach order id: ${updErr.message}`);

    await log({
      paymentId: pay.id,
      actorId: payerId,
      action: "order.created",
      to: "pending",
      metadata: { razorpay_order_id: order.id },
    });

    return {
      orderId: order.id,
      paymentId: pay.id,
      amount: amountMinor,
      currency,
      keyId: razorpay.publicKeyId(),
    };
  },

  async verifyAndCapture(input: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    actorId: string;
  }) {
    const ok = razorpay.verifyCheckoutSignature({
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });
    if (!ok) throw new Error("Invalid Razorpay signature");

    const { data: pay, error } = await admin
      .from("payments")
      .select("id, amount, currency, payee_id, status_v2")
      .eq("razorpay_order_id", input.razorpay_order_id)
      .single();
    if (error || !pay) throw new Error("Payment order not found");

    // Idempotent: if already paid/held, return.
    if (pay.status_v2 && pay.status_v2 !== "pending" && pay.status_v2 !== "failed") {
      return { paymentId: pay.id, status: pay.status_v2 as PaymentStatus };
    }

    // Mark as held (funds captured, awaiting release).
    const { error: uErr } = await admin
      .from("payments")
      .update({
        status: "held",
        status_v2: "held",
        razorpay_payment_id: input.razorpay_payment_id,
        razorpay_signature: input.razorpay_signature,
        processed_at: new Date().toISOString(),
      })
      .eq("id", pay.id);
    if (uErr) throw new Error(`Failed to update payment: ${uErr.message}`);

    // Credit creator's held/pending balance.
    await applyWalletTxn({
      userId: pay.payee_id,
      type: "hold",
      amount: Number(pay.amount),
      referenceType: "payment",
      referenceId: pay.id,
      description: "Funds held pending delivery",
    });

    await log({
      paymentId: pay.id,
      actorId: input.actorId,
      action: "payment.captured",
      from: "pending",
      to: "held",
      metadata: { razorpay_payment_id: input.razorpay_payment_id },
    });

    return { paymentId: pay.id, status: "held" as PaymentStatus };
  },

  async releasePayment(paymentId: string, actorId: string) {
    const { data: pay, error } = await admin
      .from("payments")
      .select("id, amount, payee_id, status_v2")
      .eq("id", paymentId)
      .single();
    if (error || !pay) throw new Error("Payment not found");
    if (pay.status_v2 !== "held") throw new Error(`Cannot release from status ${pay.status_v2}`);

    await admin
      .from("payments")
      .update({ status: "released", status_v2: "released" })
      .eq("id", paymentId);

    await applyWalletTxn({
      userId: pay.payee_id,
      type: "release",
      amount: Number(pay.amount),
      referenceType: "payment",
      referenceId: pay.id,
      description: "Funds released",
    });

    await log({
      paymentId,
      actorId,
      action: "payment.released",
      from: "held",
      to: "released",
    });
  },

  async createRefund(args: {
    paymentId: string;
    amount?: number;
    reason?: string;
    actorId: string;
  }) {
    const { data: pay, error } = await admin
      .from("payments")
      .select("id, amount, currency, payee_id, razorpay_payment_id, status_v2")
      .eq("id", args.paymentId)
      .single();
    if (error || !pay) throw new Error("Payment not found");
    if (!pay.razorpay_payment_id) throw new Error("Payment has no captured razorpay_payment_id");

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
    if (rErr || !refundRow) throw new Error(`Failed to create refund row: ${rErr?.message}`);

    const rzp = await razorpay.createRefund({
      paymentId: pay.razorpay_payment_id,
      amountMinor: toMinor(refundAmount),
      notes: { refund_id: refundRow.id, reason: args.reason ?? "" },
    });

    await admin
      .from("refunds")
      .update({ razorpay_refund_id: rzp.id })
      .eq("id", refundRow.id);

    await admin
      .from("payments")
      .update({ status: "refund_pending", status_v2: "refund_pending" })
      .eq("id", pay.id);

    await log({
      paymentId: pay.id,
      actorId: args.actorId,
      action: "refund.requested",
      to: "refund_pending",
      metadata: { refund_id: refundRow.id, razorpay_refund_id: rzp.id, amount: refundAmount },
    });

    return { refundId: refundRow.id, razorpayRefundId: rzp.id };
  },

  async requestWithdrawal(args: {
    userId: string;
    amount: number;
    method?: string;
    destination: Record<string, unknown>;
  }) {
    if (args.amount <= 0) throw new Error("Invalid amount");
    // Ensure wallet exists & has funds.
    const { data: wallet, error: wErr } = await admin
      .from("wallets")
      .select("id, available_balance, currency")
      .eq("user_id", args.userId)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet) throw new Error("Wallet not found");
    if (Number(wallet.available_balance) < args.amount) {
      throw new Error("Insufficient available balance");
    }

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
    if (iErr || !wd) throw new Error(`Failed to create withdrawal: ${iErr?.message}`);

    // Optimistically move funds out of available into withdrawn.
    await applyWalletTxn({
      userId: args.userId,
      type: "withdrawal",
      amount: args.amount,
      referenceType: "withdrawal",
      referenceId: wd.id,
      description: "Withdrawal requested",
    });

    return { withdrawalId: wd.id };
  },

  async getWallet(userId: string): Promise<WalletSnapshot> {
    // Ensure wallet
    await admin.rpc("ensure_wallet", { _user_id: userId });
    const { data, error } = await admin
      .from("wallets")
      .select("id, currency, available_balance, held_balance, pending_balance, withdrawn_balance, lifetime_earned")
      .eq("user_id", userId)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Wallet fetch failed");
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

  toMajor,
  toMinor,
  log,
  applyWalletTxn,
};
