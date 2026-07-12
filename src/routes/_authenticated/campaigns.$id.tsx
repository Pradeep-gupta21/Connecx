import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Loader2, MessageSquare, Pencil, Pause, Play, Archive, XCircle, Trash2, Bookmark, BookmarkCheck, Paperclip, ShieldCheck, Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { CREATOR_TIERS } from "@/components/campaigns/CampaignForm";
import { DeliverablesPanel } from "@/components/payments/DeliverablesPanel";
import { useAcceptCreator, useFundContract, useFeePreview } from "@/hooks/usePayments";
import { PitchNegotiationDialog } from "@/components/campaigns/PitchNegotiationDialog";

export const Route = createFileRoute("/_authenticated/campaigns/$id")({
  head: () => ({ meta: [{ title: "Campaign · Connecx" }] }),
  component: CampaignDetail,
});


function statusLabel(s: string) {
  if (s === "open") return "Published";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CampaignDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { activeRole } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const campaignQuery = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, profiles:advertiser_id(display_name, avatar_url, location)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isOwner = user?.id === campaignQuery.data?.advertiser_id;

  const applicationsQuery = useQuery({
    queryKey: ["campaign-apps", id],
    enabled: !!campaignQuery.data && (isOwner || activeRole === "creator"),
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("*, profiles:creator_id(display_name, avatar_url, location)")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const savedQuery = useQuery({
    queryKey: ["saved-campaign", id, user?.id],
    enabled: !!user && !isOwner,
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_campaigns")
        .select("id")
        .eq("user_id", user!.id)
        .eq("campaign_id", id)
        .maybeSingle();
      return data;
    },
  });

  const contractsQuery = useQuery({
    queryKey: ["campaign-contracts", id, user?.id],
    enabled: !!user && !!campaignQuery.data,
    queryFn: async () => {
      let q = supabase
        .from("contracts")
        .select("id, status, advertiser_id, creator_id, deliverable_urls, submission_notes, submitted_at, reviewed_at, revision_notes, revision_count, amount, currency, profiles:creator_id(display_name, avatar_url)")
        .eq("campaign_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (!isOwner) q = q.eq("creator_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });


  useEffect(() => {
    if (!campaignQuery.data) return;
    const channel = supabase
      .channel(`camp-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications", filter: `campaign_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["campaign-apps", id] })
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "campaigns", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["campaign", id] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts", filter: `campaign_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["campaign-contracts", id, user?.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc, campaignQuery.data, user?.id]);


  const statusMut = useMutation({
    mutationFn: async (status: "draft" | "open" | "paused" | "closed" | "archived") => {
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, s) => {
      toast.success(`Campaign ${statusLabel(s).toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["campaign", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign deleted");
      navigate({ to: "/campaigns" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (savedQuery.data?.id) {
        await supabase.from("saved_campaigns").delete().eq("id", savedQuery.data.id);
      } else {
        await supabase.from("saved_campaigns").insert({ user_id: user.id, campaign_id: id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-campaign", id, user?.id] }),
  });

  if (campaignQuery.isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  const c = campaignQuery.data;
  if (!c) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Campaign not found.</p>
        <Link to="/campaigns" className="mt-4 inline-block text-sm text-accent">Back to campaigns</Link>
      </div>
    );
  }

  const myApplication = applicationsQuery.data?.find((a) => a.creator_id === user?.id);
  const canApply = !isOwner && activeRole === "creator" && c.status === "open";
  const languages = (c.languages ?? []) as string[];
  const attachments = ((c.attachments ?? []) as { name: string; url: string }[]);
  const tierLabel = CREATOR_TIERS.find((t) => t.value === c.creator_tier)?.label ?? c.creator_tier;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All campaigns
        </Link>
        {!isOwner && user && (
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => toggleSave.mutate()}>
            {savedQuery.data?.id ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
            {savedQuery.data?.id ? "Saved" : "Save"}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={c.status === "open" ? "default" : "secondary"} className="capitalize">{statusLabel(c.status)}</Badge>
            {c.category && <Badge variant="secondary">{c.category}</Badge>}
            {c.platform && <Badge variant="secondary">{c.platform}</Badge>}
            {c.funded && (
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20 gap-1">
                <ShieldCheck className="h-3 w-3" /> Payment received
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">


            {isOwner && <OwnerActions status={c.status} onStatus={(s) => statusMut.mutate(s)} onDelete={() => deleteMut.mutate()} id={id} />}
          </div>
        </div>

        <h1 className="font-display text-4xl font-semibold tracking-tight">{c.title}</h1>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
            <AvatarFallback>{(c.profiles?.display_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <div className="font-medium">{c.profiles?.display_name ?? "Brand"}</div>
            <div className="text-xs text-muted-foreground">{c.profiles?.location ?? "—"}</div>
          </div>
        </div>
      </div>

      {c.brief && (
        <div className="surface-card p-6 md:p-8">
          <h2 className="font-display text-sm font-semibold mb-3">Brief</h2>
          <p className="whitespace-pre-line leading-relaxed text-foreground/90">{c.brief}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Budget" value={c.budget_min || c.budget_max ? `₹${c.budget_min ?? "?"} – ₹${c.budget_max ?? "?"}` : "—"} />
        <Stat label="Deadline" value={c.deadline ? format(new Date(c.deadline), "MMM d, yyyy") : "Open"} />
        <Stat label="Creator size" value={tierLabel ?? "Any"} />
      </div>

      {(c.deliverables || c.requirements || c.location || languages.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {c.deliverables && <InfoCard label="Deliverables" text={c.deliverables} />}
          {c.requirements && <InfoCard label="Requirements" text={c.requirements} />}
          {c.location && <InfoCard label="Location" text={c.location} />}
          {languages.length > 0 && (
            <div className="surface-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Languages</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {languages.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
              </div>
            </div>
          )}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="surface-card p-6">
          <h2 className="font-display text-sm font-semibold mb-3">Attachments</h2>
          <ul className="space-y-2">
            {attachments.map((a, i) => (
              <li key={i}>
                <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm hover:text-accent">
                  <Paperclip className="h-3.5 w-3.5" /> {a.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(!isOwner && activeRole === "creator") && (myApplication || canApply) && (
        <div>
          {myApplication ? (
            <div className="surface-card p-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm">Your application is <Badge variant="secondary" className="capitalize ml-1">{myApplication.status}</Badge></p>
                {myApplication.pitch && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">"{myApplication.pitch}"</p>}
              </div>
              <div className="flex items-center gap-2">
                {myApplication.status !== "withdrawn" && (
                  <>
                    <PitchNegotiationDialog
                      pitchId={myApplication.id}
                      campaignTitle={c.title}
                      isOwner={false}
                      triggerBtn={
                        <Button size="sm" variant="outline" className="gap-1.5 h-8">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Chat & Negotiate
                        </Button>
                      }
                    />
                    <Button variant="outline" size="sm" className="h-8" onClick={async () => {
                      await supabase.from("applications").update({ status: "withdrawn" }).eq("id", myApplication.id);
                      qc.invalidateQueries({ queryKey: ["campaign-apps", id] });
                      toast.success("Application withdrawn");
                    }}>Withdraw</Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <ApplyDialog campaignId={id} />
          )}
        </div>
      )}

      {user && (contractsQuery.data ?? []).length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">
            {isOwner ? "Active contracts" : "Your contract"}
          </h2>
          {(contractsQuery.data ?? []).map((ct: any) => (
            <div key={ct.id} className="space-y-2">
              {isOwner && (
                <p className="text-sm text-muted-foreground">
                  with <span className="font-medium text-foreground">{ct.profiles?.display_name ?? "Creator"}</span>
                </p>
              )}
              {ct.status === "draft" ? (
                <ContractPaymentSection
                  contract={ct}
                  campaignName={c?.title ?? "Campaign"}
                  isOwner={isOwner}
                />
              ) : (
                <DeliverablesPanel
                  contract={{
                    id: ct.id,
                    status: ct.status,
                    advertiser_id: ct.advertiser_id,
                    creator_id: ct.creator_id,
                    deliverable_urls: (ct.deliverable_urls ?? []) as { name: string; url: string }[],
                    submission_notes: ct.submission_notes,
                    submitted_at: ct.submitted_at,
                    reviewed_at: ct.reviewed_at,
                    revision_notes: ct.revision_notes,
                    revision_count: ct.revision_count ?? 0,
                    amount: Number(ct.amount ?? 0),
                    currency: ct.currency ?? "INR",
                  }}
                  currentUserId={user.id}
                />
              )}
            </div>
          ))}
        </section>
      )}

      {isOwner && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Applications</h2>
            <p className="text-xs text-muted-foreground">{applicationsQuery.data?.length ?? 0} total</p>
          </div>
          {applicationsQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !applicationsQuery.data || applicationsQuery.data.length === 0 ? (
            <div className="surface-card p-8 text-center text-sm text-muted-foreground">
              No applications yet. Share your campaign or invite creators.
            </div>
          ) : (
            <ul className="space-y-2">
              {applicationsQuery.data.map((a: any) => (
                <li key={a.id} className="surface-card p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={a.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback>{(a.profiles?.display_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Link to="/creators/$id" params={{ id: a.creator_id }} className="font-medium hover:underline">
                            {a.profiles?.display_name ?? "Creator"}
                          </Link>
                          <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d, h:mm a")}</p>
                        </div>
                        <PitchNegotiationDialog
                          pitchId={a.id}
                          campaignTitle={c?.title ?? "Campaign"}
                          isOwner={isOwner}
                          triggerBtn={
                            <Button size="sm" variant="outline" className="gap-1.5 h-8">
                              <MessageSquare className="h-3.5 w-3.5" />
                              Review & Negotiate
                            </Button>
                          }
                        />
                      </div>
                      {a.pitch && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{a.pitch}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function OwnerActions({
  status, onStatus, onDelete, id,
}: {
  status: string;
  onStatus: (s: "draft" | "open" | "paused" | "closed" | "archived") => void;
  onDelete: () => void;
  id: string;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Link to="/campaigns/$id/edit" params={{ id }}>
        <Button variant="outline" size="sm" className="gap-2"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
      </Link>
      {status === "open" ? (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => onStatus("paused")}>
          <Pause className="h-3.5 w-3.5" /> Pause
        </Button>
      ) : status === "paused" || status === "draft" ? (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => onStatus("open")}>
          <Play className="h-3.5 w-3.5" /> Publish
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status !== "closed" && (
            <DropdownMenuItem onClick={() => onStatus("closed")}><XCircle className="h-4 w-4 mr-2" /> Close campaign</DropdownMenuItem>
          )}
          {status !== "archived" && (
            <DropdownMenuItem onClick={() => onStatus("archived")}><Archive className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete campaign?</DialogTitle>
            <DialogDescription>This is a soft delete — the brief will disappear from the marketplace and dashboards.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setConfirmDelete(false); onDelete(); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}
function InfoCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm whitespace-pre-line text-foreground/90">{text}</p>
    </div>
  );
}

function ApplyDialog({ campaignId }: { campaignId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [coverMessage, setCoverMessage] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [timeline, setTimeline] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const submit = async () => {
    if (!user) return;
    const priceNum = Number(quotedPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Please enter a valid quoted price (greater than 0)");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("campaign_pitches" as any).insert({
      campaign_id: campaignId,
      creator_id: user.id,
      cover_message: coverMessage,
      deliverables: deliverables || null,
      timeline: timeline || null,
      quoted_price: priceNum,
      portfolio_url: portfolioUrl || null,
      status: "submitted",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Your pitch has been submitted successfully!");
    setOpen(false);
    // Reset form fields
    setCoverMessage("");
    setDeliverables("");
    setTimeline("");
    setQuotedPrice("");
    setPortfolioUrl("");
    
    qc.invalidateQueries({ queryKey: ["campaign-apps", campaignId] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-semibold px-6">Apply to this campaign</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display font-semibold">Submit Your Pitch</DialogTitle>
          <DialogDescription>
            Pitch your ideas, define your deliverables, quote your price, and specify your deadline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover Message</label>
            <Textarea
              rows={4}
              placeholder="Tell the advertiser why you are the perfect fit for this campaign, share your ideas, or outline your experience."
              value={coverMessage}
              onChange={(e) => setCoverMessage(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proposed Deliverables</label>
            <Textarea
              rows={3}
              placeholder="e.g. 1x Instagram Reel (60s), 2x Stories with link stickers, and full usage rights for 30 days."
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quoted Price (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">₹</span>
                <Input
                  type="number"
                  placeholder="5000"
                  value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                  className="pl-7 font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline / Deadline</label>
              <Input
                type="text"
                placeholder="e.g. 10 days, or Aug 15"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio URL (Optional)</label>
            <Input
              type="url"
              placeholder="https://behance.net/username or link to Google Drive/social profile"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || coverMessage.length < 5 || !quotedPrice}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Submit Pitch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


async function startConvoFromApp(a: any, campaignId: string): Promise<string | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .or(`and(advertiser_id.eq.${uid},creator_id.eq.${a.creator_id}),and(advertiser_id.eq.${a.creator_id},creator_id.eq.${uid})`)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ advertiser_id: uid, creator_id: a.creator_id, campaign_id: campaignId })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("conversations")
        .select("id")
        .or(`and(advertiser_id.eq.${uid},creator_id.eq.${a.creator_id}),and(advertiser_id.eq.${a.creator_id},creator_id.eq.${uid})`)
        .eq("campaign_id", campaignId)
        .maybeSingle();
      return retry?.id ?? null;
    }
    toast.error(error.message);
    return null;
  }
  return created.id;
}

function ContractPaymentSection({
  contract,
  campaignName,
  isOwner,
}: {
  contract: any;
  campaignName: string;
  isOwner: boolean;
}) {
  const fund = useFundContract(campaignName);
  const preview = useFeePreview(Number(contract.amount));

  if (!isOwner) {
    return (
      <div className="surface-card p-6 border border-amber-500/20 bg-amber-500/5 space-y-3 rounded-xl">
        <h3 className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 text-base">
          <Wallet className="h-5 w-5 animate-pulse" /> Awaiting Secure Payment
        </h3>
        <p className="text-sm text-muted-foreground">
          The advertiser has accepted your pitch. Please do not start working on the deliverables until the advertiser secures the payment of <span className="font-semibold text-foreground">₹{contract.amount.toLocaleString("en-IN")}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card p-6 border border-accent/20 bg-accent/5 space-y-4 rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5 text-accent" /> Secure Creator Payment
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            You accepted <span className="font-semibold text-foreground">{contract.profiles?.display_name ?? "Creator"}</span>. Pay now to secure the funds and activate the work.
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 capitalize">
          Awaiting Secure Payment
        </span>
      </div>

      {preview.data && (
        <div className="border border-border/60 rounded-lg p-4 bg-background/50 space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Creator Earnings</span>
            <span className="font-mono text-foreground font-medium">₹{preview.data.creator_earnings.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform Fee ({preview.data.platform_fee_pct}%)</span>
            <span className="font-mono text-foreground font-medium">₹{preview.data.platform_fee.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between">
            <span>GST ({preview.data.gst_pct}%)</span>
            <span className="font-mono text-foreground font-medium">₹{preview.data.gst.toLocaleString("en-IN")}</span>
          </div>
          <div className="border-t border-border/80 pt-2 flex justify-between font-semibold text-foreground text-base">
            <span>Total Payable</span>
            <span className="font-mono">₹{preview.data.total_payable.toLocaleString("en-IN")}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          disabled={fund.isPending}
          onClick={() => fund.mutate(contract.id)}
          className="gap-2 px-6"
        >
          {fund.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay Now"}
        </Button>
      </div>
    </div>
  );
}

