import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  MessageSquare, DollarSign, Check, X, Send, Loader2, 
  Paperclip, ExternalLink, Calendar, Briefcase, FileText, User 
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAcceptCreator } from "@/hooks/usePayments";

type Pitch = {
  id: string;
  campaign_id: string;
  creator_id: string;
  cover_message: string | null;
  deliverables: string | null;
  timeline: string | null;
  quoted_price: number;
  final_price: number | null;
  portfolio_url: string | null;
  attachments: { name: string; url: string }[] | null;
  status: string;
  created_at: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
    location: string | null;
  } | null;
};

type NegotiationMessage = {
  id: string;
  pitch_id: string;
  sender_id: string;
  message: string | null;
  proposed_price: number;
  status: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
};

const STATUS_BADGES: Record<string, string> = {
  submitted: "bg-primary/10 text-primary border-primary/20",
  under_review: "bg-warning/10 text-warning border-warning/20",
  negotiating: "bg-accent/10 text-accent border-accent/20",
  accepted: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  withdrawn: "bg-muted text-muted-foreground border-border",
  expired: "bg-muted text-muted-foreground border-border",
};

export function PitchNegotiationDialog({
  pitchId,
  campaignTitle,
  isOwner,
  triggerBtn,
}: {
  pitchId: string;
  campaignTitle: string;
  isOwner: boolean;
  triggerBtn?: React.ReactNode;
}) {
  const { user } = useAuth();
  const { activeRole } = useWorkspace();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const acceptCreatorMut = useAcceptCreator();

  // 1. Fetch Pitch Details
  const pitchQuery = useQuery<Pitch>({
    queryKey: ["pitch-details", pitchId],
    enabled: open && !!pitchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_pitches" as any)
        .select("*, profiles:creator_id(display_name, avatar_url, location)")
        .eq("id", pitchId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  // 2. Fetch Negotiation History
  const negotiationQuery = useQuery<NegotiationMessage[]>({
    queryKey: ["pitch-negotiation-history", pitchId],
    enabled: open && !!pitchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pitch_negotiations" as any)
        .select("*, sender:sender_id(display_name, avatar_url)")
        .eq("pitch_id", pitchId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        sender_name: m.sender?.display_name ?? "User",
        sender_avatar: m.sender?.avatar_url ?? undefined,
      }));
    },
  });

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [negotiationQuery.data]);

  // Realtime subscription for negotiations & pitches
  useEffect(() => {
    if (!open || !pitchId) return;
    const sub = supabase
      .channel(`pitch-neg-${pitchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pitch_negotiations", filter: `pitch_id=eq.${pitchId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["pitch-negotiation-history", pitchId] });
          qc.invalidateQueries({ queryKey: ["pitch-details", pitchId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_pitches", filter: `id=eq.${pitchId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["pitch-details", pitchId] });
          qc.invalidateQueries({ queryKey: ["campaign-apps"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [open, pitchId, qc]);

  const p = pitchQuery.data;
  const isNegotiationLocked = !!p?.final_price;

  // 3. Send Message / Proposal Mutation
  const sendMessageMut = useMutation({
    mutationFn: async ({ message, price }: { message: string; price?: number }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("pitch_negotiations" as any).insert({
        pitch_id: pitchId,
        sender_id: user.id,
        message: message || null,
        proposed_price: price ?? 0,
        status: price ? "proposed" : "accepted",
      });
      if (error) throw error;

      // If price proposed, update pitch status to negotiating
      if (price) {
        await supabase
          .from("campaign_pitches" as any)
          .update({ status: "negotiating" })
          .eq("id", pitchId);
      }
    },
    onSuccess: () => {
      setMsgText("");
      setPriceInput("");
      qc.invalidateQueries({ queryKey: ["pitch-negotiation-history", pitchId] });
      qc.invalidateQueries({ queryKey: ["pitch-details", pitchId] });
      toast.success("Message sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 4. Accept Proposal Mutation
  const acceptProposalMut = useMutation({
    mutationFn: async (proposal: NegotiationMessage) => {
      // 1. Update this negotiation status to accepted
      const { error: nErr } = await supabase
        .from("pitch_negotiations" as any)
        .update({ status: "accepted" })
        .eq("id", proposal.id);
      if (nErr) throw nErr;

      // 2. Set all other proposals for this pitch to declined
      await supabase
        .from("pitch_negotiations" as any)
        .update({ status: "declined" })
        .eq("pitch_id", pitchId)
        .neq("id", proposal.id)
        .eq("status", "proposed");

      // 3. Update the pitch's final price and status
      const { error: pErr } = await supabase
        .from("campaign_pitches" as any)
        .update({
          final_price: proposal.proposed_price,
          status: "negotiating",
        })
        .eq("id", pitchId);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitch-details", pitchId] });
      qc.invalidateQueries({ queryKey: ["pitch-negotiation-history", pitchId] });
      toast.success(`Proposal accepted. Price locked at ₹${p?.final_price ?? ""}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 5. Decline Proposal Mutation
  const declineProposalMut = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from("pitch_negotiations" as any)
        .update({ status: "declined" })
        .eq("id", proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitch-negotiation-history", pitchId] });
      toast.success("Proposal declined");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 6. Pitch Review Status Mutation (Advertiser declines/rejects or Creator withdraws)
  const updatePitchStatusMut = useMutation({
    mutationFn: async (newStatus: "rejected" | "withdrawn" | "under_review") => {
      const { error } = await supabase
        .from("campaign_pitches" as any)
        .update({ status: newStatus })
        .eq("id", pitchId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["pitch-details", pitchId] });
      qc.invalidateQueries({ queryKey: ["campaign-apps"] });
      toast.success(`Pitch status updated to ${variables}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = () => {
    if (!msgText.trim() && !priceInput.trim()) return;
    const price = priceInput ? Number(priceInput) : undefined;
    if (price !== undefined && (isNaN(price) || price <= 0)) {
      toast.error("Please enter a valid price proposal");
      return;
    }
    sendMessageMut.mutate({ message: msgText, price });
  };

  const handleAcceptCreator = () => {
    if (!p) return;
    console.log("[PitchNegotiationDialog] Mutating acceptCreator with p:", p);
    acceptCreatorMut.mutate({
      campaignId: p.campaign_id,
      applicationId: p.id,
      creatorId: p.creator_id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerBtn ?? <Button variant="outline" size="sm">View Pitch & Negotiate</Button>}
      </DialogTrigger>

      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-border/80 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-display font-semibold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                Pitch Review: {campaignTitle}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Review deliverables, proposed timeline, and negotiate the pricing details.
              </DialogDescription>
            </div>
            {p && (
              <Badge variant="secondary" className={`capitalize shrink-0 px-3 py-1 ${STATUS_BADGES[p.status] ?? ""}`}>
                {p.status.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {pitchQuery.isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !p ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Failed to load pitch details.
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Desktop Side-by-Side View */}
            <div className="hidden md:flex flex-1 flex-row overflow-hidden min-h-0">
              {/* LEFT PANEL: Pitch Details */}
              <div className="w-1/2 p-6 overflow-y-auto border-r border-border/80 space-y-6">
                {/* Creator details */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-border/80">
                    <AvatarImage src={p.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-foreground leading-tight">
                      {p.profiles?.display_name ?? "Creator"}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.profiles?.location ?? "Remote"} · Pitched {format(new Date(p.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Cover message */}
                <div className="space-y-1.5">
                  <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cover Message</h5>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line bg-muted/20 p-4 rounded-lg border border-border/40">
                    {p.cover_message || "No cover message provided."}
                  </p>
                </div>

                {/* Proposed Deliverables */}
                {p.deliverables && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Proposed Deliverables</h5>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line bg-muted/20 p-4 rounded-lg border border-border/40">
                      {p.deliverables}
                    </p>
                  </div>
                )}

                {/* Timeline & Portfolio */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Timeline / Deadline
                    </h5>
                    <p className="text-sm text-foreground/90 font-medium">
                      {p.timeline || "As specified in brief"}
                    </p>
                  </div>

                  {p.portfolio_url && (
                    <div className="space-y-1.5">
                      <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Portfolio Link</h5>
                      <a
                        href={p.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-accent hover:underline flex items-center gap-1 font-medium"
                      >
                        View Portfolio <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Pricing breakdown */}
                <div className="bg-primary/5 rounded-xl border border-primary/10 p-5 space-y-3">
                  <h5 className="text-xs uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" /> Pricing Details
                  </h5>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Creator Quoted Price</span>
                    <span className="font-semibold text-foreground font-mono">₹{p.quoted_price.toLocaleString("en-IN")}</span>
                  </div>
                  {isNegotiationLocked ? (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-primary/10">
                      <span className="text-success font-medium">Agreed Final Price</span>
                      <span className="font-bold text-success font-mono text-base">₹{p.final_price?.toLocaleString("en-IN")}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground pt-1 italic">
                      Pricing is negotiable. Accept a proposal or send a new offer.
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {p.attachments && p.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Attachments</h5>
                    <div className="space-y-1.5">
                      {p.attachments.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs hover:bg-muted/30 transition"
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: Negotiation Chat Feed */}
              <div className="w-1/2 flex flex-col h-full bg-muted/10">
                {/* Header inside right panel */}
                <div className="p-4 border-b border-border/60 bg-background/50 flex items-center justify-between shrink-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" /> Price Negotiation Board
                  </span>
                  {isNegotiationLocked && (
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20 gap-1 text-[10px]">
                      <Check className="h-3 w-3" /> Price Locked
                    </Badge>
                  )}
                </div>

                {/* Chat Feed Messages list */}
                <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                  {negotiationQuery.isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (negotiationQuery.data ?? []).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground font-medium">No negotiation messages yet.</p>
                      <p className="text-[10px] text-muted-foreground/80 max-w-xs">
                        Send a message or propose a new price model to kick off negotiations.
                      </p>
                    </div>
                  ) : (
                    (negotiationQuery.data ?? []).map((m) => {
                      const isSelf = m.sender_id === user?.id;
                      const isProposal = m.proposed_price > 0;

                      return (
                        <div key={m.id} className={`flex items-start gap-2.5 ${isSelf ? "justify-end" : "justify-start"}`}>
                          {!isSelf && (
                            <Avatar className="h-7 w-7 border shrink-0">
                              <AvatarImage src={m.sender_avatar} />
                              <AvatarFallback><User className="h-3.5 w-3.5" /></AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`max-w-[80%] space-y-1.5 ${isSelf ? "text-right" : "text-left"}`}>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 justify-inherit">
                              <span>{m.sender_name}</span>
                              <span>·</span>
                              <span>{format(new Date(m.created_at), "h:mm a")}</span>
                            </div>

                            {/* Message Text bubble */}
                            {m.message && (
                              <div className={`inline-block px-3 py-2 text-sm rounded-2xl leading-normal ${
                                isSelf 
                                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                                  : "bg-card border border-border/80 rounded-tl-none text-foreground"
                              }`}>
                                {m.message}
                              </div>
                            )}

                            {/* Price Proposal bubble banner */}
                            {isProposal && (
                              <div className={`p-3.5 rounded-xl border space-y-2 text-left shadow-sm ${
                                m.status === "accepted"
                                  ? "bg-success/5 border-success/20 text-success-foreground"
                                  : m.status === "declined"
                                  ? "bg-destructive/5 border-destructive/20 text-destructive-foreground opacity-75"
                                  : "bg-amber-500/5 border-amber-500/20 text-foreground"
                              }`}>
                                <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3.5 w-3.5" /> Price Offer
                                  </span>
                                  <Badge variant="secondary" className={`text-[10px] capitalize px-2 py-0 ${
                                    m.status === "accepted" ? "bg-success/10 text-success" : 
                                    m.status === "declined" ? "bg-destructive/10 text-destructive" : 
                                    "bg-amber-500/10 text-amber-500"
                                  }`}>
                                    {m.status}
                                  </Badge>
                                </div>
                                <p className="text-lg font-bold font-mono">
                                  ₹{m.proposed_price.toLocaleString("en-IN")}
                                </p>

                                {/* Acceptance actions if proposal is active (proposed) and received */}
                                {m.status === "proposed" && (
                                  <div className="pt-1.5 flex gap-2">
                                    {isSelf ? (
                                      <span className="text-[10px] text-muted-foreground italic">
                                        Awaiting recipient response...
                                      </span>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          className="h-7 px-2.5 bg-success hover:bg-success/90 text-success-foreground text-xs gap-1"
                                          disabled={acceptProposalMut.isPending}
                                          onClick={() => acceptProposalMut.mutate(m)}
                                        >
                                          {acceptProposalMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                          Accept
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/5 hover:text-destructive gap-1"
                                          disabled={declineProposalMut.isPending}
                                          onClick={() => declineProposalMut.mutate(m.id)}
                                        >
                                          <X className="h-3 w-3" />
                                          Decline
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chat Input panel */}
                <div className="p-4 border-t border-border/80 bg-background shrink-0 space-y-3">
                  {!isNegotiationLocked && (
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">₹</span>
                        <Input
                          type="number"
                          placeholder="Offer price (optional)"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          className="pl-6 h-9 text-xs font-mono"
                          disabled={sendMessageMut.isPending}
                        />
                      </div>
                      {priceInput && (
                        <span className="text-[10px] text-amber-500 font-medium shrink-0 animate-pulse">
                          Proposing new price
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Textarea
                      placeholder={isNegotiationLocked ? "Price is locked. Send a message…" : "Discuss pricing details or notes…"}
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      rows={1}
                      className="resize-none flex-1 min-h-[38px] max-h-[120px] text-sm py-2 px-3 rounded-lg border-border"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      disabled={sendMessageMut.isPending}
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={(!msgText.trim() && !priceInput.trim()) || sendMessageMut.isPending}
                      onClick={handleSend}
                    >
                      {sendMessageMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Tabs View */}
            <Tabs defaultValue="chat" className="flex md:hidden flex-col w-full h-full overflow-hidden">
              <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-border/60 bg-background/50 h-11 shrink-0 p-1">
                <TabsTrigger value="chat" className="text-xs">Negotiation Chat</TabsTrigger>
                <TabsTrigger value="details" className="text-xs">Pitch Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 m-0 overflow-hidden bg-muted/5">
                {/* Chat Feed Messages list */}
                <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                  {negotiationQuery.isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (negotiationQuery.data ?? []).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground font-medium">No negotiation messages yet.</p>
                      <p className="text-[10px] text-muted-foreground/80 max-w-xs">
                        Send a message or propose a new price model to kick off negotiations.
                      </p>
                    </div>
                  ) : (
                    (negotiationQuery.data ?? []).map((m) => {
                      const isSelf = m.sender_id === user?.id;
                      const isProposal = m.proposed_price > 0;

                      return (
                        <div key={m.id} className={`flex items-start gap-2.5 ${isSelf ? "justify-end" : "justify-start"}`}>
                          {!isSelf && (
                            <Avatar className="h-7 w-7 border shrink-0">
                              <AvatarImage src={m.sender_avatar} />
                              <AvatarFallback><User className="h-3.5 w-3.5" /></AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`max-w-[80%] space-y-1.5 ${isSelf ? "text-right" : "text-left"}`}>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 justify-inherit">
                              <span>{m.sender_name}</span>
                              <span>·</span>
                              <span>{format(new Date(m.created_at), "h:mm a")}</span>
                            </div>

                            {/* Message Text bubble */}
                            {m.message && (
                              <div className={`inline-block px-3 py-2 text-sm rounded-2xl leading-normal ${
                                isSelf 
                                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                                  : "bg-card border border-border/80 rounded-tl-none text-foreground"
                              }`}>
                                {m.message}
                              </div>
                            )}

                            {/* Price Proposal bubble banner */}
                            {isProposal && (
                              <div className={`p-3.5 rounded-xl border space-y-2 text-left shadow-sm ${
                                m.status === "accepted"
                                  ? "bg-success/5 border-success/20 text-success-foreground"
                                  : m.status === "declined"
                                  ? "bg-destructive/5 border-destructive/20 text-destructive-foreground opacity-75"
                                  : "bg-amber-500/5 border-amber-500/20 text-foreground"
                              }`}>
                                <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3.5 w-3.5" /> Price Offer
                                  </span>
                                  <Badge variant="secondary" className={`text-[10px] capitalize px-2 py-0 ${
                                    m.status === "accepted" ? "bg-success/10 text-success" : 
                                    m.status === "declined" ? "bg-destructive/10 text-destructive" : 
                                    "bg-amber-500/10 text-amber-500"
                                  }`}>
                                    {m.status}
                                  </Badge>
                                </div>
                                <p className="text-lg font-bold font-mono">
                                  ₹{m.proposed_price.toLocaleString("en-IN")}
                                </p>

                                {/* Acceptance actions if proposal is active (proposed) and received */}
                                {m.status === "proposed" && (
                                  <div className="pt-1.5 flex gap-2">
                                    {isSelf ? (
                                      <span className="text-[10px] text-muted-foreground italic">
                                        Awaiting recipient response...
                                      </span>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          className="h-7 px-2.5 bg-success hover:bg-success/90 text-success-foreground text-xs gap-1"
                                          disabled={acceptProposalMut.isPending}
                                          onClick={() => acceptProposalMut.mutate(m)}
                                        >
                                          {acceptProposalMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                          Accept
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/5 hover:text-destructive gap-1"
                                          disabled={declineProposalMut.isPending}
                                          onClick={() => declineProposalMut.mutate(m.id)}
                                        >
                                          <X className="h-3 w-3" />
                                          Decline
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chat Input panel */}
                <div className="p-4 border-t border-border/80 bg-background shrink-0 space-y-3">
                  {!isNegotiationLocked && (
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">₹</span>
                        <Input
                          type="number"
                          placeholder="Offer price (optional)"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          className="pl-6 h-9 text-xs font-mono"
                          disabled={sendMessageMut.isPending}
                        />
                      </div>
                      {priceInput && (
                        <span className="text-[10px] text-amber-500 font-medium shrink-0 animate-pulse">
                          Proposing new price
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Textarea
                      placeholder={isNegotiationLocked ? "Price is locked. Send a message…" : "Discuss pricing details or notes…"}
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      rows={1}
                      className="resize-none flex-1 min-h-[38px] max-h-[120px] text-sm py-2 px-3 rounded-lg border-border"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      disabled={sendMessageMut.isPending}
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={(!msgText.trim() && !priceInput.trim()) || sendMessageMut.isPending}
                      onClick={handleSend}
                    >
                      {sendMessageMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="details" className="flex-1 overflow-y-auto m-0 p-5 space-y-6 bg-background">
                {/* Creator details */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-border/80">
                    <AvatarImage src={p.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-foreground leading-tight">
                      {p.profiles?.display_name ?? "Creator"}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.profiles?.location ?? "Remote"} · Pitched {format(new Date(p.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Cover message */}
                <div className="space-y-1.5">
                  <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cover Message</h5>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line bg-muted/20 p-4 rounded-lg border border-border/40">
                    {p.cover_message || "No cover message provided."}
                  </p>
                </div>

                {/* Proposed Deliverables */}
                {p.deliverables && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Proposed Deliverables</h5>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line bg-muted/20 p-4 rounded-lg border border-border/40">
                      {p.deliverables}
                    </p>
                  </div>
                )}

                {/* Timeline & Portfolio */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Timeline / Deadline
                    </h5>
                    <p className="text-sm text-foreground/90 font-medium">
                      {p.timeline || "As specified in brief"}
                    </p>
                  </div>

                  {p.portfolio_url && (
                    <div className="space-y-1.5">
                      <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Portfolio Link</h5>
                      <a
                        href={p.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-accent hover:underline flex items-center gap-1 font-medium"
                      >
                        View Portfolio <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Pricing breakdown */}
                <div className="bg-primary/5 rounded-xl border border-primary/10 p-5 space-y-3">
                  <h5 className="text-xs uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" /> Pricing Details
                  </h5>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Creator Quoted Price</span>
                    <span className="font-semibold text-foreground font-mono">₹{p.quoted_price.toLocaleString("en-IN")}</span>
                  </div>
                  {isNegotiationLocked ? (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-primary/10">
                      <span className="text-success font-medium">Agreed Final Price</span>
                      <span className="font-bold text-success font-mono text-base">₹{p.final_price?.toLocaleString("en-IN")}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground pt-1 italic">
                      Pricing is negotiable. Accept a proposal or send a new offer.
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {p.attachments && p.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Attachments</h5>
                    <div className="space-y-1.5">
                      {p.attachments.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs hover:bg-muted/30 transition"
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* BOTTOM FOOTER PANEL: Status actions */}
        {p && (
          <DialogFooter className="p-4 border-t border-border/80 bg-muted/20 shrink-0 flex items-center justify-end gap-3 flex-wrap">
            <div className="flex items-center gap-2 mr-auto">
              {p.status === "submitted" && isOwner && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updatePitchStatusMut.mutate("under_review")}
                  disabled={updatePitchStatusMut.isPending}
                >
                  Mark Under Review
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Advertiser Action: Accept Creator */}
              {isOwner && p.status !== "accepted" && p.status !== "rejected" && p.status !== "withdrawn" && (
                <>
                  <Button
                    size="sm"
                    className="bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                    disabled={acceptCreatorMut.isPending}
                    onClick={handleAcceptCreator}
                    title={isNegotiationLocked ? "Accept this creator" : "Finalize pricing first to accept"}
                  >
                    {acceptCreatorMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Accept Pitch & Creator
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                    disabled={updatePitchStatusMut.isPending}
                    onClick={() => {
                      updatePitchStatusMut.mutate("rejected");
                      setOpen(false);
                    }}
                  >
                    Decline Pitch
                  </Button>
                </>
              )}

              {/* Creator Action: Withdraw Pitch */}
              {!isOwner && p.status !== "withdrawn" && p.status !== "accepted" && p.status !== "rejected" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
                  disabled={updatePitchStatusMut.isPending}
                  onClick={() => {
                    updatePitchStatusMut.mutate("withdrawn");
                    setOpen(false);
                  }}
                >
                  Withdraw Pitch
                </Button>
              )}

              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
