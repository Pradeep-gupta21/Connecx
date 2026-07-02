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
        const { admin } = await import("@/integrations/supabase/client.server");
        const { PaymentService } = await import("@/lib/payments/service.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin: any = admin;

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

        // Idempotency: insert-or-ignore into payment_webhooks.
        const { data: existing } = await admin
          .from("payment_webhooks")
          .select("id, processed")
          .eq("provider", "razorpay")
          .eq("event_id", eventId)
          .maybeSingle();

        let webhookRowId: string;
        if (existing) {
          if (existing.processed) return new Response("ok", { status: 200 });
          webhookRowId = existing.id;
        } else {
          const { data: inserted, error: insErr } = await admin
            .from("payment_webhooks")
            .insert({
              provider: "razorpay",
              event_id: eventId,
              event_type: event.event,
              signature,
              payload: event,
            })
            .select("id")
            .single();
          if (insErr || !inserted) {
            console.error("[razorpay-webhook] persist failed", insErr);
            return new Response("persist failed", { status: 500 });
          }
          webhookRowId = inserted.id;
        }

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
          await admin.rpc; // no-op guard
          await admin
            .from("payment_webhooks")
            .update({ error: message })
            .eq("id", webhookRowId);
          // 500 asks Razorpay to retry.
          return new Response("handler error", { status: 500 });
        }
      },
    },
  },
});

type Deps = {
  admin: typeof import("@/integrations/supabase/client.server").admin;
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
        .select("id, amount, currency, payee_id, status_v2")
        .eq("razorpay_order_id", pay.order_id)
        .maybeSingle();
      if (!row) return;
      if (row.status_v2 === "held" || row.status_v2 === "released") return;
      await admin
        .from("payments")
        .update({
          status: "held",
          status_v2: "held",
          razorpay_payment_id: pay.id,
          fee: (pay.fee ?? 0) / 100,
          tax: (pay.tax ?? 0) / 100,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await PaymentService.applyWalletTxn({
        userId: row.payee_id,
        type: "hold",
        amount: Number(row.amount),
        referenceType: "payment",
        referenceId: row.id,
        description: "Funds held (webhook)",
      });
      await PaymentService.log({
        paymentId: row.id,
        action: "webhook.payment.captured",
        to: "held",
        metadata: { razorpay_payment_id: pay.id },
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
      await PaymentService.log({
        paymentId: row.id,
        action: "webhook.payment.failed",
        from: row.status_v2 as never,
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
        .select("id, payment_id, amount, status")
        .eq("razorpay_refund_id", refund.id)
        .maybeSingle();
      if (!refundRow) return;
      if (refundRow.status === "completed") return;
      await admin
        .from("refunds")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", refundRow.id);
      const { data: pay } = await admin
        .from("payments")
        .select("id, amount, payee_id")
        .eq("id", refundRow.payment_id)
        .single();
      if (pay) {
        await admin
          .from("payments")
          .update({ status: "refunded", status_v2: "refunded" })
          .eq("id", pay.id);
        // Reverse the held balance for the payee (best-effort).
        await PaymentService.applyWalletTxn({
          userId: pay.payee_id,
          type: "refund",
          amount: Number(refundRow.amount),
          referenceType: "refund",
          referenceId: refundRow.id,
          description: "Refund processed",
        });
        await PaymentService.log({
          paymentId: pay.id,
          action: "webhook.refund.processed",
          to: "refunded",
          metadata: { refund_id: refundRow.id },
        });
      }
      return;
    }
    case "payout.processed": {
      const payout = payload.payout?.entity as
        | { id: string; amount: number; reference_id?: string; status: string }
        | undefined;
      if (!payout) return;
      const { data: wd } = await admin
        .from("withdrawals")
        .select("id, status")
        .eq("razorpay_payout_id", payout.id)
        .maybeSingle();
      if (!wd) return;
      if (wd.status === "completed") return;
      await admin
        .from("withdrawals")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", wd.id);
      return;
    }
    default:
      // Unknown event type — persisted for audit, no action.
      return;
  }
}
