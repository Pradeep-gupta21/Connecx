import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/common/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { COUNTRIES, dialFor } from "@/lib/countries";
import { cn } from "@/lib/utils";

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

const signUpSchema = z.object({
  display_name: z.string().min(2, "Tell us your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  role: z.enum(["creator", "advertiser"], { required_error: "Pick a role" }),
  country: z.string().min(2, "Pick your country"),
  phone: z
    .string()
    .min(6, "Enter your phone number")
    .regex(/^[0-9\s\-().]+$/, "Digits only"),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (loading || !user) return;
    if (!user.email_confirmed_at) {
      navigate({ to: "/auth/verify-email", replace: true });
      return;
    }
    const role = (user.user_metadata?.role as "creator" | "advertiser" | undefined) ?? "creator";
    navigate({
      to: role === "advertiser" ? "/dashboard/advertiser" : "/dashboard/creator",
      replace: true,
    });
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
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} BrandBridge</p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8"><Logo /></div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-8"><SignInForm /></TabsContent>
            <TabsContent value="signup" className="mt-8"><SignUpForm /></TabsContent>
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
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (result.error) {
      toast.error("Couldn't sign in with Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
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
    // Redirect handled by AuthPage effect (checks email verification + role).
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
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="signin-password">Password</Label>
              <Link to="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </div>
            <Input id="signin-password" type="password" autoComplete="current-password" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
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
    defaultValues: { display_name: "", email: "", password: "", role: undefined as any, country: "", phone: "" },
  });

  const role = form.watch("role");
  const country = form.watch("country");
  const dial = dialFor(country);

  const onSubmit = form.handleSubmit(async (values) => {
    const phoneDigits = values.phone.replace(/[^0-9]/g, "");
    const e164 = `${dialFor(values.country)}${phoneDigits}`;

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: values.display_name,
          role: values.role,
          country: values.country,
          phone: e164,
        },
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — check your inbox to verify");
    navigate({ to: "/auth/verify-email", replace: true });
  });

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Create your account</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Choose your primary workspace — you can add the other later.</p>
      <div className="mt-6">
        <GoogleButton />
        <Divider />
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>I'm joining as</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: "creator", label: "Creator", icon: Sparkles, desc: "Pitch & get hired" },
                    { v: "advertiser", label: "Advertiser", icon: Building2, desc: "Run campaigns" },
                  ] as const).map((opt) => {
                    const Icon = opt.icon;
                    const active = field.value === opt.v;
                    return (
                      <button
                        type="button"
                        key={opt.v}
                        onClick={() => field.onChange(opt.v)}
                        className={cn(
                          "text-left p-3 rounded-lg border transition-all",
                          active ? "border-foreground bg-secondary" : "border-border hover:border-foreground/30"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{opt.label}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {form.formState.errors.role && <p className="text-xs text-destructive">{form.formState.errors.role.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-name">Full name</Label>
            <Input id="signup-name" autoComplete="name" {...form.register("display_name")} />
            {form.formState.errors.display_name && <p className="text-xs text-destructive">{form.formState.errors.display_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" type="email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input id="signup-password" type="password" autoComplete="new-password" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Country</Label>
              <Controller
                control={form.control}
                name="country"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          <span className="mr-2 text-muted-foreground">{c.dial}</span>{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.country && <p className="text-xs text-destructive">{form.formState.errors.country.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">Phone</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-secondary text-sm text-muted-foreground min-w-14 justify-center">
                  {dial || "+—"}
                </span>
                <Input
                  id="signup-phone"
                  type="tel"
                  autoComplete="tel"
                  className="rounded-l-none"
                  {...form.register("phone")}
                />
              </div>
              {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || !role}>
            {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            We'll send a verification link to your email.
          </p>
        </form>
      </div>
    </div>
  );
}
