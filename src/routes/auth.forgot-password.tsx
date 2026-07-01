import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/common/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/forgot-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reset password · BrandBridge" }] }),
  component: ForgotPasswordPage,
});

const schema = z.object({ email: z.string().email("Enter a valid email") });

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) return toast.error(error.message);
    setSent(true);
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center">
          <Logo />
        </div>
      </header>
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-16">
        {sent ? (
          <div>
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
              <MailCheck className="h-5 w-5" />
            </div>
            <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">
              Check your inbox
            </h1>
            <p className="mt-3 text-muted-foreground">
              If an account exists for that email, we've sent a link to reset your password.
            </p>
            <Link to="/auth" className="mt-8 inline-block text-sm underline underline-offset-4">
              Back to sign in
            </Link>
          </div>
        ) : (
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Forgot password</h1>
            <p className="mt-2 text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
              </Button>
            </form>
            <Link to="/auth" className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground">
              ← Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
