// Browser-safe Razorpay Checkout loader. Loads the Razorpay JS SDK on demand
// and opens the checkout modal for a server-issued order.
import { toast } from "sonner";
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
  // If it's a mock key, bypass Razorpay SDK and show a premium simulated payment modal
  if (args.order.keyId.startsWith("rzp_test_mock")) {
    showMockPaymentModal({
      orderId: args.order.orderId,
      amount: args.order.amount,
      currency: args.order.currency,
      name: args.name ?? "Connecx",
      description: args.description,
      onSuccess: args.onSuccess,
      onDismiss: args.onDismiss,
    });
    return;
  }

  await loadSdk();
  if (!window.Razorpay) throw new Error("Razorpay SDK unavailable");

  // Guard against a live key leaking into a client that thinks it's in test mode.
  const keyMode: "test" | "live" = args.order.keyId.startsWith("rzp_live_") ? "live" : "test";
  if (keyMode !== args.order.mode) {
    throw new Error(
      `Razorpay key/mode mismatch: server said ${args.order.mode} but key prefix says ${keyMode}`,
    );
  }

  if (args.order.mode === "test") {
    toast.info("Test mode: pay UPI using Razorpay's on-screen Success button (real UPI apps will reject the test VPA).", {
      duration: 8000,
    });
  }

  console.info(
    `[razorpay] opening checkout mode=${args.order.mode} key_prefix=${args.order.keyId.slice(0, 9)} order=${args.order.orderId}`,
  );

  const rzp = new window.Razorpay({
    key: args.order.keyId,
    amount: args.order.amount,
    currency: args.order.currency,
    order_id: args.order.orderId,
    name: args.name ?? "Connecx",
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

// Renders a premium simulated payment modal in the DOM for local testing
function showMockPaymentModal(params: {
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  onSuccess: (r: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  onDismiss?: () => void;
}) {
  const amountFormatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: params.currency,
  }).format(params.amount / 100);

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "mock-payment-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99999",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(12px)",
    fontFamily: "Outfit, Inter, system-ui, sans-serif",
    transition: "opacity 0.3s ease",
    opacity: "0",
  });

  // Create modal container
  const modal = document.createElement("div");
  Object.assign(modal.style, {
    backgroundColor: "#18181b",
    color: "#fafafa",
    borderRadius: "20px",
    border: "1px solid #27272a",
    padding: "32px",
    maxWidth: "440px",
    width: "100%",
    margin: "0 16px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    transform: "scale(0.9)",
    transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
  });

  modal.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;">
      <div style="background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); color: white; padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
        Connecx Sandbox
      </div>
      <div>
        <h3 style="font-size: 22px; font-weight: 700; margin: 0 0 6px 0; font-family: Outfit, sans-serif;">Payment Simulation</h3>
        <p style="font-size: 13px; color: #a1a1aa; margin: 0;">${params.name} • ${params.description || "Campaign Funding"}</p>
      </div>
      
      <div style="background-color: #09090b; width: 100%; border-radius: 12px; padding: 20px; border: 1px solid #27272a; margin: 8px 0;">
        <div style="font-size: 12px; color: #71717a; margin-bottom: 4px; text-transform: uppercase; font-weight: 500;">Amount to pay</div>
        <div style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">${amountFormatted}</div>
        <div style="font-size: 11px; color: #52525b; margin-top: 8px; font-family: monospace; word-break: break-all;">Ref: ${params.orderId}</div>
      </div>

      <p style="font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0 0 8px 0;">
        No Razorpay keys are configured. You can simulate a successful merchant payment transaction or cancel it.
      </p>

      <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
        <button id="mock-btn-success" style="width: 100%; height: 48px; border-radius: 12px; border: none; background-color: #22c55e; color: #ffffff; font-weight: 600; font-size: 14px; cursor: pointer; transition: background-color 0.2s; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);">
          Simulate Payment Success
        </button>
        <button id="mock-btn-cancel" style="width: 100%; height: 48px; border-radius: 12px; border: 1px solid #3f3f46; background-color: transparent; color: #fafafa; font-weight: 600; font-size: 14px; cursor: pointer; transition: background-color 0.2s;">
          Cancel / Dismiss
        </button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Trigger animations
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    modal.style.transform = "scale(1)";
  });

  const cleanUp = () => {
    overlay.style.opacity = "0";
    modal.style.transform = "scale(0.9)";
    setTimeout(() => {
      overlay.remove();
    }, 300);
  };

  // Button handlers
  const successBtn = overlay.querySelector("#mock-btn-success") as HTMLButtonElement;
  const cancelBtn = overlay.querySelector("#mock-btn-cancel") as HTMLButtonElement;

  successBtn.onclick = () => {
    cleanUp();
    void params.onSuccess({
      razorpay_order_id: params.orderId,
      razorpay_payment_id: "pay_mock_" + Math.random().toString(36).substring(2, 15),
      razorpay_signature: "mock_signature_approved",
    });
  };

  cancelBtn.onclick = () => {
    cleanUp();
    if (params.onDismiss) params.onDismiss();
  };
}
