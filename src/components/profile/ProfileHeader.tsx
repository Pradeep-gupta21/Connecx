import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProfileMediaUrl } from "@/hooks/useProfileMediaUrl";
import {
  PROFILE_BANNERS_BUCKET,
  PROFILE_PICTURES_BUCKET,
  DEFAULT_BANNER_POSITION,
  type BannerPosition,
} from "@/lib/profile-media";

export type ProfileHeaderProps = {
  displayName: string;
  avatarValue?: string | null;
  bannerValue?: string | null;
  bannerPosition?: BannerPosition | null;
  headline?: string | null;
  location?: string | null;
  meta?: string | null; // e.g. "Fashion • 250k followers"
  bio?: string | null;
  verified?: boolean;
  isOwner?: boolean;
  actions?: ReactNode;
  ownerActions?: ReactNode;
  onEditBanner?: () => void;
  onEditAvatar?: () => void;
  className?: string;
};

/**
 * LinkedIn-style profile header: cover banner with the avatar overlapping
 * bottom-left. Reused by public profiles and dashboards.
 */
export function ProfileHeader({
  displayName,
  avatarValue,
  bannerValue,
  bannerPosition,
  headline,
  location,
  meta,
  bio,
  verified,
  isOwner,
  actions,
  ownerActions,
  onEditBanner,
  onEditAvatar,
  className,
}: ProfileHeaderProps) {
  const { url: bannerUrl } = useProfileMediaUrl(PROFILE_BANNERS_BUCKET, bannerValue);
  const { url: avatarUrl } = useProfileMediaUrl(PROFILE_PICTURES_BUCKET, avatarValue);
  const pos = bannerPosition ?? DEFAULT_BANNER_POSITION;
  const initials = (displayName || "?").slice(0, 2).toUpperCase();

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "surface-card overflow-hidden rounded-2xl border border-border/70 shadow-sm",
        className,
      )}
      aria-label={`${displayName} profile header`}
    >
      {/* Banner */}
      <div
        className="group relative aspect-[16/5] w-full overflow-hidden bg-gradient-to-br from-primary/20 via-accent/20 to-primary/30"
        role="img"
        aria-label={bannerUrl ? `${displayName}'s cover banner` : "Default profile banner"}
      >
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500"
            style={{
              objectPosition: `${pos.x}% ${pos.y}%`,
              transform: `scale(${pos.zoom || 1})`,
            }}
          />
        ) : (
          <div className="absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(1000px_circle_at_20%_0%,hsl(var(--primary)/0.35),transparent_60%),radial-gradient(800px_circle_at_100%_100%,hsl(var(--accent)/0.35),transparent_60%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,hsl(var(--background)/0.4))]" />
          </div>
        )}
        {isOwner && onEditBanner && (
          <button
            type="button"
            onClick={onEditBanner}
            aria-label="Change cover banner"
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground opacity-0 shadow backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Camera className="h-3.5 w-3.5" /> Change banner
          </button>
        )}
      </div>

      {/* Body */}
      <div className="relative px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
        {/* Avatar overlaps banner */}
        <div className="-mt-12 flex items-end sm:-mt-16 md:-mt-20">
          <div className="group relative">
            <Avatar className="h-24 w-24 shrink-0 rounded-full border-4 border-background bg-background shadow-xl sm:h-28 sm:w-28 md:h-36 md:w-36">
              <AvatarImage src={avatarUrl ?? undefined} alt={`${displayName} profile picture`} />
              <AvatarFallback className="text-2xl font-display sm:text-3xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            {isOwner && onEditAvatar && (
              <button
                type="button"
                onClick={onEditAvatar}
                aria-label="Change profile picture"
                className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Camera className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="mt-4 flex flex-col gap-4 sm:mt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl truncate">
                {displayName}
              </h1>
              {verified && (
                <CheckCircle2
                  className="h-5 w-5 text-primary"
                  aria-label="Verified"
                />
              )}
            </div>
            {headline && (
              <p className="text-sm text-foreground/90 sm:text-base">{headline}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
              {location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {location}
                </span>
              )}
              {meta && <span>{meta}</span>}
            </div>
            {bio && (
              <p className="max-w-2xl pt-2 text-sm leading-relaxed text-muted-foreground">
                {bio}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isOwner ? ownerActions : actions}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

// Re-export for consumers building custom action rows.
export { Button as ProfileHeaderButton };
