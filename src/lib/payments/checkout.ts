// Browser-safe Razorpay Checkout loader. Loads the Razorpay JS SDK on demand
// and opens the checkout modal for a server-issued order.
import type { CreateOrderResult } from "./types";

const SDK_URL = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void; escape?: boolean };
}

let loading: Promise<void> | undefined;

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(s);
  });
  return loading;
}

export async function openRazorpayCheckout(args: {
  order: CreateOrderResult;
  name?: string;
  description?: string;
  prefill?: RazorpayOptions["prefill"];
  onSuccess: (r: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  onDismiss?: () => void;
}) {
  await loadSdk();
  if (!window.Razorpay) throw new Error("Razorpay SDK unavailable");
  const rzp = new window.Razorpay({
    key: args.order.keyId,
    amount: args.order.amount,
    currency: args.order.currency,
    order_id: args.order.orderId,
    name: args.name ?? "BrandBridge",
    description: args.description,
    prefill: args.prefill,
    theme: { color: "#111111" },
    modal: { ondismiss: args.onDismiss, escape: true },
    handler: (response) => {
      void args.onSuccess(response);
    },
  });
  rzp.open();
}
