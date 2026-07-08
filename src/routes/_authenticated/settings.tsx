import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2, MapPin } from "lucide-react";
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
            <TabsContent value="creator" className="mt-4 sm:mt-6">
              <CreatorSettings />
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