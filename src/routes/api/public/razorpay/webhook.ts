// Razorpay webhook endpoint. Public route — auth bypass — must verify
// the HMAC signature and de-duplicate events via payment_webhooks.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        const { razorpay } = await import("@/lib/payments/razorpay.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { PaymentService } = await import("@/lib/payments/service.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin: any = supabaseAdmin;

        let valid = false;
        try {
          valid = razorpay.verifyWebhookSignature(rawBody, signature);
        } catch (err) {
          console.error("[razorpay-webhook] verify error", err);
          return new Response("misconfigured", { status: 500 });
        }
        if (!valid) return new Response("invalid signature", { status: 401 });

        let event: {
          event: string;
          id?: string;
          payload?: Record<string, unknown>;
          created_at?: number;
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const eventId = event.id ?? `${event.event}:${event.created_at ?? Date.now()}`;

        // Upsert dedupe row — race-safe: concurrent deliveries never 500
        // each other; the existing row's `processed` flag decides work.
        const { data: upserted, error: upErr } = await admin
          .from("payment_webhooks")
          .upsert(
            {
              provider: "razorpay",
              event_id: eventId,
              event_type: event.event,
              signature,
              payload: event,
            },
            { onConflict: "provider,event_id", ignoreDuplicates: false },
          )
          .select("id, processed")
          .single();
        if (upErr || !upserted) {
          console.error("[razorpay-webhook] persist failed", upErr);
          return new Response("persist failed", { status: 500 });
        }
        if (upserted.processed) return new Response("ok", { status: 200 });
        const webhookRowId = upserted.id;

        try {
          await handleEvent(event, { admin, PaymentService });
          await admin
            .from("payment_webhooks")
            .update({ processed: true, processed_at: new Date().toISOString(), attempts: 1 })
            .eq("id", webhookRowId);
          return new Response("ok", { status: 200 });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[razorpay-webhook] handler failed", message);
          await admin
            .from("payment_webhooks")
            .update({ error: message })
            .eq("id", webhookRowId);
          return new Response("handler error", { status: 500 });
        }
      },
    },
  },
});

type Deps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  PaymentService: typeof import("@/lib/payments/service.server").PaymentService;
};

async function handleEvent(
  event: { event: string; payload?: Record<string, unknown> },
  { admin, PaymentService }: Deps,
) {
  const payload = (event.payload ?? {}) as Record<string, { entity?: Record<string, unknown> }>;

  switch (event.event) {
    case "payment.captured": {
      const pay = payload.payment?.entity as
        | { id: string; order_id: string; amount: number; fee?: number; tax?: number }
        | undefined;
      if (!pay?.order_id) return;
      const { data: row } = await admin
        .from("payments")
        .select("id, status_v2")
        .eq("razorpay_order_id", pay.order_id)
        .maybeSingle();
      if (!row) return;
      // Safety net for missed / lost client callback: run the same held +
      // ledger + campaign-funded + notify flow. finalizeCapture is CAS-guarded
      // and per-payment idempotent, so this is a no-op when the client already
      // finalized the payment.
      await PaymentService.finalizeCapture({
        paymentId: row.id,
        razorpayPaymentId: pay.id,
        fee: (pay.fee ?? 0) / 100,
        tax: (pay.tax ?? 0) / 100,
        source: "webhook",
      });
      return;
    }
    case "payment.failed": {
      const pay = payload.payment?.entity as
        | { id: string; order_id: string; error_description?: string }
        | undefined;
      if (!pay?.order_id) return;
      const { data: row } = await admin
        .from("payments")
        .select("id, status_v2")
        .eq("razorpay_order_id", pay.order_id)
        .maybeSingle();
      if (!row) return;
      await admin
        .from("payments")
        .update({
          status: "failed",
          status_v2: "failed",
          failure_reason: pay.error_description ?? null,
          razorpay_payment_id: pay.id,
        })
        .eq("id", row.id);
      await PaymentService._log({
        paymentId: row.id,
        action: "webhook.payment.failed",
        to: "failed",
        metadata: { reason: pay.error_description },
      });
      return;
    }
    case "refund.processed": {
      const refund = payload.refund?.entity as
        | { id: string; payment_id: string; amount: number }
        | undefined;
      if (!refund) return;
      const { data: refundRow } = await admin
        .from("refunds")
        .select("id")
        .eq("razorpay_refund_id", refund.id)
        .maybeSingle();
      if (!refundRow) return;
      await PaymentService.markRefundCompleted({ refundId: refundRow.id });
      return;
    }
    case "refund.failed": {
      const refund = payload.refund?.entity as
        | { id: string; payment_id: string; error_description?: string; status_details?: { reason?: string } }
        | undefined;
      if (!refund) return;
      const { data: refundRow } = await admin
        .from("refunds")
        .select("id")
        .eq("razorpay_refund_id", refund.id)
        .maybeSingle();
      if (!refundRow) return;
      await PaymentService.markRefundFailed({
        refundId: refundRow.id,
        reason: refund.error_description ?? refund.status_details?.reason,
      });
      return;
    }
    case "payout.processed": {
      const payout = payload.payout?.entity as
        | { id: string; amount: number; reference_id?: string; status: string }
        | undefined;
      if (!payout) return;
      const { data: wd } = await admin
        .from("withdrawals")
        .select("id")
        .or(`payout_id.eq.${payout.id},razorpay_payout_id.eq.${payout.id}`)
        .maybeSingle();
      if (!wd) return;

      await PaymentService.markWithdrawalCompleted({
        withdrawalId: wd.id,
        payoutRef: payout.id,
      });
      return;
    }
    case "payout.failed":
    case "payout.reversed": {
      const payout = payload.payout?.entity as
        | { id: string; failure_reason?: string; status_details?: { reason?: string } }
        | undefined;
      if (!payout) return;
      const { data: wd } = await admin
        .from("withdrawals")
        .select("id")
        .or(`payout_id.eq.${payout.id},razorpay_payout_id.eq.${payout.id}`)
        .maybeSingle();
      if (!wd) return;
      await PaymentService.markWithdrawalFailed({
        withdrawalId: wd.id,
        reason: payout.failure_reason ?? payout.status_details?.reason,
      });
      return;
    }
    default:
      return;
  }
}
