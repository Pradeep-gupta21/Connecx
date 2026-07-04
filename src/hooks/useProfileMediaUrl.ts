import { useQuery } from "@tanstack/react-query";
import { resolveProfileMediaUrl } from "@/lib/profile-media";

/**
 * Resolves a profile media stored value (path or URL) to a display URL.
 * Storage paths yield a short-lived signed URL and are cached in React Query.
 */
export function useProfileMediaUrl(bucket: string, value: string | null | undefined) {
  const query = useQuery({
    queryKey: ["profile-media", bucket, value ?? null],
    enabled: !!value,
    queryFn: () => resolveProfileMediaUrl(bucket, value, 60 * 60),
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  return { url: query.data ?? null, isLoading: query.isLoading };
}
