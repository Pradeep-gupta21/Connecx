import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validateStep1, validateStep2 } from "@/lib/validation/onboarding";
import { submitOnboarding } from "@/lib/onboarding.functions";

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

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submitOnboardingFn = useServerFn(submitOnboarding);

  const role: AppRole = activeRole ?? "creator";
  const activeUserRole: "creator" | "advertiser" = role === "advertiser" ? "advertiser" : "creator";

  const fieldToIdMap: Record<string, string> = {
    displayName: "name",
    username: "username",
    location: "location",
    bio: "bio",
    socialUrl: "socialUrl",
    socialHandle: "socialHandle",
    followerCount: "followerCount",
    categories: "categories-container",
    rateMin: "rmin",
    rateMax: "rmax",
    brand: "brand",
    website: "web",
  };

  const fieldToLabelMap: Record<string, string> = {
    displayName: "Display Name",
    username: "Username",
    location: "Location",
    bio: "Bio",
    socialUrl: "Primary Social Account URL",
    socialHandle: "Social Handle",
    followerCount: "Followers",
    categories: "Categories",
    rateMin: "Rate min",
    rateMax: "Rate max",
    brand: "Brand Name",
    website: "Website URL",
  };

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

  // Revalidation helper triggered as soon as the user edits a field with an active error
  const revalidateField = (
    field: string,
    currentVal:
      | string
      | number
      | string[]
      | {
          platform: string;
          handle: string;
          follower_count: number | null;
          engagement_rate: number | null;
          url: string;
        }
      | null,
  ) => {
    if (!errors[field]) return; // Only revalidate if field already has an active error

    let fieldError: string | undefined;

    if (step === 1) {
      const data = {
        displayName: field === "displayName" ? (currentVal as string) : displayName,
        username: field === "username" ? (currentVal as string) : username,
        location: field === "location" ? (currentVal as string) : location,
        bio: field === "bio" ? (currentVal as string) : bio,
        socialUrl: field === "socialUrl" ? (currentVal as string) : socialUrl,
        scrapedSocial:
          field === "scrapedSocial"
            ? (currentVal as {
                platform: string;
                handle: string;
                follower_count: number | null;
                engagement_rate: number | null;
                url: string;
              } | null)
            : scrapedSocial,
      };

      if (field === "socialHandle" && scrapedSocial) {
        const mockScraped = { ...scrapedSocial, handle: currentVal as string };
        const { errors: step1Errors } = validateStep1(
          { ...data, scrapedSocial: mockScraped },
          activeUserRole,
        );
        fieldError = step1Errors.socialHandle;
      } else if (field === "followerCount" && scrapedSocial) {
        const mockScraped = {
          ...scrapedSocial,
          follower_count: currentVal as number | null,
        };
        const { errors: step1Errors } = validateStep1(
          { ...data, scrapedSocial: mockScraped },
          activeUserRole,
        );
        fieldError = step1Errors.followerCount;
      } else {
        const { errors: step1Errors } = validateStep1(data, activeUserRole);
        fieldError = step1Errors[field];
      }
    } else {
      const data = {
        categories: field === "categories" ? (currentVal as string[]) : categories,
        rateMin: field === "rateMin" ? (currentVal as string) : rateMin,
        rateMax: field === "rateMax" ? (currentVal as string) : rateMax,
        brand: field === "brand" ? (currentVal as string) : brand,
        website: field === "website" ? (currentVal as string) : website,
      };
      const { errors: step2Errors } = validateStep2(data, activeUserRole);
      fieldError = step2Errors[field];
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (!fieldError) {
        delete next[field];
      } else {
        next[field] = fieldError;
      }
      return next;
    });
  };

  const focusAndScrollToFirstError = (stepErrors: Record<string, string>) => {
    const fieldOrder =
      step === 1
        ? [
            "displayName",
            "username",
            "location",
            "bio",
            "socialUrl",
            "socialHandle",
            "followerCount",
          ]
        : ["categories", "rateMin", "rateMax", "brand", "website"];

    for (const field of fieldOrder) {
      if (stepErrors[field]) {
        const elementId = fieldToIdMap[field];
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.focus();
          if (document.activeElement !== element) {
            const focusable = element.querySelector(
              "input, textarea, button, select",
            ) as HTMLElement;
            if (focusable) {
              focusable.focus();
            }
          }
          break;
        }
      }
    }
  };

  const toggleCategory = (c: string) => {
    const nextCategories = categories.includes(c)
      ? categories.filter((x) => x !== c)
      : [...categories, c];
    setCategories(nextCategories);
    revalidateField("categories", nextCategories);
  };

  const handleUseCurrentLocation = async () => {
    setDetectingLocation(true);
    try {
      const detected = await resolveCurrentLocation();
      setLocation(detected);
      toast.success("Location detected successfully");
      setErrors((prev) => {
        const next = { ...prev };
        delete next.location;
        return next;
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to detect your location right now.",
      );
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleScanSocial = async () => {
    if (!socialUrl.trim()) return;
    setScanning(true);
    try {
      const res = await scrapeSocialData({ data: socialUrl.trim() });
      const newScraped = {
        platform: res.platform,
        handle: res.handle,
        follower_count: res.follower_count,
        engagement_rate: res.engagement_rate ? Math.round(res.engagement_rate * 10000) / 100 : null,
        url: res.url,
      };
      setScrapedSocial(newScraped);
      toast.success(`Scanned ${res.platform} profile successfully!`);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.scrapedSocial;
        delete next.socialHandle;
        delete next.followerCount;
        return next;
      });
    } catch (e: unknown) {
      toast.error("Could not scan profile automatically. You can enter details manually below.");
      const fallbackScraped = {
        platform: "instagram",
        handle: "",
        follower_count: null,
        engagement_rate: null,
        url: socialUrl.trim(),
      };
      setScrapedSocial(fallbackScraped);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.scrapedSocial;
        next.socialHandle = "Social handle is required.";
        next.followerCount = "Followers count is required.";
        return next;
      });
    } finally {
      setScanning(false);
    }
  };

  const handleContinue = () => {
    const { isValid, errors: step1Errors } = validateStep1(
      {
        displayName,
        username,
        location,
        bio,
        socialUrl,
        scrapedSocial,
      },
      activeUserRole,
    );

    if (!isValid) {
      setErrors(step1Errors);
      setTimeout(() => focusAndScrollToFirstError(step1Errors), 100);
      toast.error("Please fix the validation errors before continuing.");
      return;
    }

    setErrors({});
    setStep(2);
  };

  const finish = async () => {
    if (!user) return;

    // Validate Step 2 fields
    const { isValid: isStep2Valid, errors: step2Errors } = validateStep2(
      {
        headline,
        categories,
        rateMin,
        rateMax,
        brand,
        industry,
        website,
      },
      activeUserRole,
    );

    // Validate Step 1 fields again just in case the client bypassed it
    const { isValid: isStep1Valid, errors: step1Errors } = validateStep1(
      {
        displayName,
        username,
        location,
        bio,
        socialUrl,
        scrapedSocial,
      },
      activeUserRole,
    );

    const clientErrors = {
      ...step1Errors,
      ...step2Errors,
    };

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      if (Object.keys(step1Errors).length > 0) {
        setStep(1);
        setTimeout(() => focusAndScrollToFirstError(step1Errors), 100);
      } else {
        setTimeout(() => focusAndScrollToFirstError(step2Errors), 100);
      }
      toast.error("Please fix the validation errors.");
      return;
    }

    setSaving(true);
    try {
      const response = await submitOnboardingFn({
        data: {
          role: activeUserRole,
          step1: {
            displayName,
            username,
            location,
            bio,
            socialUrl,
            scrapedSocial,
          },
          step2: {
            headline,
            categories,
            rateMin,
            rateMax,
            brand,
            industry,
            website,
          },
        },
      });

      if (!response.success) {
        if (response.errors) {
          setErrors(response.errors);

          const step1FieldKeys = [
            "displayName",
            "username",
            "location",
            "bio",
            "socialUrl",
            "socialHandle",
            "followerCount",
          ];
          const hasStep1Errors = Object.keys(response.errors).some((key) =>
            step1FieldKeys.includes(key),
          );

          if (hasStep1Errors) {
            setStep(1);
            setTimeout(() => focusAndScrollToFirstError(response.errors!), 100);
          } else {
            setTimeout(() => focusAndScrollToFirstError(response.errors!), 100);
          }

          if (response.errors._global) {
            toast.error(response.errors._global);
          } else {
            toast.error("Please fix the backend validation errors.");
          }
        }
        return;
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
          : current,
      );
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["creator_profile", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["creator_socials", user.id] });

      toast.success("You're all set");
      navigate({
        to: activeUserRole === "advertiser" ? "/dashboard/advertiser" : "/dashboard/creator",
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
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              The basics
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              Tell us about you
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl">
              This is what other {activeUserRole === "advertiser" ? "creators" : "brands"} will see
              first.
            </p>

            {/* Validation Error Summary */}
            {Object.keys(errors).length > 0 && (
              <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="text-base" aria-hidden="true">
                    ⚠️
                  </span>
                  <span>Please fix the following errors before continuing:</span>
                </div>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  {Object.entries(errors).map(([field, errMsg]) => {
                    if (field === "_global") return null;
                    const label = fieldToLabelMap[field] || field;
                    return (
                      <li key={field}>
                        <button
                          type="button"
                          onClick={() => {
                            const elementId = fieldToIdMap[field];
                            const element = document.getElementById(elementId);
                            if (element) {
                              element.scrollIntoView({ behavior: "smooth", block: "center" });
                              element.focus();
                              if (document.activeElement !== element) {
                                const focusable = element.querySelector(
                                  "input, textarea, button, select",
                                ) as HTMLElement;
                                if (focusable) focusable.focus();
                              }
                            }
                          }}
                          className="text-left underline hover:text-destructive/80 focus:outline-none focus:ring-1 focus:ring-destructive rounded px-1 transition-colors"
                        >
                          {label}: {errMsg}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-10 space-y-5 max-w-lg">
              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Display name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDisplayName(val);
                    revalidateField("displayName", val);
                  }}
                  className={cn(
                    errors.displayName &&
                      "border-destructive focus-visible:ring-destructive bg-destructive/5",
                  )}
                  aria-invalid={errors.displayName ? "true" : "false"}
                  aria-describedby={errors.displayName ? "name-error" : undefined}
                />
                {errors.displayName && (
                  <p
                    id="name-error"
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    role="alert"
                  >
                    <span aria-hidden="true">❌</span> {errors.displayName}
                  </p>
                )}
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-destructive">*</span>
                </Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-secondary text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    className={cn(
                      "rounded-l-none",
                      errors.username &&
                        "border-destructive focus-visible:ring-destructive bg-destructive/5",
                    )}
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\s+/g, "");
                      setUsername(val);
                      revalidateField("username", val);
                    }}
                    placeholder="your_handle"
                    aria-invalid={errors.username ? "true" : "false"}
                    aria-describedby={cn("username-help", errors.username && "username-error")}
                  />
                </div>
                <p id="username-help" className="text-xs text-muted-foreground">
                  3–30 characters. Letters, numbers, and underscores only.
                </p>
                {errors.username && (
                  <p
                    id="username-error"
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    role="alert"
                  >
                    <span aria-hidden="true">❌</span> {errors.username}
                  </p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">
                  Location <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocation(val);
                      revalidateField("location", val);
                    }}
                    placeholder="e.g. Lisbon, Portugal"
                    className={cn(
                      "flex-1",
                      errors.location &&
                        "border-destructive focus-visible:ring-destructive bg-destructive/5",
                    )}
                    aria-invalid={errors.location ? "true" : "false"}
                    aria-describedby={errors.location ? "location-error" : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseCurrentLocation}
                    disabled={detectingLocation}
                    className="sm:w-auto w-full"
                  >
                    {detectingLocation ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="mr-2 h-4 w-4" />
                    )}
                    Use Current Location
                  </Button>
                </div>
                {errors.location && (
                  <p
                    id="location-error"
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    role="alert"
                  >
                    <span aria-hidden="true">❌</span> {errors.location}
                  </p>
                )}
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">
                  Short bio <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="bio"
                  rows={4}
                  value={bio}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBio(val);
                    revalidateField("bio", val);
                  }}
                  placeholder="A line or two about you or your brand."
                  className={cn(
                    errors.bio &&
                      "border-destructive focus-visible:ring-destructive bg-destructive/5",
                  )}
                  aria-invalid={errors.bio ? "true" : "false"}
                  aria-describedby={errors.bio ? "bio-error" : undefined}
                />
                {errors.bio && (
                  <p
                    id="bio-error"
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    role="alert"
                  >
                    <span aria-hidden="true">❌</span> {errors.bio}
                  </p>
                )}
              </div>

              {/* Creator Socials */}
              {activeUserRole === "creator" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="socialUrl">
                      Primary Social Account URL (Instagram, YouTube, etc.){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="socialUrl"
                        value={socialUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSocialUrl(val);
                          revalidateField("socialUrl", val);
                        }}
                        placeholder="https://www.instagram.com/your_username"
                        disabled={scanning}
                        className={cn(
                          "flex-1",
                          errors.socialUrl &&
                            "border-destructive focus-visible:ring-destructive bg-destructive/5",
                        )}
                        aria-invalid={errors.socialUrl ? "true" : "false"}
                        aria-describedby={cn(
                          errors.socialUrl && "socialUrl-error",
                          errors.scrapedSocial && "scrapedSocial-error",
                        )}
                      />
                      <Button
                        type="button"
                        onClick={handleScanSocial}
                        disabled={scanning || !socialUrl.trim()}
                        className="shrink-0"
                      >
                        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
                      </Button>
                    </div>
                    {errors.socialUrl && (
                      <p
                        id="socialUrl-error"
                        className="text-xs text-destructive mt-1 flex items-center gap-1"
                        role="alert"
                      >
                        <span aria-hidden="true">❌</span> {errors.socialUrl}
                      </p>
                    )}
                    {errors.scrapedSocial && (
                      <p
                        id="scrapedSocial-error"
                        className="text-xs text-destructive mt-1 flex items-center gap-1"
                        role="alert"
                      >
                        <span aria-hidden="true">❌</span> {errors.scrapedSocial}
                      </p>
                    )}
                  </div>

                  {scrapedSocial && (
                    <div className="border border-border/60 bg-card p-4 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex items-center justify-between border-b pb-2 border-border/40">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Confirm Details
                        </span>
                        <span className="text-xs capitalize font-medium px-2 py-0.5 rounded bg-secondary flex items-center gap-1.5">
                          {scrapedSocial.platform}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="socialHandle">
                            Handle / Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="socialHandle"
                            value={scrapedSocial.handle}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScrapedSocial({ ...scrapedSocial, handle: val });
                              revalidateField("socialHandle", val);
                            }}
                            className={cn(
                              "bg-background",
                              errors.socialHandle &&
                                "border-destructive focus-visible:ring-destructive bg-destructive/5",
                            )}
                            aria-invalid={errors.socialHandle ? "true" : "false"}
                            aria-describedby={
                              errors.socialHandle ? "socialHandle-error" : undefined
                            }
                          />
                          {errors.socialHandle && (
                            <p
                              id="socialHandle-error"
                              className="text-xs text-destructive mt-1 flex items-center gap-1"
                              role="alert"
                            >
                              <span aria-hidden="true">❌</span> {errors.socialHandle}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="followerCount">
                              Followers <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="followerCount"
                              type="number"
                              value={scrapedSocial.follower_count ?? ""}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                setScrapedSocial({ ...scrapedSocial, follower_count: val });
                                revalidateField("followerCount", val);
                              }}
                              className={cn(
                                "bg-background",
                                errors.followerCount &&
                                  "border-destructive focus-visible:ring-destructive bg-destructive/5",
                              )}
                              placeholder="e.g. 50000"
                              aria-invalid={errors.followerCount ? "true" : "false"}
                              aria-describedby={
                                errors.followerCount ? "followerCount-error" : undefined
                              }
                            />
                            {errors.followerCount && (
                              <p
                                id="followerCount-error"
                                className="text-xs text-destructive mt-1 flex items-center gap-1"
                                role="alert"
                              >
                                <span aria-hidden="true">❌</span> {errors.followerCount}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="engagementRate">Engagement Rate (%)</Label>
                            <Input
                              id="engagementRate"
                              type="number"
                              step="0.01"
                              value={scrapedSocial.engagement_rate ?? ""}
                              onChange={(e) =>
                                setScrapedSocial({
                                  ...scrapedSocial,
                                  engagement_rate: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                              className="bg-background"
                              placeholder="e.g. 4.5"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="platformType">Verify Platform Type</Label>
                          <Select
                            value={scrapedSocial.platform}
                            onValueChange={(val) =>
                              setScrapedSocial({ ...scrapedSocial, platform: val })
                            }
                          >
                            <SelectTrigger id="platformType" className="bg-background">
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
              <Button onClick={handleContinue}>Continue</Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {activeUserRole === "creator" ? "Your creator profile" : "Your brand"}
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              {activeUserRole === "creator" ? "How you work" : "About your brand"}
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl">
              You can refine this later in Settings.
            </p>

            {/* Validation Error Summary */}
            {Object.keys(errors).length > 0 && (
              <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="text-base" aria-hidden="true">
                    ⚠️
                  </span>
                  <span>Please fix the following errors before continuing:</span>
                </div>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  {Object.entries(errors).map(([field, errMsg]) => {
                    if (field === "_global") return null;
                    const label = fieldToLabelMap[field] || field;
                    return (
                      <li key={field}>
                        <button
                          type="button"
                          onClick={() => {
                            const step1Fields = [
                              "displayName",
                              "username",
                              "location",
                              "bio",
                              "socialUrl",
                              "socialHandle",
                              "followerCount",
                            ];
                            if (step1Fields.includes(field)) {
                              setStep(1);
                            }
                            setTimeout(() => {
                              const elementId = fieldToIdMap[field];
                              const element = document.getElementById(elementId);
                              if (element) {
                                element.scrollIntoView({ behavior: "smooth", block: "center" });
                                element.focus();
                                if (document.activeElement !== element) {
                                  const focusable = element.querySelector(
                                    "input, textarea, button, select",
                                  ) as HTMLElement;
                                  if (focusable) focusable.focus();
                                }
                              }
                            }, 150);
                          }}
                          className="text-left underline hover:text-destructive/80 focus:outline-none focus:ring-1 focus:ring-destructive rounded px-1 transition-colors"
                        >
                          {label}: {errMsg}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-10 space-y-6 max-w-lg">
              {activeUserRole === "creator" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="headline">Headline</Label>
                    <Input
                      id="headline"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Beauty & lifestyle creator"
                    />
                  </div>

                  {/* Categories */}
                  <div
                    id="categories-container"
                    tabIndex={errors.categories ? 0 : -1}
                    className={cn(
                      "space-y-2 p-3 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-destructive",
                      errors.categories && "border border-destructive bg-destructive/5",
                    )}
                    aria-invalid={errors.categories ? "true" : "false"}
                    aria-describedby={errors.categories ? "categories-error" : undefined}
                  >
                    <Label className="font-medium">
                      Categories <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {CREATOR_CATEGORIES.map((c) => {
                        const active = categories.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleCategory(c)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs border transition cursor-pointer",
                              active
                                ? "bg-foreground text-background border-foreground"
                                : "border-border hover:border-foreground/40",
                            )}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    {categories.length > 0 && (
                      <p className="text-xs text-muted-foreground">{categories.length} selected</p>
                    )}
                    {errors.categories && (
                      <p
                        id="categories-error"
                        className="text-xs text-destructive mt-1 flex items-center gap-1"
                        role="alert"
                      >
                        <span aria-hidden="true">❌</span> {errors.categories}
                      </p>
                    )}
                  </div>

                  {/* Rates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="rmin">
                        Rate min (₹) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="rmin"
                        type="number"
                        min="0"
                        value={rateMin}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRateMin(val);
                          revalidateField("rateMin", val);
                        }}
                        className={cn(
                          errors.rateMin &&
                            "border-destructive focus-visible:ring-destructive bg-destructive/5",
                        )}
                        aria-invalid={errors.rateMin ? "true" : "false"}
                        aria-describedby={errors.rateMin ? "rateMin-error" : undefined}
                      />
                      {errors.rateMin && (
                        <p
                          id="rateMin-error"
                          className="text-xs text-destructive mt-1 flex items-center gap-1"
                          role="alert"
                        >
                          <span aria-hidden="true">❌</span> {errors.rateMin}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rmax">
                        Rate max (₹) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="rmax"
                        type="number"
                        min="0"
                        value={rateMax}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRateMax(val);
                          revalidateField("rateMax", val);
                        }}
                        className={cn(
                          errors.rateMax &&
                            "border-destructive focus-visible:ring-destructive bg-destructive/5",
                        )}
                        aria-invalid={errors.rateMax ? "true" : "false"}
                        aria-describedby={errors.rateMax ? "rateMax-error" : undefined}
                      />
                      {errors.rateMax && (
                        <p
                          id="rateMax-error"
                          className="text-xs text-destructive mt-1 flex items-center gap-1"
                          role="alert"
                        >
                          <span aria-hidden="true">❌</span> {errors.rateMax}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Brand name */}
                  <div className="space-y-2">
                    <Label htmlFor="brand">
                      Brand name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="brand"
                      value={brand}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBrand(val);
                        revalidateField("brand", val);
                      }}
                      placeholder="e.g. Northlight Coffee"
                      className={cn(
                        errors.brand &&
                          "border-destructive focus-visible:ring-destructive bg-destructive/5",
                      )}
                      aria-invalid={errors.brand ? "true" : "false"}
                      aria-describedby={errors.brand ? "brand-error" : undefined}
                    />
                    {errors.brand && (
                      <p
                        id="brand-error"
                        className="text-xs text-destructive mt-1 flex items-center gap-1"
                        role="alert"
                      >
                        <span aria-hidden="true">❌</span> {errors.brand}
                      </p>
                    )}
                  </div>

                  {/* Industry */}
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRIES.map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setIndustry(i)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs border transition cursor-pointer",
                            industry === i
                              ? "bg-foreground text-background border-foreground"
                              : "border-border hover:border-foreground/40",
                          )}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <Label htmlFor="web">Website</Label>
                    <Input
                      id="web"
                      value={website}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWebsite(val);
                        revalidateField("website", val);
                      }}
                      placeholder="https://…"
                      className={cn(
                        errors.website &&
                          "border-destructive focus-visible:ring-destructive bg-destructive/5",
                      )}
                      aria-invalid={errors.website ? "true" : "false"}
                      aria-describedby={errors.website ? "website-error" : undefined}
                    />
                    {errors.website && (
                      <p
                        id="website-error"
                        className="text-xs text-destructive mt-1 flex items-center gap-1"
                        role="alert"
                      >
                        <span aria-hidden="true">❌</span> {errors.website}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="mt-10 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
                Back
              </Button>
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
