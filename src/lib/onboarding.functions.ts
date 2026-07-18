import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateStep1, validateStep2 } from "./validation/onboarding";

export const submitOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      role: "creator" | "advertiser";
      step1: {
        displayName: string;
        username: string;
        location: string;
        bio: string;
        socialUrl?: string;
        scrapedSocial?: {
          platform: string;
          handle: string;
          follower_count: number | null;
          engagement_rate: number | null;
          url: string;
        } | null;
      };
      step2: {
        headline?: string;
        categories?: string[];
        rateMin?: string;
        rateMax?: string;
        brand?: string;
        industry?: string;
        website?: string;
      };
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Validate Step 1 fields
    const step1Result = validateStep1(data.step1, data.role);

    // 2. Validate Step 2 fields
    const step2Result = validateStep2(data.step2, data.role);

    const errors = {
      ...step1Result.errors,
      ...step2Result.errors,
    };

    // 3. Username uniqueness check (Server-side validation)
    if (data.step1.username && !errors.username) {
      const trimmedUsername = data.step1.username.trim();
      const { data: existingUser, error: checkErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", trimmedUsername)
        .maybeSingle();

      if (checkErr) {
        console.error("Error checking username uniqueness:", checkErr);
      } else if (existingUser && existingUser.id !== userId) {
        errors.username = "Username already exists.";
      }
    }

    // 4. Return errors if any validation fails
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
      };
    }

    try {
      // 5. Update profiles table
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          display_name: data.step1.displayName.trim(),
          username: data.step1.username.trim(),
          bio: data.step1.bio.trim(),
          location: data.step1.location || null,
          onboarded: true,
        })
        .eq("id", userId);

      if (profileErr) {
        throw new Error(`Profile update failed: ${profileErr.message}`);
      }

      // 6. Creator-specific data updates
      if (data.role === "creator") {
        if (data.step1.scrapedSocial) {
          // Delete any existing primary social accounts to prevent duplication
          await supabase.from("social_accounts").delete().eq("user_id", userId);

          // Insert new social account
          const { error: socialErr } = await supabase.from("social_accounts").insert({
            user_id: userId,
            platform: (data.step1.scrapedSocial.platform === "website"
              ? "other"
              : data.step1.scrapedSocial.platform) as
              | "instagram"
              | "youtube"
              | "tiktok"
              | "twitter"
              | "facebook"
              | "twitch"
              | "linkedin"
              | "other",
            handle: data.step1.scrapedSocial.handle.trim(),
            follower_count: data.step1.scrapedSocial.follower_count
              ? Number(data.step1.scrapedSocial.follower_count)
              : null,
            engagement_rate: data.step1.scrapedSocial.engagement_rate
              ? Number(data.step1.scrapedSocial.engagement_rate) / 100
              : null,
            url: data.step1.scrapedSocial.url.trim() || null,
            is_primary: true,
          });

          if (socialErr) {
            throw new Error(`Social account insertion failed: ${socialErr.message}`);
          }
        }

        // Upsert creator profile
        const { error: creatorErr } = await supabase.from("creator_profiles").upsert(
          {
            user_id: userId,
            headline: data.step2.headline || null,
            categories: data.step2.categories || [],
            rate_min: data.step2.rateMin ? Number(data.step2.rateMin) : null,
            rate_max: data.step2.rateMax ? Number(data.step2.rateMax) : null,
            available: true,
            availability_status: "available",
          },
          { onConflict: "user_id" },
        );

        if (creatorErr) {
          throw new Error(`Creator profile upsert failed: ${creatorErr.message}`);
        }
      } else {
        // 7. Advertiser-specific data updates (Advertiser Profiles)
        const { error: advertiserErr } = await supabase.from("advertiser_profiles").upsert(
          {
            user_id: userId,
            brand_name: data.step2.brand || "",
            industry: data.step2.industry || null,
            website: data.step2.website || null,
          },
          { onConflict: "user_id" },
        );

        if (advertiserErr) {
          throw new Error(`Advertiser profile upsert failed: ${advertiserErr.message}`);
        }
      }

      return {
        success: true,
      };
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("Database update error during onboarding completion:", err);
      return {
        success: false,
        errors: {
          _global: err.message || "Failed to save profile changes. Please try again.",
        },
      };
    }
  });
