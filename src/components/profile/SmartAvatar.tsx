import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfileMediaUrl } from "@/hooks/useProfileMediaUrl";
import { PROFILE_PICTURES_BUCKET } from "@/lib/profile-media";
import { cn } from "@/lib/utils";

type Props = {
  value?: string | null;
  name?: string | null;
  className?: string;
  alt?: string;
};

/**
 * Avatar that transparently resolves either a legacy http(s) URL
 * or a storage path from the `profile-pictures` bucket via a
 * cached signed URL. Falls back to initials on empty / missing.
 */
export function SmartAvatar({ value, name, className, alt }: Props) {
  const { url } = useProfileMediaUrl(PROFILE_PICTURES_BUCKET, value);
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={url ?? undefined} alt={alt ?? (name ? `${name} profile picture` : "Profile picture")} loading="lazy" />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
