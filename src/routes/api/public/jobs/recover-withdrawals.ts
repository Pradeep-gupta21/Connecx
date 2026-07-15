import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/jobs/recover-withdrawals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret");
        const expectedSecret = process.env.JOB_SECRET_KEY;
        
        if (expectedSecret && secret !== expectedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { PaymentService } = await import("@/lib/payments/service.server");
          const result = await PaymentService.recoverProcessingWithdrawals();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[recover-withdrawals-job] failed", e);
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret");
        const expectedSecret = process.env.JOB_SECRET_KEY;
        
        if (expectedSecret && secret !== expectedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { PaymentService } = await import("@/lib/payments/service.server");
          const result = await PaymentService.recoverProcessingWithdrawals();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[recover-withdrawals-job] failed", e);
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
