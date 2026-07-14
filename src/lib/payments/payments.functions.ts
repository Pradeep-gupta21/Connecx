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

// -------- Fund contract (advertiser) --------
const fundContractSchema = z.object({ contractId: z.string().uuid() });
export const fundContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => fundContractSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { PaymentService } = await import("./service.server");
    return PaymentService.createContractPaymentOrder({ contractId: data.contractId, payerId: context.userId });
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
      .select("id, amount, currency, status_v2, payout_status, released_at, released_by, type, provider, created_at, processed_at, contract_id, campaign_id, payer_id, payee_id, platform_fee, gst, creator_earnings, receipt_number, invoice_number")
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

// Fetch creator profile, email, payout methods, and withdrawal request details (Admin only)
const payoutDetailsSchema = z.object({ paymentId: z.string().uuid() });
export const getAdminPaymentPayoutDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => payoutDetailsSchema.parse(raw))
  .handler(async ({ data, context }) => {
    // 1. Enforce Admin only
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Unauthorized: Admin role required");

    // 2. Fetch payment
    const { data: payment, error: pErr } = await context.supabase
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (pErr || !payment) throw new Error("Payment not found");

    // 3. Fetch creator profile
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", payment.payee_id)
      .maybeSingle();

    // 4. Fetch creator email from auth.users (requires service role / supabaseAdmin)
    let email = "";
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: creatorUser } = await supabaseAdmin.auth.admin.getUserById(payment.payee_id);
      email = creatorUser?.user?.email ?? "";
    } catch (e) {
      console.warn("Failed to fetch user email in adminPayoutDetails", e);
    }

    // 5. Fetch default payout method
    const { data: payoutMethod } = await context.supabase
      .from("payout_methods")
      .select("*")
      .eq("user_id", payment.payee_id)
      .eq("is_default", true)
      .maybeSingle();

    // 6. Fetch linked or most recent withdrawal request
    const { data: withdrawal } = await context.supabase
      .from("withdrawals")
      .select("*")
      .or(`payment_id.eq.${payment.id},and(user_id.eq.${payment.payee_id},status.neq.cancelled)`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      payment,
      creator: {
        id: payment.payee_id,
        name: profile?.display_name ?? "Creator",
        email: email || "N/A",
      },
      payoutMethod: payoutMethod ? {
        id: payoutMethod.id,
        methodType: payoutMethod.method_type,
        accountHolderName: payoutMethod.account_holder_name,
        bankName: payoutMethod.bank_name,
        accountNumberLast4: payoutMethod.account_number_last4,
        ifsc: payoutMethod.ifsc,
        upiId: payoutMethod.upi_id,
        verificationStatus: payoutMethod.verification_status,
        razorpayContactId: (payoutMethod as any).razorpay_contact_id,
        razorpayFundAccountId: (payoutMethod as any).razorpay_fund_account_id,
      } : null,
      withdrawal: withdrawal ? {
        id: withdrawal.id,
        amount: Number(withdrawal.amount),
        status: withdrawal.status,
        method: withdrawal.method,
        destination: withdrawal.destination,
        razorpayPayoutId: withdrawal.razorpay_payout_id,
        failureReason: withdrawal.failure_reason,
        requestedAt: withdrawal.created_at,
        approvedAt: withdrawal.approved_at,
        processedAt: withdrawal.processed_at,
        completedAt: withdrawal.completed_at,
        adminNotes: withdrawal.admin_notes,
      } : null,
    };
  });

