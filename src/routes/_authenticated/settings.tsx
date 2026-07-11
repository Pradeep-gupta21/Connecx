import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2, MapPin, Instagram, Youtube, Twitter, Globe, Music2, Plus, Trash, Star, Facebook } from "lucide-react";
import { cn } from "@/lib/utils";
import { scrapeSocialData } from "@/lib/social/socialScraper.functions";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace, type AppRole } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, dialFor } from "@/lib/countries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProfileAppearanceEditor } from "@/components/profile/ProfileAppearanceEditor";
import { PayoutMethods } from "@/components/settings/PayoutMethods";
import { resolveCurrentLocation } from "@/lib/location";
import type { BannerPosition } from "@/lib/profile-media";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Connecx" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { profile, roles } = useWorkspace();
  const qc = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setUsername(profile.username ?? "");
      setLocation(profile.location ?? "");
      setBio(profile.bio ?? "");
      setCountry(profile.country ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

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

  const saveProfile = async () => {
    if (!user) return;
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      return toast.error("Username must be 3-30 letters, numbers, or underscores");
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        username: username.trim() || null,
        location,
        bio,
        country,
        phone,
      })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Profile saved");
  };


  const toggleRole = async (role: AppRole, on: boolean) => {
    if (!user) return;
    if (on) {
      const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role });
      if (error) return toast.error(error.message);
      if (role === "advertiser") {
        await supabase.from("advertiser_profiles").upsert({ user_id: user.id, brand_name: displayName }, { onConflict: "user_id" });
      } else {
        await supabase.from("creator_profiles").upsert({ user_id: user.id }, { onConflict: "user_id" });
      }
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["user_roles", user.id] });
    toast.success("Workspaces updated");
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 px-2 sm:px-0 sm:space-y-8">
      <PageHeader title="Settings" description="Manage your profile, workspaces, and account." />

      <Tabs
        defaultValue={
          roles.includes("creator")
            ? "creator"
            : roles.includes("advertiser")
            ? "advertiser"
            : "profile"
        }
      >
        <TabsList className="flex-wrap h-auto gap-1 sm:gap-2">
          <TabsTrigger value="profile" className="text-sm">Profile</TabsTrigger>

          <TabsTrigger value="appearance" className="text-sm">
            Appearance
          </TabsTrigger>

          <TabsTrigger value="payouts" className="text-sm">
            Payouts
          </TabsTrigger>

          {roles.includes("creator") && (
            <TabsTrigger value="creator" className="text-sm">
              Creator
            </TabsTrigger>
          )}

          {roles.includes("advertiser") && (
            <TabsTrigger value="advertiser" className="text-sm">
              Advertiser
            </TabsTrigger>
          )}

          <TabsTrigger value="account" className="text-sm">
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payouts" className="mt-4 sm:mt-6">
          <PayoutMethods />
        </TabsContent>

        <TabsContent value="appearance" className="mt-4 sm:mt-6">
          <ProfileAppearanceEditor
            displayName={profile?.display_name ?? ""}
            avatarValue={profile?.avatar_url ?? null}
            bannerValue={profile?.banner_url ?? null}
            bannerPosition={(profile?.banner_position as unknown as BannerPosition | null) ?? null}
          />
        </TabsContent>

        <TabsContent value="profile" className="mt-4 sm:mt-6">

          <div className="surface-card p-4 space-y-5 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="un">Username</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-secondary text-sm text-muted-foreground">
                  @
                </span>
                <Input
                  id="un"
                  className="rounded-l-none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
                  placeholder="your_handle"
                  aria-describedby="un-help"
                />
              </div>
              <p id="un-help" className="text-xs text-muted-foreground">
                3–30 characters. Letters, numbers, and underscores only. Used for @mentions and search.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loc">Location</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} className="flex-1" />
                <Button type="button" variant="outline" onClick={handleUseCurrentLocation} disabled={detectingLocation} className="sm:w-auto w-full">
                  {detectingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                  Use Current Location
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="mr-2 text-muted-foreground">{c.dial}</span>{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-secondary text-sm text-muted-foreground min-w-14 justify-center">
                    {dialFor(country) || "+—"}
                  </span>
                  <Input id="phone" type="tel" className="rounded-l-none" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex justify-stretch sm:justify-end">
              <Button onClick={saveProfile} disabled={savingProfile} className="w-full sm:w-auto">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {roles.includes("creator") && (
            <TabsContent value="creator" className="mt-4 sm:mt-6 space-y-6">
              <CreatorSettings />
              <SocialAccountsManager />
            </TabsContent>
          )}

          {roles.includes("advertiser") && (
            <TabsContent value="advertiser" className="mt-4 sm:mt-6">
              <AdvertiserSettings />
            </TabsContent>
          )}

        <TabsContent value="account" className="mt-4 sm:mt-6">
          <div className="surface-card p-4 space-y-5 sm:p-6">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="border-t border-border pt-5">
              <p className="text-sm font-medium mb-3">Workspaces</p>
              <div className="space-y-3">
                {(["advertiser", "creator"] as const).map((r) => (
                  <div key={r} className="flex flex-col gap-3 rounded-md border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm capitalize">{r}</p>
                      <p className="text-xs text-muted-foreground">
                        {r === "advertiser" ? "Run campaigns and brief creators." : "Pitch on campaigns and get hired."}
                      </p>
                    </div>
                    <Switch checked={roles.includes(r)} onCheckedChange={(on) => toggleRole(r, on)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-5">
              <Button variant="outline" onClick={signOut}>Sign out</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SocialAccountsManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scrapedData, setScrapedData] = useState<{
    platform: string;
    handle: string;
    follower_count: number | null;
    engagement_rate: number | null;
    url: string;
  } | null>(null);

  const { data: socials, isLoading } = useQuery({
    queryKey: ["creator_socials", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("social_accounts").select("*").eq("user_id", user!.id).is("deleted_at", null);
      return data ?? [];
    },
  });

  const handleScan = async () => {
    if (!url.trim()) return;
    setScanning(true);
    try {
      const res = await scrapeSocialData({ data: url.trim() });
      setScrapedData({
        platform: res.platform,
        handle: res.handle,
        follower_count: res.follower_count,
        engagement_rate: res.engagement_rate ? Math.round(res.engagement_rate * 10000) / 100 : null,
        url: res.url,
      });
      toast.success(`Scanned ${res.platform} profile successfully!`);
    } catch (e: any) {
      toast.error("Could not scan profile automatically. You can enter manually.");
      setScrapedData({
        platform: "instagram",
        handle: "",
        follower_count: null,
        engagement_rate: null,
        url: url.trim(),
      });
    } finally {
      setScanning(false);
    }
  };

  const handleAdd = async () => {
    if (!user || !scrapedData || !scrapedData.handle) return;
    setBusy(true);
    const isFirst = !socials || socials.length === 0;
    const { error } = await supabase.from("social_accounts").insert({
      user_id: user.id,
      platform: scrapedData.platform as any,
      handle: scrapedData.handle.trim(),
      follower_count: scrapedData.follower_count ? Number(scrapedData.follower_count) : null,
      engagement_rate: scrapedData.engagement_rate ? Number(scrapedData.engagement_rate) / 100 : null,
      url: scrapedData.url.trim() || null,
      is_primary: isFirst,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Social account linked");
    setUrl("");
    setScrapedData(null);
    setShowAddForm(false);
    qc.invalidateQueries({ queryKey: ["creator_socials", user.id] });
  };

  const handleSetPrimary = async (accountId: string) => {
    if (!user) return;
    const { error: err1 } = await supabase.from("social_accounts").update({ is_primary: false }).eq("user_id", user.id);
    if (err1) {
      toast.error(err1.message);
      return;
    }
    const { error: err2 } = await supabase.from("social_accounts").update({ is_primary: true }).eq("id", accountId);
    if (err2) {
      toast.error(err2.message);
      return;
    }
    toast.success("Primary account updated");
    qc.invalidateQueries({ queryKey: ["creator_socials", user.id] });
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("social_accounts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Social account removed");
    qc.invalidateQueries({ queryKey: ["creator_socials", user.id] });
  };

  const socialIcons: Record<string, any> = {
    instagram: Instagram,
    youtube: Youtube,
    twitter: Twitter,
    tiktok: Music2,
    website: Globe,
    facebook: Facebook,
  };

  if (isLoading) return <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="surface-card p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4 border-border/40">
        <div>
          <h3 className="font-semibold text-lg">Social Accounts</h3>
          <p className="text-sm text-muted-foreground">Link your platforms to showcase your audience size and engagement.</p>
        </div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Link Profile
          </Button>
        )}
      </div>

      {showAddForm && (
        <div className="p-4 rounded-xl border border-border/80 bg-secondary/20 space-y-4">
          <h4 className="font-medium text-sm">Scan Profile URL</h4>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. https://youtube.com/@mrbeast or https://instagram.com/handle"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={scanning}
              className="bg-background flex-1"
            />
            <Button onClick={handleScan} disabled={scanning || !url.trim()} className="shrink-0">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
            </Button>
          </div>

          {scrapedData && (
            <div className="border border-border/60 bg-card p-4 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between border-b pb-2 border-border/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm Details</span>
                <span className="text-xs capitalize font-medium px-2 py-0.5 rounded bg-secondary flex items-center gap-1.5">
                  {scrapedData.platform}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Handle / Name</Label>
                  <Input
                    value={scrapedData.handle}
                    onChange={(e) => setScrapedData({ ...scrapedData, handle: e.target.value })}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Follower Count</Label>
                  <Input
                    type="number"
                    value={scrapedData.follower_count ?? ""}
                    onChange={(e) => setScrapedData({ ...scrapedData, follower_count: e.target.value ? Number(e.target.value) : null })}
                    className="bg-background"
                    placeholder="e.g. 50000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Engagement Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={scrapedData.engagement_rate ?? ""}
                    onChange={(e) => setScrapedData({ ...scrapedData, engagement_rate: e.target.value ? Number(e.target.value) : null })}
                    className="bg-background"
                    placeholder="e.g. 4.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Verify Platform Type</Label>
                  <Select
                    value={scrapedData.platform}
                    onValueChange={(val) => setScrapedData({ ...scrapedData, platform: val })}
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
              <div className="flex gap-2 justify-end pt-2 border-t border-border/40">
                <Button variant="ghost" size="sm" onClick={() => setScrapedData(null)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={busy || !scrapedData.handle}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link account"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {(!socials || socials.length === 0) ? (
        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl border-border/40">
          No social accounts linked yet. Link one to display metrics on your profile.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {socials.map((s) => {
            const Icon = socialIcons[s.platform] ?? Globe;
            const erPercent = s.engagement_rate ? (Number(s.engagement_rate) * 100).toFixed(2) : null;
            return (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/80">
                    <Icon className="h-5 w-5 text-foreground/80" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm capitalize">{s.platform}</p>
                    <p className="text-xs text-muted-foreground">
                      @{s.handle} 
                      {s.follower_count ? ` · ${Number(s.follower_count).toLocaleString()} followers` : ""}
                      {erPercent ? ` · ${erPercent}% ER` : ""}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 text-xs gap-1",
                      s.is_primary 
                        ? "text-amber-500 hover:text-amber-500 hover:bg-transparent cursor-default font-semibold" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => !s.is_primary && handleSetPrimary(s.id)}
                  >
                    <Star className={cn("h-3.5 w-3.5", s.is_primary ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
                    {s.is_primary ? "Primary" : "Set Primary"}
                  </Button>

                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(s.id)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreatorSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [headline, setHeadline] = useState("");
  const [rateMin, setRateMin] = useState<string>("");
  const [rateMax, setRateMax] = useState<string>("");
  const [categories, setCategories] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["creator_profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("creator_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setHeadline(data.headline ?? "");
      setRateMin(data.rate_min ? String(data.rate_min) : "");
      setRateMax(data.rate_max ? String(data.rate_max) : "");
      setCategories((data.categories ?? []).join(", "));
    }
  }, [data]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("creator_profiles").upsert({
      user_id: user.id,
      headline,
      rate_min: rateMin ? Number(rateMin) : null,
      rate_max: rateMax ? Number(rateMax) : null,
      categories: categories.split(",").map((s) => s.trim()).filter(Boolean),
    }, { onConflict: "user_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["creator_profile", user.id] });
    toast.success("Creator profile saved");
  };

  return (
    <div className="surface-card p-6 space-y-5">
      <div className="space-y-2">
        <Label>Headline</Label>
        <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="What you make and for whom" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Rate min ($)</Label>
          <Input type="number" min="0" value={rateMin} onChange={(e) => setRateMin(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Rate max ($)</Label>
          <Input type="number" min="0" value={rateMax} onChange={(e) => setRateMax(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Categories</Label>
        <Input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Fashion, Beauty, Tech" />
        <p className="text-xs text-muted-foreground">Comma-separated.</p>
      </div>
      <div className="flex justify-stretch sm:justify-end">
        <Button onClick={save} disabled={busy} className="w-full sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
      </div>
    </div>
  );
}

function AdvertiserSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [brand, setBrand] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["advertiser_profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("advertiser_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setBrand(data.brand_name ?? "");
      setWebsite(data.website ?? "");
      setIndustry(data.industry ?? "");
      setAbout(data.about ?? "");
    }
  }, [data]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("advertiser_profiles").upsert({
      user_id: user.id, brand_name: brand, website, industry, about,
    }, { onConflict: "user_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["advertiser_profile", user.id] });
    toast.success("Brand profile saved");
  };

  return (
    <div className="surface-card p-4 space-y-5 sm:p-6">
      <div className="space-y-2"><Label>Brand name</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
      <div className="space-y-2"><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." /></div>
      <div className="space-y-2"><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
      <div className="space-y-2"><Label>About</Label><Textarea rows={4} value={about} onChange={(e) => setAbout(e.target.value)} /></div>
      <div className="flex justify-stretch sm:justify-end"><Button onClick={save} disabled={busy} className="w-full sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button></div>
    </div>
  );
}