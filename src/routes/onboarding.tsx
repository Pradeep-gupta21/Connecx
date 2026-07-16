import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace, type AppRole, type Profile } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { CREATOR_CATEGORIES, INDUSTRIES } from "@/lib/constants";
import { resolveCurrentLocation } from "@/lib/location";
import { cn } from "@/lib/utils";
import { scrapeSocialData } from "@/lib/social/socialScraper.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Complete your profile · Connecx" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const { profile, activeRole, roles } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");


  // Creator
  const [headline, setHeadline] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scrapedSocial, setScrapedSocial] = useState<{
    platform: string;
    handle: string;
    follower_count: number | null;
    engagement_rate: number | null;
    url: string;
  } | null>(null);

  // Advertiser
  const [brand, setBrand] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");

  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  // Admins never onboard — send them straight to the admin console.
  useEffect(() => {
    if (roles.includes("admin")) navigate({ to: "/admin", replace: true });
  }, [roles, navigate]);

  useEffect(() => {
    if (loading) return;
    if (user && !user.email_confirmed_at) {
      navigate({ to: "/auth/verify-email", replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading) return;
    if (profile && profile.onboarded) {
      navigate({
        to: activeRole === "advertiser" ? "/dashboard/advertiser" : "/dashboard/creator",
        replace: true,
      });
    }
  }, [profile, activeRole, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
      setLocation(profile.location ?? "");
    }
  }, [profile]);

  const role: AppRole = activeRole ?? "creator";

  const toggleCategory = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleUseCurrentLocation = async () => {
    setDetectingLocation(true);
    try {
      const detected = await resolveCurrentLocation();
      setLocation(detected);
      toast.success("Location detected successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to detect your location right now.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleScanSocial = async () => {
    if (!socialUrl.trim()) return;
    setScanning(true);
    try {
      const res = await scrapeSocialData({ data: socialUrl.trim() });
      setScrapedSocial({
        platform: res.platform,
        handle: res.handle,
        follower_count: res.follower_count,
        engagement_rate: res.engagement_rate ? Math.round(res.engagement_rate * 10000) / 100 : null,
        url: res.url,
      });
      toast.success(`Scanned ${res.platform} profile successfully!`);
    } catch (e: any) {
      toast.error("Could not scan profile automatically. You can enter manually.");
      setScrapedSocial({
        platform: "instagram",
        handle: "",
        follower_count: null,
        engagement_rate: null,
        url: socialUrl.trim(),
      });
    } finally {
      setScanning(false);
    }
  };

  const finish = async () => {
    if (!user) return;
    if (role === "creator") {
      if (!rateMin || !rateMax || Number(rateMin) <= 0 || Number(rateMax) <= 0) {
        return toast.error("Please enter valid minimum and maximum rates.");
      }
      if (Number(rateMax) < Number(rateMin)) {
        return toast.error("Maximum rate must be greater than or equal to minimum rate.");
      }
      if (!scrapedSocial) {
        return toast.error("Please link at least one social media account.");
      }
      if (categories.length === 0) {
        return toast.error("Pick at least one category");
      }
    }
    if (role === "advertiser" && !brand.trim()) {
      return toast.error("Add your brand name");
    }
    setSaving(true);
    try {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          username: username.trim(),
          bio: bio.trim(),
          location: location || null,
          onboarded: true,
        })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      if (role === "creator" && scrapedSocial) {
        const { error: socialErr } = await supabase.from("social_accounts").insert({
          user_id: user.id,
          platform: scrapedSocial.platform as any,
          handle: scrapedSocial.handle.trim(),
          follower_count: scrapedSocial.follower_count ? Number(scrapedSocial.follower_count) : null,
          engagement_rate: scrapedSocial.engagement_rate ? Number(scrapedSocial.engagement_rate) / 100 : null,
          url: scrapedSocial.url.trim() || null,
          is_primary: true,
        });
        if (socialErr) throw socialErr;
      }

      queryClient.setQueryData<Profile | null>(["profile", user.id], (current) =>
        current
          ? {
              ...current,
              display_name: displayName.trim(),
              username: username.trim(),
              bio: bio.trim(),
              location: location || null,
              onboarded: true,
            }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["creator_profile", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["creator_socials", user.id] });

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
                <Label htmlFor="name">Display name <span className="text-destructive">*</span></Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username <span className="text-destructive">*</span></Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-secondary text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    className="rounded-l-none"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
                    placeholder="your_handle"
                    aria-describedby="username-help"
                  />
                </div>
                <p id="username-help" className="text-xs text-muted-foreground">
                  3–30 characters. Letters, numbers, and underscores only.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lisbon, Portugal" className="flex-1" />
                  <Button type="button" variant="outline" onClick={handleUseCurrentLocation} disabled={detectingLocation} className="sm:w-auto w-full">
                    {detectingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                    Use Current Location
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Short bio <span className="text-destructive">*</span></Label>
                <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line or two about you or your brand." />
              </div>
              {role === "creator" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="socialUrl">Primary Social Account URL (Instagram, YouTube, etc.) <span className="text-destructive">*</span></Label>
                    <div className="flex gap-2">
                      <Input
                        id="socialUrl"
                        value={socialUrl}
                        onChange={(e) => setSocialUrl(e.target.value)}
                        placeholder="https://www.instagram.com/your_username"
                        disabled={scanning}
                        className="flex-1"
                      />
                      <Button type="button" onClick={handleScanSocial} disabled={scanning || !socialUrl.trim()} className="shrink-0">
                        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
                      </Button>
                    </div>
                  </div>

                  {scrapedSocial && (
                    <div className="border border-border/60 bg-card p-4 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex items-center justify-between border-b pb-2 border-border/40">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm Details</span>
                        <span className="text-xs capitalize font-medium px-2 py-0.5 rounded bg-secondary flex items-center gap-1.5">
                          {scrapedSocial.platform}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <Label>Handle / Name</Label>
                          <Input
                            value={scrapedSocial.handle}
                            onChange={(e) => setScrapedSocial({ ...scrapedSocial, handle: e.target.value })}
                            className="bg-background"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>Followers</Label>
                            <Input
                              type="number"
                              value={scrapedSocial.follower_count ?? ""}
                              onChange={(e) => setScrapedSocial({ ...scrapedSocial, follower_count: e.target.value ? Number(e.target.value) : null })}
                              className="bg-background"
                              placeholder="e.g. 50000"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Engagement Rate (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={scrapedSocial.engagement_rate ?? ""}
                              onChange={(e) => setScrapedSocial({ ...scrapedSocial, engagement_rate: e.target.value ? Number(e.target.value) : null })}
                              className="bg-background"
                              placeholder="e.g. 4.5"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Verify Platform Type</Label>
                          <Select
                            value={scrapedSocial.platform}
                            onValueChange={(val) => setScrapedSocial({ ...scrapedSocial, platform: val })}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="instagram">Instagram</SelectItem>
                              <SelectItem value="youtube">YouTube</SelectItem>
                              <SelectItem value="tiktok">TikTok</SelectItem>
                              <SelectItem value="twitter">Twitter</SelectItem>
                              <SelectItem value="facebook">Facebook</SelectItem>
                              <SelectItem value="website">Website</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-10 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!displayName.trim() || !username.trim() || !bio.trim() || (role === "creator" && !scrapedSocial)}>Continue</Button>
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
                      <Label htmlFor="rmin">Rate min (₹) <span className="text-destructive">*</span></Label>
                      <Input id="rmin" type="number" min="0" value={rateMin} onChange={(e) => setRateMin(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rmax">Rate max (₹) <span className="text-destructive">*</span></Label>
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
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter Connecx"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

