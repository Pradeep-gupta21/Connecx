import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Loader2, MessageSquare, Pencil, Pause, Play, Archive, XCircle, Trash2, Bookmark, BookmarkCheck, Paperclip,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { CREATOR_TIERS } from "@/components/campaigns/CampaignForm";

export const Route = createFileRoute("/_authenticated/campaigns/$id")({
  head: () => ({ meta: [{ title: "Campaign · BrandBridge" }] }),
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc, campaignQuery.data]);

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
      const { error } = await supabase.from("campaigns").update({ deleted_at: new Date().toISOString() }).eq("id", id);
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
  const attachments = ((c.attachments ?? []) as { name: string; url: string }[]) ?? [];
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={c.status === "open" ? "default" : "secondary"} className="capitalize">{statusLabel(c.status)}</Badge>
            {c.category && <Badge variant="secondary">{c.category}</Badge>}
            {c.platform && <Badge variant="secondary">{c.platform}</Badge>}
          </div>
          {isOwner && <OwnerActions status={c.status} onStatus={(s) => statusMut.mutate(s)} onDelete={() => deleteMut.mutate()} id={id} />}
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
        <Stat label="Budget" value={c.budget_min || c.budget_max ? `$${c.budget_min ?? "?"} – $${c.budget_max ?? "?"}` : "—"} />
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

      {canApply && (
        <div>
          {myApplication ? (
            <div className="surface-card p-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm">Your application is <Badge variant="secondary" className="capitalize ml-1">{myApplication.status}</Badge></p>
                {myApplication.pitch && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">"{myApplication.pitch}"</p>}
              </div>
              {myApplication.status !== "withdrawn" && (
                <Button variant="outline" size="sm" onClick={async () => {
                  await supabase.from("applications").update({ status: "withdrawn" }).eq("id", myApplication.id);
                  qc.invalidateQueries({ queryKey: ["campaign-apps", id] });
                  toast.success("Application withdrawn");
                }}>Withdraw</Button>
              )}
            </div>
          ) : (
            <ApplyDialog campaignId={id} />
          )}
        </div>
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
                        <ApplicationStatusSelect applicationId={a.id} status={a.status} campaignId={id} />
                      </div>
                      {a.pitch && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{a.pitch}</p>}
                      <div className="mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={async () => {
                            const tid = await startConvoFromApp(a, c.id);
                            if (tid) navigate({ to: "/messages/$threadId", params: { threadId: tid } });
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> Message
                        </Button>
                      </div>
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
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("applications").insert({ campaign_id: campaignId, creator_id: user.id, pitch });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pitch sent");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["campaign-apps", campaignId] });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Apply to this campaign</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Your pitch</DialogTitle></DialogHeader>
        <Textarea rows={6} placeholder="Why are you a fit? Share ideas, past work, anything that helps you stand out." value={pitch} onChange={(e) => setPitch(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || pitch.length < 5}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send pitch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplicationStatusSelect({ applicationId, status, campaignId }: { applicationId: string; status: string; campaignId: string }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (s: "pending" | "accepted" | "rejected" | "withdrawn") => {
      const { error } = await supabase.from("applications").update({ status: s }).eq("id", applicationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-apps", campaignId] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Select value={status} onValueChange={(v) => m.mutate(v as any)}>
      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="accepted">Accepted</SelectItem>
        <SelectItem value="rejected">Rejected</SelectItem>
      </SelectContent>
    </Select>
  );
}

async function startConvoFromApp(a: any, campaignId: string): Promise<string | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("advertiser_id", uid)
    .eq("creator_id", a.creator_id)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ advertiser_id: uid, creator_id: a.creator_id, campaign_id: campaignId })
    .select("id")
    .single();
  if (error) { toast.error(error.message); return null; }
  return created.id;
}
