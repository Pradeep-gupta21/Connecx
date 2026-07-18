import { z } from "zod";

// Username validation: letters, numbers, and underscores only. No spaces, no special characters.
export const usernameRegex = /^[a-zA-Z0-9_]+$/;

// Social URL validation: YouTube or Instagram profile URLs only.
export function validateSocialUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  const url = urlStr.trim();

  // Require valid protocol
  if (!url.match(/^https?:\/\//i)) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    const isInstagram = host === "instagram.com" || host === "www.instagram.com";
    const isYoutube = host === "youtube.com" || host === "www.youtube.com";

    if (!isInstagram && !isYoutube) {
      return false;
    }

    // Check that pathname has a handle/profile name (not just "/" or empty)
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

// Website URL validation
export function validateWebsiteUrl(urlStr: string): boolean {
  if (!urlStr) return true; // Optional field
  let url = urlStr.trim();
  if (!url.match(/^https?:\/\//i)) {
    url = "https://" + url;
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes(".");
  } catch (e) {
    return false;
  }
}

export interface OnboardingStep1Input {
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
}

export interface OnboardingStep2Input {
  headline?: string;
  categories?: string[];
  rateMin?: string;
  rateMax?: string;
  brand?: string;
  industry?: string;
  website?: string;
}

export interface ValidationErrors {
  [key: string]: string;
}

// Client and server shared validator for Step 1
export function validateStep1(
  data: OnboardingStep1Input,
  role: "creator" | "advertiser",
): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};

  // Display Name Validation
  if (!data.displayName || !data.displayName.trim()) {
    errors.displayName = "Display name is required.";
  } else if (data.displayName.trim().length < 2) {
    errors.displayName = "Display name is too short.";
  }

  // Username Validation
  if (!data.username || !data.username.trim()) {
    errors.username = "Username is required.";
  } else {
    const val = data.username.trim();
    if (val.length < 3 || val.length > 30) {
      errors.username = "Username must be between 3 and 30 characters.";
    } else if (!usernameRegex.test(val)) {
      errors.username = "Username can contain only letters, numbers and underscores.";
    }
  }

  // Location Validation
  if (!data.location || !data.location.trim()) {
    errors.location = "Please select your location.";
  }

  // Bio Validation
  if (!data.bio || !data.bio.trim()) {
    errors.bio = "Bio is required.";
  } else if (data.bio.trim().length < 20) {
    errors.bio = "Bio must be at least 20 characters.";
  }

  // Creator specific validation
  if (role === "creator") {
    if (!data.socialUrl || !data.socialUrl.trim()) {
      errors.socialUrl = "Primary social account URL is required.";
    } else if (!validateSocialUrl(data.socialUrl)) {
      errors.socialUrl = "Enter a valid YouTube or Instagram profile URL.";
    }

    if (!data.scrapedSocial) {
      errors.scrapedSocial = "Please link at least one social media account.";
    } else {
      if (!data.scrapedSocial.handle || !data.scrapedSocial.handle.trim()) {
        errors.socialHandle = "Social handle is required.";
      }
      if (
        data.scrapedSocial.follower_count === null ||
        data.scrapedSocial.follower_count === undefined ||
        isNaN(Number(data.scrapedSocial.follower_count))
      ) {
        errors.followerCount = "Followers count is required.";
      } else if (Number(data.scrapedSocial.follower_count) < 0) {
        errors.followerCount = "Followers must be a positive number.";
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// Client and server shared validator for Step 2
export function validateStep2(
  data: OnboardingStep2Input,
  role: "creator" | "advertiser",
): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};

  if (role === "creator") {
    // Categories
    if (!data.categories || data.categories.length === 0) {
      errors.categories = "Pick at least one category.";
    }

    // Rates
    const rMin = data.rateMin ? Number(data.rateMin) : NaN;
    const rMax = data.rateMax ? Number(data.rateMax) : NaN;

    if (!data.rateMin || isNaN(rMin) || rMin <= 0) {
      errors.rateMin = "Please enter a valid minimum rate (must be greater than 0).";
    }

    if (!data.rateMax || isNaN(rMax) || rMax <= 0) {
      errors.rateMax = "Please enter a valid maximum rate (must be greater than 0).";
    }

    if (!isNaN(rMin) && !isNaN(rMax) && rMin > 0 && rMax > 0 && rMax < rMin) {
      errors.rateMax = "Maximum rate must be greater than or equal to minimum rate.";
    }
  } else {
    // Advertiser validation
    if (!data.brand || !data.brand.trim()) {
      errors.brand = "Brand name is required.";
    }

    if (data.website && data.website.trim() && !validateWebsiteUrl(data.website)) {
      errors.website = "Enter a valid website URL.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
