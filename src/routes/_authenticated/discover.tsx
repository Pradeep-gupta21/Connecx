import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  head: () => ({ meta: [{ title: "Discover creators · BrandBridge" }] }),
  component: Discover,
});

function Discover() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["creators", cat],
    queryFn: async () => {
      let query = supabase
        .from("creator_profiles")
        .select("user_id, headline, categories, rate_min, rate_max, follower_count, profiles!creator_profiles_profile_fkey!inner(display_name, avatar_url, location, bio)")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (cat !== "all") query = query.contains("categories", [cat]);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!q) return data;
    const term = q.toLowerCase();
    return data.filter((c: any) =>
      [c.profiles?.display_name, c.headline, c.profiles?.location, ...(c.categories ?? [])]
        .filter(Boolean).join(" ").toLowerCase().includes(term)
    );
  }, [data, q]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Discover creators"
        description="Browse vetted creators by category, rate, and location."
      />

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, headline, location..."
            className="pl-9 h-10"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="md:w-56 h-10">
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
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No creators found"
          description="Try adjusting your filters or check back soon."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: any) => (
            <Link
              key={c.user_id}
              to="/creators/$id"
              params={{ id: c.user_id }}
              className="surface-card p-5 hover:shadow-elevated hover:-translate-y-px transition-all group"
            >
              <div className="flex items-start gap-3">
                <SmartAvatar
                  className="h-12 w-12"
                  value={c.profiles?.avatar_url}
                  name={c.profiles?.display_name}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate group-hover:underline">{c.profiles?.display_name ?? "Creator"}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.profiles?.location ?? "—"}</div>
                </div>
              </div>
              {c.headline && <p className="mt-4 text-sm text-muted-foreground line-clamp-2">{c.headline}</p>}
              {(c.categories ?? []).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(c.categories ?? []).slice(0,3).map((cat: string) => (
                    <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                  ))}
                </div>
              )}
              {(c.rate_min || c.rate_max) && (
                <p className="mt-4 text-xs font-medium tabular-nums">
                  ${c.rate_min ?? "?"} – ${c.rate_max ?? "?"} <span className="text-muted-foreground font-normal">/ campaign</span>
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
