// Server functions exposed to the client via TanStack Start RPC.
// All state changes are gated by requireSupabaseAuth; admin-only mutations
// double-check the caller's role before proceeding.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -------- Fund campaign (advertiser) --------
const fundSchema = z.object({ campaignId: z.string().uuid() });
export const fundCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => fundSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    return PaymentService.createCampaignOrder({ campaignId: data.campaignId, payerId: context.userId });
  });

// -------- Preview fee breakdown --------
const previewSchema = z.object({
  budget: z.number().positive(),
  platformFeePct: z.number().min(0).max(50).optional(),
  gstPct: z.number().min(0).max(50).optional(),
});
export const previewCampaignFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => previewSchema.parse(raw))
  .handler(async ({ data }) => {
    const { computeBreakdown } = await import("./service.server");
    return computeBreakdown(data.budget, data.platformFeePct, data.gstPct);
  });

// -------- Legacy generic order (kept) --------
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

// -------- Verify checkout signature --------
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

// -------- Accept creator (advertiser) --------
const acceptSchema = z.object({
  campaignId: z.string().uuid(),
  applicationId: z.string().uuid(),
  creatorId: z.string().uuid(),
});
export const acceptCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => acceptSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    return PaymentService.acceptCreator({ ...data, actorId: context.userId });
  });

// -------- Deliverables --------
const submitSchema = z.object({
  contractId: z.string().uuid(),
  urls: z.array(z.object({ name: z.string(), url: z.string().url() })).min(1),
  notes: z.string().max(2000).optional(),
});
export const submitDeliverables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => submitSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    await PaymentService.submitDeliverables({ ...data, creatorId: context.userId });
    return { ok: true };
  });

const reviewSchema = z.object({
  contractId: z.string().uuid(),
  decision: z.enum(["approve", "revision"]),
  notes: z.string().max(2000).optional(),
});
export const reviewDeliverables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => reviewSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    if (data.decision === "approve") {
      await PaymentService.approveDeliverables({ contractId: data.contractId, actorId: context.userId });
    } else {
      if (!data.notes || data.notes.length < 3) throw new Error("Revision notes required");
      await PaymentService.requestRevision({ contractId: data.contractId, actorId: context.userId, notes: data.notes });
    }
    return { ok: true };
  });

// -------- Refund: user files a REQUEST (admin must approve) --------
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
    if (!isAdmin && pay.payer_id !== context.userId) throw new Error("Forbidden");
    return PaymentService.createRefund({ ...data, actorId: context.userId });
  });

// -------- Admin: approve or reject a refund request --------
const adminRefundSchema = z.object({
  refundId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
});
export const adminReviewRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => adminRefundSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");
    const { PaymentService } = await import("./service.server");
    if (data.action === "approve") {
      return PaymentService.adminApproveRefund({
        refundId: data.refundId,
        adminId: context.userId,
        notes: data.notes,
      });
    }
    if (!data.reason || data.reason.trim().length < 3) {
      throw new Error("Rejection reason is required");
    }
    return PaymentService.adminRejectRefund({
      refundId: data.refundId,
      adminId: context.userId,
      reason: data.reason,
    });
  });

// -------- Withdrawals --------
const withdrawalSchema = z.object({
  amount: z.number().positive(),
  payoutMethodId: z.string().uuid(),
});
export const createWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => withdrawalSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    return PaymentService.requestWithdrawal({
      userId: context.userId,
      amount: data.amount,
      payoutMethodId: data.payoutMethodId,
    });
  });

const adminPayoutReviewSchema = z.object({
  payoutMethodId: z.string().uuid(),
  action: z.enum(["approve", "reject", "request_update"]),
  reason: z.string().max(500).optional(),
});
export const adminReviewPayoutMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => adminPayoutReviewSchema.parse(raw))
  .handler(async ({ data, context }) => {
    if ((data.action === "reject" || data.action === "request_update") && !data.reason?.trim()) {
      throw new Error("Please provide a reason");
    }
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");
    const { error } = await context.supabase.rpc("admin_review_payout_method" as never, {
      _payout_method_id: data.payoutMethodId,
      _action: data.action,
      _reason: data.reason ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const adminWithdrawalSchema = z.object({
  withdrawalId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  triggerPayout: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});
export const adminReviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => adminWithdrawalSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");
    const { PaymentService } = await import("./service.server");
    if (data.action === "approve") {
      await PaymentService.adminApproveWithdrawal({
        withdrawalId: data.withdrawalId,
        adminId: context.userId,
        notes: data.notes,
        triggerPayout: data.triggerPayout ?? false,
      });
    } else {
      await PaymentService.adminRejectWithdrawal({
        withdrawalId: data.withdrawalId,
        adminId: context.userId,
        reason: data.notes,
      });
    }
    return { ok: true };
  });

// Mark withdrawal completed manually (admin action for offline payouts)
const completeWdSchema = z.object({
  withdrawalId: z.string().uuid(),
  payoutRef: z.string().max(200).optional(),
});
export const adminMarkWithdrawalCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => completeWdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");
    const { PaymentService } = await import("./service.server");
    await PaymentService.markWithdrawalCompleted({
      withdrawalId: data.withdrawalId,
      payoutRef: data.payoutRef,
    });
    return { ok: true };
  });

// -------- History --------
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
      .select("id, amount, currency, status_v2, type, provider, created_at, processed_at, contract_id, campaign_id, payer_id, payee_id, platform_fee, gst, creator_earnings, receipt_number, invoice_number")
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

// Fetch a payment with full breakdown (advertiser or admin only)
const paymentDetailSchema = z.object({ paymentId: z.string().uuid() });
export const getPaymentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => paymentDetailSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .single();
    if (error || !row) throw new Error("Payment not found");
    return row;
  });

// Release manually (advertiser or admin) — usually done via approveDeliverables
const releaseSchema = z.object({ paymentId: z.string().uuid() });
export const releasePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => releaseSchema.parse(raw))
  .handler(async ({ data, context }) => {
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
    if (!isAdmin && pay.payer_id !== context.userId) throw new Error("Forbidden");
    const { PaymentService } = await import("./service.server");
    await PaymentService.releasePayment(data.paymentId, context.userId);
    return { ok: true };
  });
