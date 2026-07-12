import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || "BOGtkatL_gSF1Lu2CvgXjYB3XZlV_VuijcHvLXqkOSxXX0P36ixRbzC36naeK0H_9VF5sQ5A5eOZPFC81xohY-U";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "lDiL9kzrGQCyqjYfk04yewrPVFwjzpGYv9pj7AGIA7Y";

try {
  webpush.setVapidDetails(
    "mailto:support@connecx.co",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (e) {
  console.error("Failed to set VAPID details for web-push:", e);
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  payload?: any
) {
  try {
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions" as any)
      .select("endpoint, keys_p256dh, keys_auth")
      .eq("user_id", userId);

    if (error || !subs || subs.length === 0) {
      return;
    }

    const pushPayload = JSON.stringify({
      title,
      body,
      payload: payload || {},
    });

    const sendPromises = subs.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
      } catch (err: any) {
        // If the subscription is no longer active (410 Gone / 404 Not Found), clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin
            .from("push_subscriptions" as any)
            .delete()
            .eq("user_id", userId)
            .eq("endpoint", sub.endpoint);
        } else {
          console.error("Failed to send push notification to endpoint:", sub.endpoint, err);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (err) {
    console.error("Error in sendPushNotification:", err);
  }
}
