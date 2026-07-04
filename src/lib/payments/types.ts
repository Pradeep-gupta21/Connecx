// Payment domain types. Safe to import from client or server.

export type PaymentStatus =
  | "pending"
  | "paid"
  | "held"
  | "revision_requested"
  | "released"
  | "withdrawal_requested"
  | "withdrawn"
  | "refund_pending"
  | "refunded"
  | "cancelled"
  | "failed";

export type WalletTxnType =
  | "credit"
  | "debit"
  | "hold"
  | "release"
  | "withdrawal"
  | "refund"
  | "fee"
  | "adjustment";

export type WithdrawalStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type RefundStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface CreateOrderInput {
  amount: number; // in major unit (e.g. INR rupees)
  currency?: string;
  contractId?: string;
  campaignId?: string;
  payeeId: string;
  notes?: Record<string, string>;
}

export type RazorpayMode = "test" | "live";

export interface CreateOrderResult {
  orderId: string; // razorpay order id
  paymentId: string; // internal payments.id
  amount: number; // minor unit (paise)
  currency: string;
  keyId: string; // public razorpay key
  mode: RazorpayMode; // derived from the key id prefix
}


export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface WalletSnapshot {
  id: string;
  currency: string;
  available_balance: number;
  held_balance: number;
  pending_balance: number;
  withdrawn_balance: number;
  lifetime_earned: number;
}

export interface FeeBreakdown {
  subtotal: number;
  platform_fee: number;
  gst: number;
  creator_earnings: number;
  total_payable: number;
  platform_fee_pct: number;
  gst_pct: number;
  currency: string;
}

