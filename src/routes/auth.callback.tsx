import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "Signing you in… · Connecx" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const codeType = searchParams.get("type");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message);
          navigate({ to: "/auth", replace: true });
          return;
        }
        if (codeType === "recovery") {
          navigate({ to: "/auth/reset-password", replace: true });
          return;
        }
      } else {
        // Supabase places tokens in the URL hash on verification/OAuth redirects.
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const type = params.get("type");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            toast.error(error.message);
            navigate({ to: "/auth", replace: true });
            return;
          }
          if (type === "recovery") {
            navigate({ to: "/auth/reset-password", replace: true });
            return;
          }
        }
      }

      // Give AuthProvider a tick to hydrate.
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }

      // Check if profile exists, if not create it
      const { data: existingProfile, error: getProfileError } = await supabase
        .from("profiles")
        .select("id, onboarded, active_role")
        .eq("id", data.user.id)
        .maybeSingle();

      let profileData = existingProfile;

      if (!profileData) {
        const defaultRole = data.user.user_metadata?.role || "creator";
        const fallbackDisplayName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split("@")[0] || "New User";
        const fallbackCountry = data.user.user_metadata?.country || null;
        const fallbackPhone = data.user.user_metadata?.phone || null;

        const { data: inserted, error: insertProfileError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            display_name: fallbackDisplayName,
            avatar_url: data.user.user_metadata?.avatar_url || null,
            country: fallbackCountry,
            phone: fallbackPhone,
            active_role: defaultRole,
            onboarded: false
          })
          .select("id, onboarded, active_role")
          .maybeSingle();

        if (!insertProfileError && inserted) {
          profileData = inserted;
        }

        // Also ensure user_roles exists
        await supabase
          .from("user_roles")
          .insert({
            user_id: data.user.id,
            role: defaultRole
          });
      }

      // Admins go straight to the admin console — never through onboarding.
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      if (roleRows?.some((r) => r.role === "admin")) {
        navigate({ to: "/admin", replace: true });
        return;
      }

      // Preserve any redirectTo parameter if present, but default to the onboarding/dashboard flow
      const redirectTo = searchParams.get("redirectTo") || searchParams.get("next");
      if (redirectTo) {
        try {
          const url = new URL(redirectTo, window.location.origin);
          if (url.origin === window.location.origin) {
            navigate({ to: url.pathname + url.search + url.hash, replace: true });
            return;
          }
        } catch (_) {
          if (redirectTo.startsWith("/")) {
            navigate({ to: redirectTo, replace: true });
            return;
          }
        }
      }

      if (profileData) {
        if (!profileData.onboarded) {
          navigate({ to: "/onboarding", replace: true });
        } else {
          const role = profileData.active_role || "creator";
          if (role === "admin") {
            navigate({ to: "/admin", replace: true });
          } else if (role === "advertiser") {
            navigate({ to: "/dashboard/advertiser", replace: true });
          } else {
            navigate({ to: "/dashboard/creator", replace: true });
          }
        }
      } else {
        navigate({ to: "/onboarding", replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Signing you in…
      </div>
    </div>
  );
}
