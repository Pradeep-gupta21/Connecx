// Server functions exposed to the client via TanStack Start RPC.
// All state changes are gated by requireSupabaseAuth; admin-only mutations
// double-check the caller's role before proceeding.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createOrderSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  currency: z.string().length(3).default("INR"),
  payeeId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

export const createPaymentOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createOrderSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    return PaymentService.createOrder(data, context.userId);
  });

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => verifySchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    return PaymentService.verifyAndCapture({ ...data, actorId: context.userId });
  });

const refundSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
});

export const createRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => refundSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    // Only admin or the original payer can request refunds.
    const { data: pay, error } = await context.supabase
      .from("payments")
      .select("payer_id")
      .eq("id", data.paymentId)
      .single();
    if (error || !pay) throw new Error("Payment not accessible");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin && pay.payer_id !== context.userId) {
      throw new Error("Forbidden");
    }
    return PaymentService.createRefund({ ...data, actorId: context.userId });
  });

const withdrawalSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["bank_transfer", "upi"]).default("bank_transfer"),
  destination: z.record(z.string(), z.unknown()),
});

export const createWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => withdrawalSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    return PaymentService.requestWithdrawal({ userId: context.userId, ...data });
  });

const historySchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const getPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => historySchema.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("payments")
      .select("id, amount, currency, status_v2, type, provider, created_at, processed_at, contract_id, payer_id, payee_id")
      .or(`payer_id.eq.${context.userId},payee_id.eq.${context.userId}`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { PaymentService } = await import("./service.server");
    return PaymentService.getWallet(context.userId);
  });

export const getWalletHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => historySchema.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("wallet_transactions")
      .select("id, type, amount, currency, balance_after, reference_type, reference_id, description, created_at")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const releaseSchema = z.object({ paymentId: z.string().uuid() });

export const releasePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => releaseSchema.parse(raw))
  .handler(async ({ data, context }) => {
    // Only the payer (advertiser) or an admin can release held funds.
    const { data: pay, error } = await context.supabase
      .from("payments")
      .select("payer_id")
      .eq("id", data.paymentId)
      .single();
    if (error || !pay) throw new Error("Payment not accessible");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin && pay.payer_id !== context.userId) {
      throw new Error("Forbidden");
    }
    const { PaymentService } = await import("./service.server");
    await PaymentService.releasePayment(data.paymentId, context.userId);
    return { ok: true };
  });
