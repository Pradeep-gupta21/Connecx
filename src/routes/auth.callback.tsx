import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "Signing you in… · BrandBridge" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
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

      // Give AuthProvider a tick to hydrate.
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
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

      navigate({ to: "/dashboard", replace: true });
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
