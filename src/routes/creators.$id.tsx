import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, MessageSquare, MapPin, Loader2, Star, Sparkles,
  Instagram, Youtube, Twitter, Globe, Music2, CheckCircle2,
  Calendar, Users, TrendingUp, Languages as LangIcon, Mail, ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProfileHeader } from "@/components/profile/ProfileHeader";

export const Route = createFileRoute("/creators/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Creator profile · BrandBridge` },
      { name: "description", content: "Discover this creator on BrandBridge." },
      { property: "og:title", content: "Creator profile · BrandBridge" },
      { property: "og:description", content: "Discover this creator on BrandBridge." },
    ],
  }),
  component: CreatorProfilePage,
});

const socialIcons: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  tiktok: Music2,
  website: Globe,
};

function computeCompletion(data: any, profile: any, socials: any[], portfolio: any[]) {
  const fields = [
    !!profile?.display_name,
    !!profile?.avatar_url,
    !!profile?.bio,
    !!profile?.location,
    !!data?.headline,
    (data?.categories ?? []).length > 0,
    !!data?.rate_min || !!data?.rate_max,
    (data?.languages ?? []).length > 0,
    socials.length > 0,
    portfolio.length > 0,
    !!data?.audience_demographics && Object.keys(data.audience_demographics).length > 0,
    (data?.pricing ?? []).length > 0,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function CreatorProfilePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["public-creator", id],
    queryFn: async () => {
      const [{ data: creator }, { data: socials }, { data: portfolio }, { data: reviews }] = await Promise.all([
        supabase
          .from("creator_profiles")
          .select("*, profiles!creator_profiles_profile_fkey!inner(display_name, avatar_url, location, bio, country, banner_url, banner_position)")
          .eq("user_id", id)
          .maybeSingle(),
        supabase.from("social_accounts").select("*").eq("user_id", id),
        supabase.from("portfolio").select("*").eq("creator_id", id).eq("is_public", true).order("position"),
        supabase
          .from("reviews")
          .select("*, reviewer:profiles!reviews_reviewer_id_fkey(display_name, avatar_url)")
          .eq("reviewee_id", id)
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      return { creator, socials: socials ?? [], portfolio: portfolio ?? [], reviews: reviews ?? [] };
    },
  });

  const startConversation = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/creators/${id}` } as any });
      return;
    }
    if (user.id === id) return;
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
      if (error) { toast.error(error.message); return; }
      convoId = created.id;
    }
    navigate({ to: "/messages/$threadId", params: { threadId: convoId! } });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.creator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Creator not found.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">Go home</Link>
        </div>
      </div>
    );
  }

  const c: any = data.creator;
  const p: any = c.profiles;
  const socials = data.socials;
  const portfolio = data.portfolio;
  const reviews = data.reviews;
  const collabs = (c.past_collaborations as any[]) ?? [];
  const pricing = (c.pricing as any[]) ?? [];
  const demographics = (c.audience_demographics as any) ?? {};
  const analytics = (c.analytics as any) ?? {};
  const languages = (c.languages as string[]) ?? [];
  const avgRating = reviews.length ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : null;
  const completion = computeCompletion(c, p, socials, portfolio);
  const availabilityLabel = c.availability_status === "unavailable"
    ? "Fully booked"
    : c.availability_status === "limited" ? "Limited availability" : "Available for work";

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> BrandBridge
          </Link>
          <Button onClick={startConversation} size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Message
          </Button>
        </div>
      </div>

      {/* Hero */}
      <section className="relative border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10 space-y-6">
          <ProfileHeader
            displayName={p?.display_name ?? "Creator"}
            avatarValue={p?.avatar_url ?? null}
            bannerValue={p?.banner_url ?? null}
            bannerPosition={(p?.banner_position as any) ?? null}
            headline={c.headline}
            location={p?.location}
            meta={[
              (c.categories ?? [])[0],
              c.follower_count ? `${c.follower_count.toLocaleString()} followers` : null,
              availabilityLabel,
            ].filter(Boolean).join(" • ")}
            bio={p?.bio}
            verified={!!c.is_verified}
            isOwner={user?.id === id}
            actions={
              <Button onClick={startConversation} className="gap-2">
                <MessageSquare className="h-4 w-4" /> Message
              </Button>
            }
            ownerActions={
              <Button asChild variant="outline">
                <Link to="/settings">Edit profile</Link>
              </Button>
            }
          />

          {/* Quick stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <StatBlock icon={Users} label="Followers" value={c.follower_count ? c.follower_count.toLocaleString() : "—"} />
            <StatBlock icon={TrendingUp} label="Engagement" value={analytics.engagement_rate ? `${analytics.engagement_rate}%` : "—"} />
            <StatBlock icon={Sparkles} label="Rate" value={c.rate_min || c.rate_max ? `$${c.rate_min ?? "?"}–${c.rate_max ?? "?"}` : "—"} />
            <StatBlock icon={CheckCircle2} label="Profile score" value={`${completion}%`} accent />
          </motion.div>
        </div>
      </section>


      <div className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-3 gap-12">
        {/* MAIN */}
        <div className="lg:col-span-2 space-y-16">
          {p?.bio && (
            <Section title="Bio">
              <p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line">{p.bio}</p>
            </Section>
          )}

          {portfolio.length > 0 && (
            <Section title="Portfolio">
              <div className="grid sm:grid-cols-2 gap-4">
                {portfolio.map((item: any, i: number) => (
                  <motion.a
                    key={item.id}
                    href={item.external_url ?? "#"}
                    target={item.external_url ? "_blank" : undefined}
                    rel="noreferrer"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="group rounded-2xl border border-border overflow-hidden bg-card hover:border-primary/40 transition-all hover:shadow-xl hover:-translate-y-0.5"
                  >
                    <div className="aspect-[4/3] bg-secondary overflow-hidden">
                      {item.cover_url ? (
                        <img src={item.cover_url} alt={item.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                          {item.title}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-display font-semibold group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {item.title}
                        {item.external_url && <ExternalLink className="h-3.5 w-3.5 opacity-60" />}
                      </h3>
                      {item.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      )}
                    </div>
                  </motion.a>
                ))}
              </div>
            </Section>
          )}

          {collabs.length > 0 && (
            <Section title="Past collaborations">
              <div className="grid sm:grid-cols-2 gap-3">
                {collabs.map((collab: any, i: number) => (
                  <div key={i} className="rounded-xl border border-border p-4 bg-card">
                    <p className="font-semibold">{collab.brand}</p>
                    {collab.year && <p className="text-xs text-muted-foreground mt-0.5">{collab.year}</p>}
                    {collab.description && (
                      <p className="text-sm text-muted-foreground mt-2">{collab.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {pricing.length > 0 && (
            <Section title="Pricing">
              <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
                {pricing.map((tier: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-5">
                    <div>
                      <p className="font-display font-semibold">{tier.name}</p>
                      {tier.description && <p className="text-sm text-muted-foreground">{tier.description}</p>}
                    </div>
                    <p className="font-display text-2xl font-semibold tabular-nums">
                      ${tier.price?.toLocaleString?.() ?? tier.price}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {reviews.length > 0 && (
            <Section title="Reviews">
              <div className="space-y-4">
                {reviews.map((r: any) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="rounded-xl border border-border p-5 bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={r.reviewer?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {(r.reviewer?.display_name ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{r.reviewer?.display_name ?? "Anonymous"}</p>
                        <div className="flex gap-0.5 text-amber-500 mt-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-3 w-3", i < r.rating ? "fill-current" : "opacity-30")} />
                          ))}
                        </div>
                      </div>
                    </div>
                    {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                    {r.body && <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{r.body}</p>}
                  </motion.div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-8 lg:sticky lg:top-24 self-start">
          {socials.length > 0 && (
            <Panel title="Social">
              <div className="space-y-2">
                {socials.map((s: any) => {
                  const Icon = socialIcons[s.platform] ?? Globe;
                  return (
                    <a
                      key={s.id}
                      href={s.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary transition-colors"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate capitalize">{s.platform}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{s.handle}
                          {s.follower_count ? ` · ${s.follower_count.toLocaleString()}` : ""}
                        </p>
                      </div>
                      {s.verified && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </a>
                  );
                })}
              </div>
            </Panel>
          )}

          {(c.categories ?? []).length > 0 && (
            <Panel title="Categories">
              <div className="flex flex-wrap gap-1.5">
                {(c.categories ?? []).map((cat: string) => (
                  <Badge key={cat} variant="secondary" className="rounded-full">{cat}</Badge>
                ))}
              </div>
            </Panel>
          )}

          {languages.length > 0 && (
            <Panel title="Languages" icon={LangIcon}>
              <div className="flex flex-wrap gap-1.5">
                {languages.map((l) => (
                  <Badge key={l} variant="outline" className="rounded-full">{l}</Badge>
                ))}
              </div>
            </Panel>
          )}

          {Object.keys(demographics).length > 0 && (
            <Panel title="Audience">
              <DemographicsBlock demo={demographics} />
            </Panel>
          )}

          {Object.keys(analytics).length > 0 && (
            <Panel title="Analytics">
              <dl className="space-y-2 text-sm">
                {Object.entries(analytics).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt>
                    <dd className="font-medium tabular-nums">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}

          <Panel title="Profile completion" icon={CheckCircle2}>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl font-semibold tabular-nums">{completion}%</span>
                <span className="text-xs text-muted-foreground">of profile filled</span>
              </div>
              <Progress value={completion} className="h-2" />
            </div>
          </Panel>

          <Panel title="Availability" icon={Calendar}>
            <p className="text-sm">{availabilityLabel}</p>
            {c.available && (
              <p className="text-xs text-muted-foreground mt-1">Currently accepting collaborations.</p>
            )}
          </Panel>

          <Panel title="Contact" icon={Mail}>
            <Button onClick={startConversation} className="w-full gap-2">
              <MessageSquare className="h-4 w-4" /> Send message
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground text-center">
              Typically replies within a day
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function StatBlock({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 backdrop-blur-sm",
      accent ? "border-primary/30 bg-primary/5" : "border-border bg-card/50",
    )}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="font-display text-2xl font-semibold tracking-tight mb-6">{title}</h2>
      {children}
    </motion.section>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground font-medium mb-4">
        {Icon && <Icon className="h-3 w-3" />} {title}
      </h3>
      {children}
    </div>
  );
}

function DemographicsBlock({ demo }: { demo: any }) {
  const groups: Array<{ label: string; entries: Record<string, number> }> = [];
  if (demo.gender) groups.push({ label: "Gender", entries: demo.gender });
  if (demo.age) groups.push({ label: "Age", entries: demo.age });
  if (demo.country || demo.countries) groups.push({ label: "Top countries", entries: demo.country ?? demo.countries });
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{g.label}</p>
          <div className="space-y-1.5">
            {Object.entries(g.entries).slice(0, 5).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="capitalize">{k}</span>
                  <span className="tabular-nums text-muted-foreground">{v}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
