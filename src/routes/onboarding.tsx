import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace, type AppRole } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Get started · BrandBridge" }],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const { profile } = useWorkspace();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Set<AppRole>>(new Set());
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile?.display_name && !displayName) setDisplayName(profile.display_name);
  }, [profile, displayName]);

  const toggleRole = (r: AppRole) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(r)) n.delete(r);
      else n.add(r);
      return n;
    });
  };

  const finish = async () => {
    if (!user) return;
    if (selected.size === 0) {
      toast.error("Pick at least one workspace");
      return;
    }
    setSaving(true);
    try {
      const roleRows = Array.from(selected).map((role) => ({ user_id: user.id, role }));
      const { error: rolesErr } = await supabase.from("user_roles").upsert(roleRows, {
        onConflict: "user_id,role",
      });
      if (rolesErr) throw rolesErr;

      const active: AppRole = selected.has("advertiser") ? "advertiser" : "creator";
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || null,
          bio: bio || null,
          location: location || null,
          active_role: active,
          onboarded: true,
        })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      // Stub creator/advertiser profile rows so editing later is friction-free
      if (selected.has("creator")) {
        await supabase.from("creator_profiles").upsert({ user_id: user.id }, { onConflict: "user_id" });
      }
      if (selected.has("advertiser")) {
        await supabase
          .from("advertiser_profiles")
          .upsert({ user_id: user.id, brand_name: displayName }, { onConflict: "user_id" });
      }

      toast.success("You're in");
      navigate({ to: "/dashboard", replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't save your profile";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <p className="text-xs text-muted-foreground">Step {step} of 2</p>
        </div>
      </header>

      <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-14">
        {step === 1 ? (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Welcome</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              How will you use BrandBridge?
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl">
              Pick one or both. You can switch workspaces anytime.
            </p>

            <div className="mt-10 grid md:grid-cols-2 gap-4">
              {([
                {
                  role: "advertiser" as const,
                  icon: Building2,
                  title: "I'm an advertiser",
                  body: "Run campaigns and discover creators that match your brand.",
                },
                {
                  role: "creator" as const,
                  icon: Sparkles,
                  title: "I'm a creator",
                  body: "Build a profile, browse briefs, and pitch the brands you want.",
                },
              ]).map((opt) => {
                const active = selected.has(opt.role);
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.role}
                    type="button"
                    onClick={() => toggleRole(opt.role)}
                    className={cn(
                      "text-left p-6 rounded-2xl border transition-all hover:-translate-y-px",
                      active
                        ? "border-foreground bg-secondary shadow-soft"
                        : "border-border bg-card hover:border-foreground/30"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span
                        className={cn(
                          "h-5 w-5 rounded-full border flex items-center justify-center transition",
                          active ? "bg-foreground border-foreground" : "border-border"
                        )}
                      >
                        {active && <Check className="h-3 w-3 text-background" />}
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-lg font-semibold">{opt.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{opt.body}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-10 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={selected.size === 0}>
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">About you</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              The essentials
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl">
              You can fill out the rest of your profile later.
            </p>

            <div className="mt-10 space-y-5 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Lisbon, Portugal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Short bio</Label>
                <Textarea
                  id="bio"
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A line or two about you or your brand."
                />
              </div>
            </div>

            <div className="mt-10 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
                Back
              </Button>
              <Button onClick={finish} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter BrandBridge"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
