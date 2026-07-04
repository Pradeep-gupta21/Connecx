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

  // Guard against a live key leaking into a client that thinks it's in test mode.
  const keyMode: "test" | "live" = args.order.keyId.startsWith("rzp_live_") ? "live" : "test";
  if (keyMode !== args.order.mode) {
    throw new Error(
      `Razorpay key/mode mismatch: server said ${args.order.mode} but key prefix says ${keyMode}`,
    );
  }

  // Visible in the browser console so QA can confirm which environment the SDK opened in.
  console.info(
    `[razorpay] opening checkout mode=${args.order.mode} key_prefix=${args.order.keyId.slice(0, 9)} order=${args.order.orderId}`,
  );

  const rzp = new window.Razorpay({
    key: args.order.keyId,
    amount: args.order.amount,
    currency: args.order.currency,
    order_id: args.order.orderId,
    name: args.name ?? "BrandBridge",
    description: args.description,
    prefill: args.prefill,
    theme: { color: "#111111" },
    // Note: we intentionally do NOT pass a `method.upi.vpa` or any custom
    // UPI ID. Razorpay must generate the VPA / intent itself — passing one
    // leads to "Invalid UPI ID" in third-party UPI apps.
    modal: { ondismiss: args.onDismiss, escape: true },
    handler: (response) => {
      void args.onSuccess(response);
    },
  });
  rzp.open();
}

