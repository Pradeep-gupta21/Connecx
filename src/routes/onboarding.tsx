import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace, type AppRole } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { CREATOR_CATEGORIES, INDUSTRIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Complete your profile · BrandBridge" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const { profile, activeRole } = useWorkspace();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");

  // Creator
  const [headline, setHeadline] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");

  // Advertiser
  const [brand, setBrand] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading) return;
    if (user && !user.email_confirmed_at) {
      navigate({ to: "/auth/verify-email", replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setLocation(profile.location ?? "");
    }
  }, [profile]);

  const role: AppRole = activeRole ?? "creator";

  const toggleCategory = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const finish = async () => {
    if (!user) return;
    if (!displayName.trim()) return toast.error("Add a display name");
    if (role === "creator" && categories.length === 0) {
      return toast.error("Pick at least one category");
    }
    if (role === "advertiser" && !brand.trim()) {
      return toast.error("Add your brand name");
    }
    setSaving(true);
    try {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          bio: bio || null,
          location: location || null,
          onboarded: true,
        })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      if (role === "creator") {
        const { error } = await supabase.from("creator_profiles").upsert(
          {
            user_id: user.id,
            headline: headline || null,
            categories,
            rate_min: rateMin ? Number(rateMin) : null,
            rate_max: rateMax ? Number(rateMax) : null,
            available: true,
            availability_status: "available",
            approval_status: "approved",
            approved_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.from("advertiser_profiles").upsert(
          {
            user_id: user.id,
            brand_name: brand,
            industry: industry || null,
            website: website || null,
          },
          { onConflict: "user_id" }
        );
        if (error) throw error;
      }

      toast.success("You're all set");
      navigate({
        to: role === "advertiser" ? "/dashboard/advertiser" : "/dashboard/creator",
        replace: true,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your profile");
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
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">The basics</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              Tell us about you
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl">
              This is what other {role === "advertiser" ? "creators" : "brands"} will see first.
            </p>

            <div className="mt-10 space-y-5 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lisbon, Portugal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Short bio</Label>
                <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line or two about you or your brand." />
              </div>
            </div>

            <div className="mt-10 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!displayName.trim()}>Continue</Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {role === "creator" ? "Your creator profile" : "Your brand"}
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              {role === "creator" ? "How you work" : "About your brand"}
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl">
              You can refine this later in Settings.
            </p>

            <div className="mt-10 space-y-6 max-w-lg">
              {role === "creator" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="headline">Headline</Label>
                    <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Beauty & lifestyle creator" />
                  </div>
                  <div className="space-y-2">
                    <Label>Categories</Label>
                    <div className="flex flex-wrap gap-2">
                      {CREATOR_CATEGORIES.map((c) => {
                        const active = categories.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleCategory(c)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs border transition",
                              active
                                ? "bg-foreground text-background border-foreground"
                                : "border-border hover:border-foreground/40"
                            )}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    {categories.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {categories.length} selected
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="rmin">Rate min ($)</Label>
                      <Input id="rmin" type="number" min="0" value={rateMin} onChange={(e) => setRateMin(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rmax">Rate max ($)</Label>
                      <Input id="rmax" type="number" min="0" value={rateMax} onChange={(e) => setRateMax(e.target.value)} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand name</Label>
                    <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Northlight Coffee" />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRIES.map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setIndustry(i)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs border transition",
                            industry === i
                              ? "bg-foreground text-background border-foreground"
                              : "border-border hover:border-foreground/40"
                          )}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="web">Website</Label>
                    <Input id="web" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
                  </div>
                </>
              )}
            </div>

            <div className="mt-10 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>Back</Button>
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

