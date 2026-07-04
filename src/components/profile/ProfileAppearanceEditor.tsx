import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { useProfileMediaUrl } from "@/hooks/useProfileMediaUrl";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPTED_IMAGE_TYPES,
  AVATAR_MAX_BYTES,
  BANNER_MAX_BYTES,
  DEFAULT_BANNER_POSITION,
  PROFILE_BANNERS_BUCKET,
  PROFILE_PICTURES_BUCKET,
  removeProfileMediaByPath,
  uploadProfileMedia,
  validateImageFile,
  type BannerPosition,
} from "@/lib/profile-media";

type Props = {
  avatarValue: string | null;
  bannerValue: string | null;
  bannerPosition: BannerPosition | null;
  displayName: string;
};

/**
 * Appearance editor — upload / replace / remove / reposition banner + avatar.
 * Reads the current values from props, writes back to `profiles`.
 */
export function ProfileAppearanceEditor({
  avatarValue,
  bannerValue,
  bannerPosition,
  displayName,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Pending selections (previewed but not saved)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);

  const [pos, setPos] = useState<BannerPosition>(
    bannerPosition ?? DEFAULT_BANNER_POSITION,
  );
  const [saving, setSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bannerDragRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startPosY: number } | null>(null);

  useEffect(() => {
    setPos(bannerPosition ?? DEFAULT_BANNER_POSITION);
  }, [bannerPosition]);

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
  }, [avatarPreview, bannerPreview]);

  const { url: savedAvatarUrl } = useProfileMediaUrl(
    PROFILE_PICTURES_BUCKET,
    avatarRemoved ? null : avatarValue,
  );
  const { url: savedBannerUrl } = useProfileMediaUrl(
    PROFILE_BANNERS_BUCKET,
    bannerRemoved ? null : bannerValue,
  );

  const currentAvatarSrc = avatarPreview ?? savedAvatarUrl ?? undefined;
  const currentBannerSrc = bannerPreview ?? savedBannerUrl ?? undefined;

  const dirty = useMemo(
    () =>
      !!avatarFile ||
      avatarRemoved ||
      !!bannerFile ||
      bannerRemoved ||
      JSON.stringify(pos) !== JSON.stringify(bannerPosition ?? DEFAULT_BANNER_POSITION),
    [avatarFile, avatarRemoved, bannerFile, bannerRemoved, pos, bannerPosition],
  );

  const handlePick = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "avatar" | "banner",
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateImageFile(file, {
      maxBytes: kind === "avatar" ? AVATAR_MAX_BYTES : BANNER_MAX_BYTES,
      kind,
    });
    if (err) {
      toast.error(err);
      return;
    }
    const url = URL.createObjectURL(file);
    if (kind === "avatar") {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(url);
      setAvatarFile(file);
      setAvatarRemoved(false);
    } else {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      setBannerPreview(url);
      setBannerFile(file);
      setBannerRemoved(false);
    }
  };

  const removeAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarRemoved(true);
  };
  const removeBanner = () => {
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(null);
    setBannerFile(null);
    setBannerRemoved(true);
  };

  // Drag-to-reposition (vertical Y)
  const onBannerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!currentBannerSrc) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, startPosY: pos.y };
  };
  const onBannerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !bannerDragRef.current) return;
    const rect = bannerDragRef.current.getBoundingClientRect();
    const deltaPct = ((dragState.current.startY - e.clientY) / rect.height) * 100;
    const nextY = Math.min(100, Math.max(0, dragState.current.startPosY + deltaPct));
    setPos((p) => ({ ...p, y: nextY }));
  };
  const onBannerPointerUp = () => {
    dragState.current = null;
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};

      // Avatar
      if (avatarFile) {
        const newPath = await uploadProfileMedia(PROFILE_PICTURES_BUCKET, user.id, avatarFile);
        updates.avatar_url = newPath;
        updates.avatar_updated_at = new Date().toISOString();
        await removeProfileMediaByPath(PROFILE_PICTURES_BUCKET, avatarValue);
      } else if (avatarRemoved) {
        updates.avatar_url = null;
        updates.avatar_updated_at = new Date().toISOString();
        await removeProfileMediaByPath(PROFILE_PICTURES_BUCKET, avatarValue);
      }

      // Banner
      if (bannerFile) {
        const newPath = await uploadProfileMedia(PROFILE_BANNERS_BUCKET, user.id, bannerFile);
        updates.banner_url = newPath;
        updates.banner_updated_at = new Date().toISOString();
        updates.banner_position = pos;
        await removeProfileMediaByPath(PROFILE_BANNERS_BUCKET, bannerValue);
      } else if (bannerRemoved) {
        updates.banner_url = null;
        updates.banner_updated_at = new Date().toISOString();
        updates.banner_position = DEFAULT_BANNER_POSITION;
        await removeProfileMediaByPath(PROFILE_BANNERS_BUCKET, bannerValue);
      } else if (JSON.stringify(pos) !== JSON.stringify(bannerPosition ?? DEFAULT_BANNER_POSITION)) {
        updates.banner_position = pos;
      }

      if (Object.keys(updates).length === 0) {
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;

      toast.success("Profile appearance updated");
      setAvatarFile(null);
      setBannerFile(null);
      setAvatarRemoved(false);
      setBannerRemoved(false);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }
      if (bannerPreview) {
        URL.revokeObjectURL(bannerPreview);
        setBannerPreview(null);
      }
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["profile-media"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save appearance");
    } finally {
      setSaving(false);
    }
  };

  const initials = (displayName || "?").slice(0, 2).toUpperCase();

  return (
    <div className="surface-card space-y-6 p-6">
      <div>
        <h3 className="font-display text-lg font-semibold">Profile Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Upload a cover banner and profile picture. Changes are saved only when you press Save.
        </p>
      </div>

      {/* Banner preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Cover banner</p>
          <p className="text-xs text-muted-foreground">Recommended 1584×495 · JPG/PNG/WEBP · max 5MB</p>
        </div>
        <div
          ref={bannerDragRef}
          onPointerDown={onBannerPointerDown}
          onPointerMove={onBannerPointerMove}
          onPointerUp={onBannerPointerUp}
          onPointerCancel={onBannerPointerUp}
          className="relative aspect-[16/5] w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/20 via-accent/20 to-primary/30 select-none"
          role="img"
          aria-label="Banner preview — drag to reposition"
        >
          {currentBannerSrc ? (
            <img
              src={currentBannerSrc}
              alt=""
              draggable={false}
              className="h-full w-full cursor-grab object-cover active:cursor-grabbing"
              style={{ objectPosition: `${pos.x}% ${pos.y}%`, transform: `scale(${pos.zoom})` }}
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              A branded gradient will show if no banner is uploaded.
            </div>
          )}
        </div>
        {currentBannerSrc && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-16 text-xs text-muted-foreground">Zoom</span>
              <Slider
                value={[pos.zoom * 100]}
                min={100}
                max={200}
                step={1}
                onValueChange={([v]) => setPos((p) => ({ ...p, zoom: v / 100 }))}
                className="flex-1"
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={bannerInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => handlePick(e, "banner")}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => bannerInputRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" />
            {currentBannerSrc ? "Change" : "Upload"}
          </Button>
          {currentBannerSrc && (
            <Button type="button" variant="ghost" size="sm" onClick={removeBanner}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      </div>

      {/* Avatar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Profile picture</p>
          <p className="text-xs text-muted-foreground">Min 512×512 · JPG/PNG/WEBP · max 2MB</p>
        </div>
        <div className="flex items-center gap-4">
          <Avatar className="h-24 w-24 border-4 border-background shadow-md sm:h-28 sm:w-28">
            <AvatarImage src={currentAvatarSrc} alt="Profile picture preview" />
            <AvatarFallback className="text-2xl font-display">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => handlePick(e, "avatar")}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}>
              <Camera className="mr-1.5 h-4 w-4" />
              {currentAvatarSrc ? "Change" : "Upload"}
            </Button>
            {currentAvatarSrc && (
              <Button type="button" variant="ghost" size="sm" onClick={removeAvatar}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
