// Wallet + payment history hooks. Server functions are auth-gated;
// bearer attaches automatically via the registered functionMiddleware.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createPaymentOrder,
  createRefund,
  createWithdrawal,
  getPaymentHistory,
  getWallet,
  getWalletHistory,
  releasePayment,
  verifyPayment,
} from "@/lib/payments/payments.functions";
import { openRazorpayCheckout } from "@/lib/payments/checkout";
import type { CreateOrderInput } from "@/lib/payments/types";

export function useWallet() {
  const fn = useServerFn(getWallet);
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => fn(),
    staleTime: 15_000,
  });
}

export function useWalletHistory(limit = 50) {
  const fn = useServerFn(getWalletHistory);
  return useQuery({
    queryKey: ["wallet-history", limit],
    queryFn: () => fn({ data: { limit, offset: 0 } }),
  });
}

export function usePaymentHistory(limit = 50) {
  const fn = useServerFn(getPaymentHistory);
  return useQuery({
    queryKey: ["payment-history", limit],
    queryFn: () => fn({ data: { limit, offset: 0 } }),
  });
}

export function useCheckout() {
  const create = useServerFn(createPaymentOrder);
  const verify = useServerFn(verifyPayment);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOrderInput & { name?: string; description?: string }) => {
      const order = await create({ data: input });
      return new Promise<{ paymentId: string }>((resolve, reject) => {
        openRazorpayCheckout({
          order,
          name: input.name,
          description: input.description,
          onSuccess: async (r) => {
            try {
              const res = await verify({ data: r });
              resolve({ paymentId: res.paymentId });
            } catch (e) {
              reject(e);
            }
          },
          onDismiss: () => reject(new Error("Payment cancelled")),
        });
      });
    },
    onSuccess: () => {
      toast.success("Payment successful");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["payment-history"] });
    },
    onError: (e: Error) => {
      if (e.message !== "Payment cancelled") toast.error(e.message);
    },
  });
}

export function useWithdrawal() {
  const fn = useServerFn(createWithdrawal);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; payoutMethodId: string }) => fn({ data }),
    onSuccess: () => {
      toast.success("Withdrawal requested");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRefund() {
  const fn = useServerFn(createRefund);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { paymentId: string; amount?: number; reason?: string }) => fn({ data }),
    onSuccess: () => {
      toast.success("Refund request submitted — awaiting admin review");
      qc.invalidateQueries({ queryKey: ["payment-history"] });
      qc.invalidateQueries({ queryKey: ["admin-refunds"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReleasePayment() {
  const fn = useServerFn(releasePayment);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => fn({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Funds released");
      qc.invalidateQueries({ queryKey: ["payment-history"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
