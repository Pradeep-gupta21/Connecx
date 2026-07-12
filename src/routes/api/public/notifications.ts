import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional verification header to secure the endpoint from external abuse
        const secret = request.headers.get("x-webhook-secret");
        const expectedSecret = process.env.WEBHOOK_SECRET || "connecx-db-secret-key-123";
        if (secret && secret !== expectedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const body = await request.json();
          const { record, type } = body;

          if (type === "INSERT" && record && record.user_id) {
            const { sendPushNotification } = await import("@/lib/push.server");
            await sendPushNotification(
              record.user_id,
              record.title || "Connecx Alert",
              record.body || "",
              record.payload
            );
          }

          return new Response("OK", { status: 200 });
        } catch (err: any) {
          console.error("Error processing database webhook for notifications:", err);
          return new Response(err.message || "Error", { status: 500 });
        }
      },
    },
  },
});
