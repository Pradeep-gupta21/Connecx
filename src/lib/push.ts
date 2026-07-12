import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BOGtkatL_gSF1Lu2CvgXjYB3XZlV_VuijcHvLXqkOSxXX0P36ixRbzC36naeK0H_9VF5sQ5A5eOZPFC81xohY-U";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications are not supported in this browser.");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if subscription already exists
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    const jsonSub = subscription.toJSON();
    if (!jsonSub.endpoint || !jsonSub.keys?.p256dh || !jsonSub.keys?.auth) {
      throw new Error("Invalid push subscription structure returned by browser.");
    }

    // Upsert subscription into Supabase push_subscriptions table
    const { error } = await supabase.from("push_subscriptions" as any).upsert({
      user_id: userId,
      endpoint: jsonSub.endpoint,
      keys_p256dh: jsonSub.keys.p256dh,
      keys_auth: jsonSub.keys.auth,
    }, {
      onConflict: "user_id,endpoint"
    });

    if (error) {
      console.error("Failed to store push subscription on server:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error subscribing to push notifications:", err);
    return false;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // Remove from database
      const endpoint = subscription.endpoint;
      await supabase
        .from("push_subscriptions" as any)
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);

      // Unsubscribe from browser push manager
      await subscription.unsubscribe();
    }
    return true;
  } catch (err) {
    console.error("Error unsubscribing from push notifications:", err);
    return false;
  }
}
