import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/common/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · BrandBridge" },
      { name: "description", content: "Sign in or create your BrandBridge account." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});
const signUpSchema = signInSchema.extend({
  display_name: z.string().min(2, "Tell us your name"),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 bg-surface border-r border-border">
        <Logo />
        <div className="space-y-6 max-w-md">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            BrandBridge
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
            Where ambitious brands and the right creators find each other.
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            One workspace for campaigns, pitches, and conversations — built for both sides.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} BrandBridge
        </p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8">
            <Logo />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-8">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-8">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Couldn't sign in with Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    // signed in via popup; session set by helper, AuthProvider will pick it up
  };
  return (
    <Button type="button" variant="outline" className="w-full" onClick={handle} disabled={busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 7.9-21.1l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0 1 12.7 28l-6.6 5A20 20 0 0 0 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.5l6.3 5.3C41.4 35.6 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z" />
        </svg>
      )}
      Continue with Google
    </Button>
  );
}

function Divider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
      <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">or</span></div>
    </div>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  });

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your BrandBridge workspace.</p>
      <div className="mt-6">
        <GoogleButton />
        <Divider />
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input id="signin-email" type="email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <Input id="signin-password" type="password" autoComplete="current-password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function SignUpForm() {
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", display_name: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { full_name: values.display_name },
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — let's set things up");
    navigate({ to: "/onboarding", replace: true });
  });

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Create your account</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Pick advertiser, creator, or both — next step.</p>
      <div className="mt-6">
        <GoogleButton />
        <Divider />
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-name">Full name</Label>
            <Input id="signup-name" autoComplete="name" {...form.register("display_name")} />
            {form.formState.errors.display_name && (
              <p className="text-xs text-destructive">{form.formState.errors.display_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" type="email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input id="signup-password" type="password" autoComplete="new-password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
