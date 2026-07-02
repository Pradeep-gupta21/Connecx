// Server-only Razorpay HTTP client. Uses Basic Auth with key_id:key_secret.
// Do NOT import this from anything client-reachable at module scope.
import { createHmac, timingSafeEqual } from "node:crypto";

const RZP_BASE = "https://api.razorpay.com/v1";

function getCreds() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials missing (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  }
  return { keyId, keySecret };
}

function authHeader(): string {
  const { keyId, keySecret } = getCreds();
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

async function rzpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${RZP_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = body as { error?: { description?: string; code?: string } } | null;
    throw new Error(
      `Razorpay ${path} failed (${res.status}): ${err?.error?.description ?? text}`,
    );
  }
  return body as T;
}

export interface RzpOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

export interface RzpRefund {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "processed" | "failed";
  payment_id: string;
}

export interface RzpPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export const razorpay = {
  publicKeyId(): string {
    return getCreds().keyId;
  },

  async createOrder(args: {
    amountMinor: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RzpOrder> {
    return rzpFetch<RzpOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: args.amountMinor,
        currency: args.currency,
        receipt: args.receipt,
        notes: args.notes ?? {},
        payment_capture: 1,
      }),
    });
  },

  async createRefund(args: {
    paymentId: string;
    amountMinor?: number;
    notes?: Record<string, string>;
  }): Promise<RzpRefund> {
    return rzpFetch<RzpRefund>(`/payments/${args.paymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({
        ...(args.amountMinor ? { amount: args.amountMinor } : {}),
        notes: args.notes ?? {},
      }),
    });
  },

  // Razorpay Payouts (RazorpayX) — requires account activation. Kept optional.
  async createPayout(args: {
    accountNumber: string;
    fundAccountId: string;
    amountMinor: number;
    currency: string;
    mode: "IMPS" | "NEFT" | "RTGS" | "UPI";
    purpose: string;
    referenceId: string;
  }): Promise<RzpPayout> {
    return rzpFetch<RzpPayout>("/payouts", {
      method: "POST",
      body: JSON.stringify({
        account_number: args.accountNumber,
        fund_account_id: args.fundAccountId,
        amount: args.amountMinor,
        currency: args.currency,
        mode: args.mode,
        purpose: args.purpose,
        queue_if_low_balance: true,
        reference_id: args.referenceId,
      }),
    });
  },

  verifyCheckoutSignature(args: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const { keySecret } = getCreds();
    const expected = createHmac("sha256", keySecret)
      .update(`${args.orderId}|${args.paymentId}`)
      .digest("hex");
    return safeEq(expected, args.signature);
  },

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEq(expected, signature);
  },
};

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
