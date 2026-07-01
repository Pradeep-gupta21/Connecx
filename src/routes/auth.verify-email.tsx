import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth/verify-email")({
  ssr: false,
  head: () => ({ meta: [{ title: "Verify your email · BrandBridge" }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user?.email_confirmed_at) {
      const role =
        (user.user_metadata?.role as "creator" | "advertiser" | undefined) ??
        "creator";
      navigate({
        to: role === "advertiser" ? "/dashboard/advertiser" : "/dashboard/creator",
        replace: true,
      });
    }
  }, [user, loading, navigate]);

  const resend = async () => {
    if (!user?.email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Verification email sent");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center">
          <Logo />
        </div>
      </header>
      <div className="flex-1 max-w-lg w-full mx-auto px-6 py-16">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
          <MailCheck className="h-5 w-5" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">
          Check your inbox
        </h1>
        <p className="mt-3 text-muted-foreground">
          We sent a verification link to{" "}
          <span className="text-foreground font-medium">{user?.email ?? "your email"}</span>.
          Click it to activate your BrandBridge account.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Didn't get it? Check spam, or resend below.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={resend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend email"}
          </Button>
          <Button variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}>
            Use a different account
          </Button>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Already verified?{" "}
          <Link to="/auth" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
