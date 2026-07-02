// Payment workflow hooks: fund campaign, deliverables review, admin withdrawal.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  fundCampaign,
  previewCampaignFees,
  verifyPayment,
  acceptCreator,
  submitDeliverables,
  reviewDeliverables,
  adminReviewWithdrawal,
  adminMarkWithdrawalCompleted,
} from "@/lib/payments/payments.functions";
import { openRazorpayCheckout } from "@/lib/payments/checkout";
import type { FeeBreakdown } from "@/lib/payments/types";

export function useFeePreview(budget: number | null, feePct = 10, gstPct = 18) {
  const fn = useServerFn(previewCampaignFees);
  return useQuery<FeeBreakdown | null>({
    queryKey: ["fee-preview", budget, feePct, gstPct],
    enabled: !!budget && budget > 0,
    queryFn: () =>
      fn({ data: { budget: budget!, platformFeePct: feePct, gstPct } }) as Promise<FeeBreakdown>,
    staleTime: 60_000,
  });
}

export function useFundCampaign(campaignName?: string) {
  const fund = useServerFn(fundCampaign);
  const verify = useServerFn(verifyPayment);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const order = await fund({ data: { campaignId } });
      return new Promise<{ paymentId: string }>((resolve, reject) => {
        openRazorpayCheckout({
          order,
          name: "BrandBridge",
          description: campaignName ?? "Fund campaign",
          onSuccess: async (r) => {
            try {
              const res = await verify({ data: r });
              resolve({ paymentId: res.paymentId });
            } catch (e) { reject(e); }
          },
          onDismiss: () => reject(new Error("Payment cancelled")),
        });
      });
    },
    onSuccess: () => {
      toast.success("Campaign funded — funds are held in escrow");
      qc.invalidateQueries({ queryKey: ["campaign"] });
      qc.invalidateQueries({ queryKey: ["payment-history"] });
    },
    onError: (e: Error) => {
      if (e.message !== "Payment cancelled") toast.error(e.message);
    },
  });
}

export function useAcceptCreator() {
  const fn = useServerFn(acceptCreator);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { campaignId: string; applicationId: string; creatorId: string }) =>
      fn({ data }),
    onSuccess: () => {
      toast.success("Creator accepted — contract created");
      qc.invalidateQueries({ queryKey: ["campaign"] });
      qc.invalidateQueries({ queryKey: ["campaign-apps"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSubmitDeliverables() {
  const fn = useServerFn(submitDeliverables);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { contractId: string; urls: { name: string; url: string }[]; notes?: string }) =>
      fn({ data }),
    onSuccess: () => {
      toast.success("Deliverables submitted for review");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contract"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReviewDeliverables() {
  const fn = useServerFn(reviewDeliverables);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { contractId: string; decision: "approve" | "revision"; notes?: string }) =>
      fn({ data }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "approve" ? "Approved — funds released" : "Revision requested");
      qc.invalidateQueries({ queryKey: ["contract"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["payment-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAdminReviewWithdrawal() {
  const fn = useServerFn(adminReviewWithdrawal);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { withdrawalId: string; action: "approve" | "reject"; notes?: string; triggerPayout?: boolean }) =>
      fn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAdminMarkWithdrawalCompleted() {
  const fn = useServerFn(adminMarkWithdrawalCompleted);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { withdrawalId: string; payoutRef?: string }) => fn({ data }),
    onSuccess: () => {
      toast.success("Marked as completed");
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