// -------- Admin: Release Fund (admin only, transactional) --------
const adminReleaseFundSchema = z.object({ paymentId: z.string().uuid() });
export const adminReleaseFund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => adminReleaseFundSchema.parse(raw))
  .handler(async ({ data, context }) => {
    // 1. Enforce Admin only
    const { data: isAdmin } = await context.supabase.rpc("has_role" as any, {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      console.error(`[adminReleaseFund] [SECURITY AUDIT VIOLATION] Unauthorized release attempt for payment ${data.paymentId} by user ${context.userId}`);
      throw new Error("Unauthorized: Admin role required");
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 2. Get payment row and lock or inspect it
      const { data: payRowData, error: payErr } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("id", data.paymentId)
        .maybeSingle();

      if (payErr || !payRowData) {
        throw new Error("Payment transaction not found");
      }

      const payRow = payRowData as any;

      // 3. Validate payout status and status
      if (payRow.payout_status === "completed") {
        throw new Error("Duplicate release: Payout status is already completed");
      }
      if (payRow.status === "released" || payRow.status_v2 === "released") {
        throw new Error("Duplicate release: Payment has already been released");
      }
      if (payRow.status === "cancelled" || payRow.status_v2 === "cancelled") {
        throw new Error("Escrow violation: Cannot release cancelled payment");
      }
      if (payRow.status === "refunded" || payRow.status_v2 === "refunded") {
        throw new Error("Escrow violation: Cannot release refunded payment");
      }
      if (payRow.status_v2 !== "held" && payRow.status !== "held" && payRow.status !== "succeeded") {
        throw new Error("Escrow violation: Payment has not been received (status must be held)");
      }

      if (!payRow.campaign_id) {
        throw new Error("Payment has no linked campaign ID");
      }
      if (!payRow.contract_id) {
        throw new Error("Payment has no linked contract ID");
      }

      // 4. Get campaign
      const { data: campaignRow, error: campErr } = await supabaseAdmin
        .from("campaigns")
        .select("*")
        .eq("id", payRow.campaign_id)
        .maybeSingle();

      if (campErr || !campaignRow) {
        throw new Error("Linked campaign not found");
      }

      // 5. Get contract and validate advertiser approved deliverables
      const { data: contractRow, error: contractErr } = await supabaseAdmin
        .from("contracts")
        .select("*")
        .eq("id", payRow.contract_id)
        .maybeSingle();

      if (contractErr || !contractRow) {
        throw new Error("Linked contract not found");
      }

      if (contractRow.status !== "approved") {
        throw new Error("Escrow violation: Cannot release fund before advertiser approves deliverables");
      }

      // 6. Credit creator's wallet (using apply_wallet_txn RPC)
      const releaseAmt = payRow.creator_earnings || payRow.amount || 0;
      const { data: txnId, error: walletErr } = await supabaseAdmin.rpc("apply_wallet_txn" as any, {
        _user_id: payRow.payee_id,
        _type: "release",
        _amount: releaseAmt,
        _reference_type: "payment",
        _reference_id: data.paymentId,
        _description: "Funds released to available balance by admin",
      });

      if (walletErr) {
        console.error("[adminReleaseFund] Wallet credit failure:", walletErr.message);
        throw new Error(`Wallet transaction failed: ${walletErr.message}`);
      }

      // 7. Update payment status to released
      const { error: updatePayErr } = await supabaseAdmin
        .from("payments")
        .update({
          status: "released",
          payout_status: "completed",
          released_at: new Date().toISOString(),
          released_by: context.userId,
          status_v2: "released"
        } as any)
        .eq("id", data.paymentId);

      if (updatePayErr) {
        throw new Error(`Failed to update payment status: ${updatePayErr.message}`);
      }

      // 8. Complete contract and campaign
      await supabaseAdmin.from("contracts").update({ status: "completed" } as any).eq("id", payRow.contract_id);
      await supabaseAdmin.from("campaigns").update({ status: "closed" } as any).eq("id", payRow.campaign_id);

      // 9. Notification to creator
      await supabaseAdmin.from("notifications").insert({
        user_id: payRow.payee_id,
        title: "Payment Released",
        body: `Your payment for ${campaignRow.title} has been released successfully.`,
        type: "payment_released",
        payload: {
          payment_id: data.paymentId,
          campaign_id: payRow.campaign_id,
          contract_id: payRow.contract_id,
          amount: releaseAmt,
        },
      } as any);

      // 10. Audit Logging - Payment events
      await (supabaseAdmin as any).from("payment_events").insert({
        campaign_id: payRow.campaign_id,
        pitch_id: payRow.pitch_id || null,
        user_id: context.userId,
        event_type: "payment_released",
        metadata: {
          payment_id: data.paymentId,
          amount: releaseAmt,
          released_by: context.userId,
        },
      });

      // General activity audit trail
      await supabaseAdmin.from("activity_logs").insert({
        user_id: context.userId,
        action: "payment_released",
        entity_type: "payment",
        entity_id: data.paymentId,
        metadata: {
          amount: releaseAmt,
          campaign_id: payRow.campaign_id,
          contract_id: payRow.contract_id,
        },
      } as any);

      // 11. If a payout_transactions table exists, insert a payout history record
      try {
        await (supabaseAdmin as any).from("payout_transactions").insert({
          payment_id: data.paymentId,
          amount: releaseAmt,
          currency: payRow.currency,
          status: "completed",
          processed_by: context.userId,
        });
      } catch (e) {
        // Table might not exist, skip silently
      }

      // 12. Email notifications check
      console.log(`[adminReleaseFund] checking email notification dispatch... [INFO] No email client configured (Resend/SMTP), skipping email dispatch. Database notification saved successfully.`);

      console.log(`[adminReleaseFund] [AUDIT] Success: Released payment ${data.paymentId} (Amount: ₹${releaseAmt}) by Admin ${context.userId}`);
      return { success: true, paymentId: data.paymentId, amount: releaseAmt };
    } catch (err) {
      console.error(`[adminReleaseFund] [AUDIT] Exception thrown during release for payment ${data.paymentId}:`, err instanceof Error ? err.message : err);
      throw err;
    }
  });

// -------- Admin: Get Contract for Payment (bypasses RLS) --------
const getContractSchema = z.object({
  paymentId: z.string().uuid(),
  contractId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  payeeId: z.string().uuid().optional().nullable(),
});
export const adminGetContractForPayment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => getContractSchema.parse(raw))
  .handler(async ({ data, context }) => {
    // Enforce Admin only
    const { data: isAdmin } = await context.supabase.rpc("has_role" as any, {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Unauthorized: Admin role required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let result = null;

    // 1. Try explicit contractId
    if (data.contractId) {
      const { data: byId } = await supabaseAdmin
        .from("contracts")
        .select("id, status, submitted_at, reviewed_at, created_at, campaign_id, creator_id, advertiser_id")
        .eq("id", data.contractId)
        .maybeSingle();
      result = byId;
    }

    // 2. Fallback: try by payment_id match
    if (!result) {
      const { data: byPaymentId } = await supabaseAdmin
        .from("contracts")
        .select("id, status, submitted_at, reviewed_at, created_at, campaign_id, creator_id, advertiser_id")
        .eq("payment_id", data.paymentId)
        .maybeSingle();
      result = byPaymentId;
    }

    // 3. Fallback: query by campaignId AND creator_id (payeeId)
    if (!result && data.campaignId && data.payeeId) {
      const { data: byCampaignCreator } = await supabaseAdmin
        .from("contracts")
        .select("id, status, submitted_at, reviewed_at, created_at, campaign_id, creator_id, advertiser_id")
        .eq("campaign_id", data.campaignId)
        .eq("creator_id", data.payeeId)
        .maybeSingle();
      result = byCampaignCreator;
    }

    return result;
  });

// -------- Admin: Get Pending Releases (bypasses RLS) --------
export const adminGetPendingReleases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Enforce Admin only
    const { data: isAdmin } = await context.supabase.rpc("has_role" as any, {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Unauthorized: Admin role required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("contracts")
      .select(`
        id,
        title,
        amount,
        currency,
        reviewed_at,
        payment_id,
        campaign:campaign_id(id, title),
        advertiser:advertiser_id(display_name, avatar_url),
        creator:creator_id(display_name, avatar_url),
        payments:payment_id(created_at, status_v2)
      ` as any)
      .eq("status", "approved")
      .is("deleted_at", null);

    if (error) {
      console.error("[adminGetPendingReleases] Error fetching pending releases:", error.message);
      throw error;
    }

    return data ?? [];
  });
