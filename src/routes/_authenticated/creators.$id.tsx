import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, MapPin, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/creators/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Creator · BrandBridge` }],
  }),
  component: CreatorPage,
});

function CreatorPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["creator", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_profiles")
        .select("*, profiles!inner(display_name, avatar_url, location, bio)")
        .eq("user_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const startConversation = async () => {
    if (!user || user.id === id) return;
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("advertiser_id", user.id)
      .eq("creator_id", id)
      .is("campaign_id", null)
      .maybeSingle();
    let convoId = existing?.id;
    if (!convoId) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ advertiser_id: user.id, creator_id: id, campaign_id: null })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      convoId = created.id;
    }
    navigate({ to: "/messages/$threadId", params: { threadId: convoId! } });
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Creator not found.</p>
        <Link to="/discover" className="mt-4 inline-block text-sm text-accent">Back to discover</Link>
      </div>
    );
  }

  const p: any = data.profiles;
  const portfolio = (data.portfolio_media as any[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <Link to="/discover" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to discover
      </Link>

      <div className="flex flex-col md:flex-row gap-8 md:items-end justify-between">
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20">
            <AvatarImage src={p?.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg">{(p?.display_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{p?.display_name}</h1>
            {p?.location && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {p.location}
              </p>
            )}
          </div>
        </div>
        {user && user.id !== id && (
          <Button onClick={startConversation} className="gap-2">
            <MessageSquare className="h-4 w-4" /> Message
          </Button>
        )}
      </div>

      {data.headline && (
        <p className="text-lg leading-relaxed max-w-2xl">{data.headline}</p>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Rate</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
            {data.rate_min || data.rate_max
              ? <>${data.rate_min ?? "?"} – ${data.rate_max ?? "?"}</>
              : "—"}
          </p>
        </div>
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Followers</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
            {data.follower_count ? data.follower_count.toLocaleString() : "—"}
          </p>
        </div>
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Available</p>
          <p className="mt-2 font-display text-2xl font-semibold">{data.available ? "Yes" : "Booked"}</p>
        </div>
      </div>

      {(data.categories ?? []).length > 0 && (
        <div>
          <h2 className="font-display text-sm font-semibold mb-3">Categories</h2>
          <div className="flex flex-wrap gap-1.5">
            {(data.categories ?? []).map((c: string) => (
              <Badge key={c} variant="secondary">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      {p?.bio && (
        <div>
          <h2 className="font-display text-sm font-semibold mb-3">About</h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{p.bio}</p>
        </div>
      )}

      {portfolio.length > 0 && (
        <div>
          <h2 className="font-display text-sm font-semibold mb-3">Portfolio</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {portfolio.map((m: any, i: number) => (
              <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden bg-secondary">
                {m?.url && <img src={m.url} alt={m?.alt ?? ""} className="h-full w-full object-cover" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
