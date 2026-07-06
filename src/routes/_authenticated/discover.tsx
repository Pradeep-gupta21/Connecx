import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { SmartAvatar } from "@/components/profile/SmartAvatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeletons";
import { CREATOR_CATEGORIES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({ meta: [{ title: "Discover creators · Connecx" }] }),
  component: Discover,
});

const PAGE_SIZE = 24;

// Debounce hook (avoid firing on every keystroke)
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type CreatorRow = {
  user_id: string;
  headline: string | null;
  categories: string[] | null;
  languages: string[] | null;
  rate_min: number | null;
  rate_max: number | null;
  follower_count: number | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  location: string | null;
  bio: string | null;
  updated_at: string | null;
  total_count: number;
};

function Discover() {
  const [qRaw, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [skillRaw, setSkill] = useState("");
  const [locationRaw, setLocation] = useState("");

  const q = useDebounced(qRaw);
  const skill = useDebounced(skillRaw);
  const location = useDebounced(locationRaw);

  const filters = { q, cat, skill, location };

  const query = useInfiniteQuery({
    queryKey: ["creators-search", filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("search_creators", {
        _q: q || undefined,
        _category: cat === "all" ? undefined : cat,
        _skill: skill || undefined,
        _location: location || undefined,
        _limit: PAGE_SIZE,
        _offset: pageParam as number,
      });
      if (error) throw error;
      return { rows: (data ?? []) as CreatorRow[], offset: pageParam as number };
    },

    getNextPageParam: (last) => {
      const total = last.rows[0]?.total_count ?? 0;
      const nextOffset = last.offset + last.rows.length;
      return nextOffset < Number(total) ? nextOffset : undefined;
    },
  });

  const rows = useMemo(
    () => query.data?.pages.flatMap((p) => p.rows) ?? [],
    [query.data],
  );
  const total = query.data?.pages[0]?.rows[0]?.total_count ?? 0;

  // Infinite-scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Discover creators"
        description="Browse vetted creators by category, skill, and location."
      />

      <div className="grid gap-3 md:grid-cols-[1fr,200px,180px,180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={qRaw}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, @username, headline…"
            className="pl-9 h-10"
            aria-label="Search creators"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-10" aria-label="Category">
            <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CREATOR_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={skillRaw}
          onChange={(e) => setSkill(e.target.value)}
          placeholder="Skill"
          className="h-10"
          aria-label="Skill"
        />
        <Input
          value={locationRaw}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="h-10"
          aria-label="Location"
        />
      </div>

      {query.isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={Search}
          title="Couldn't load creators"
          description={(query.error as Error)?.message ?? "Try again in a moment."}
          action={{ label: "Retry", onClick: () => query.refetch() }}
        />

      ) : rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No creators found"
          description="Try adjusting your filters or check back soon."
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            {Number(total).toLocaleString()} creator{Number(total) === 1 ? "" : "s"}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((c) => (
              <Link
                key={c.user_id}
                to="/creators/$id"
                params={{ id: c.user_id }}
                className="surface-card p-5 hover:shadow-elevated hover:-translate-y-px transition-all group"
              >
                <div className="flex items-start gap-3">
                  <SmartAvatar
                    className="h-12 w-12"
                    value={c.avatar_url}
                    name={c.display_name}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate group-hover:underline">
                      {c.display_name ?? "Creator"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.username ? `@${c.username}` : c.location ?? "—"}
                    </div>
                  </div>
                </div>
                {c.headline && (
                  <p className="mt-4 text-sm text-muted-foreground line-clamp-2">{c.headline}</p>
                )}
                {(c.categories ?? []).length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(c.categories ?? []).slice(0, 3).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                    ))}
                  </div>
                )}
                {(c.rate_min || c.rate_max) && (
                  <p className="mt-4 text-xs font-medium tabular-nums">
                    ${c.rate_min ?? "?"} – ${c.rate_max ?? "?"}{" "}
                    <span className="text-muted-foreground font-normal">/ campaign</span>
                  </p>
                )}
              </Link>
            ))}
          </div>

          <div ref={sentinelRef} className="h-8" />
          {query.isFetchingNextPage && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          )}
          {!query.hasNextPage && rows.length > PAGE_SIZE && (
            <p className="text-center text-xs text-muted-foreground py-4">
              You've reached the end.
            </p>
          )}
        </>
      )}
    </div>
  );
}
