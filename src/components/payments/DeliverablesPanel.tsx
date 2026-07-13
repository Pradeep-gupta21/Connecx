// Deliverables panel: creator uploads, advertiser reviews. Realtime-aware
// via parent invalidation.
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, Check, RotateCcw, FileText, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useSubmitDeliverables, useReviewDeliverables } from "@/hooks/usePayments";
import { useReleasePayment } from "@/hooks/useWallet";
import { useWorkspace } from "@/hooks/useWorkspace";
import { adminReleaseFund } from "@/lib/payments/payments.functions";

type Contract = {
  id: string;
  status: string;
  advertiser_id: string;
  creator_id: string;
  deliverable_urls: { name: string; url: string }[];
  submission_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  revision_notes: string | null;
  revision_count: number;
  amount: number;
  currency: string;
  payment_id: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-accent/10 text-accent border-accent/20",
  submitted: "bg-warning/10 text-warning border-warning/20",
  revision_requested: "bg-destructive/10 text-destructive border-destructive/20",
  approved: "bg-success/10 text-success border-success/20",
  completed: "bg-success/10 text-success border-success/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function DeliverablesPanel({
  contract, currentUserId,
}: {
  contract: Contract;
  currentUserId: string;
}) {
  const { roles } = useWorkspace();
  const isAdmin = roles.includes("admin");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const paymentQ = useQuery({
    queryKey: ["contract-payment", contract.payment_id],
    enabled: !!contract.payment_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("status, status_v2, payout_status, released_at, released_by")
        .eq("id", contract.payment_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!contract.payment_id) return;
    const channel = supabase
      .channel(`payment-panel-${contract.payment_id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payments", filter: `id=eq.${contract.payment_id}` }, () => {
        void paymentQ.refetch();
        qc.invalidateQueries({ queryKey: ["campaign-contracts"] });
        qc.invalidateQueries({ queryKey: ["creator-payments"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [contract.payment_id, qc]);

  const adminReleaseFn = useServerFn(adminReleaseFund);
  const adminReleaseMut = useMutation({
    mutationFn: (paymentId: string) => adminReleaseFn({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Payment released successfully");
      void paymentQ.refetch();
      qc.invalidateQueries({ queryKey: ["campaign-contracts"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-releases"] });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["creator-payments"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isCreator = contract.creator_id === currentUserId;
  const isAdvertiser = contract.advertiser_id === currentUserId;

  const canSubmit = isCreator && ["active", "revision_requested"].includes(contract.status);
  const canReview = isAdvertiser && contract.status === "submitted";
  const canRelease = isAdmin && contract.status === "approved" && !!contract.payment_id;

  return (
    <div className="surface-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Deliverables</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {contract.submitted_at
              ? `Last submission ${format(new Date(contract.submitted_at), "MMM d, h:mm a")}`
              : "No submissions yet"}
            {contract.revision_count > 0 && ` · ${contract.revision_count} revision${contract.revision_count > 1 ? "s" : ""}`}
          </p>
        </div>
        <Badge variant="secondary" className={`capitalize ${STATUS_BADGE[contract.status] ?? ""}`}>
          {contract.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {contract.deliverable_urls.length > 0 && (
        <div className="space-y-2">
          {contract.deliverable_urls.map((d, i) => (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60 transition"
            >
              <span className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{d.name}</span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </a>
          ))}
        </div>
      )}

      {contract.submission_notes && (
        <div className="text-sm border-l-2 border-accent/40 pl-3 text-foreground/90">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Creator notes</span>
          <p className="mt-1 whitespace-pre-line">{contract.submission_notes}</p>
        </div>
      )}

      {contract.revision_notes && contract.status !== "approved" && contract.status !== "completed" && (
        <div className="text-sm border-l-2 border-destructive/40 pl-3">
          <span className="text-xs uppercase tracking-wide text-destructive">Revision requested</span>
          <p className="mt-1 whitespace-pre-line text-foreground/90">{contract.revision_notes}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canSubmit && <SubmitDialog contractId={contract.id} />}
        {canReview && <ReviewButtons contractId={contract.id} />}
        {canRelease && (
          paymentQ.data?.status_v2 === "released" ? (
            <span className="text-xs font-semibold text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-lg">
              Fund Released
            </span>
          ) : (
            <Button
              size="sm"
              className="gap-2 bg-success hover:bg-success/90 text-success-foreground font-medium"
              disabled={adminReleaseMut.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {adminReleaseMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Release Fund
            </Button>
          )
        )}
      </div>

      {/* Realtime status indicators for Approved/Released states */}
      {(contract.status === "approved" || contract.status === "completed" || paymentQ.data?.status_v2 === "released") && (
        <div className="rounded-xl border border-success/20 bg-success/5 p-4 space-y-2 mt-4 text-sm max-w-xs">
          <div className="flex items-center gap-2 font-medium text-success">
            <span>Deliverables Approved ✅</span>
          </div>
          {(contract.status === "completed" || paymentQ.data?.status_v2 === "released" || paymentQ.data?.payout_status === "completed") ? (
            <div className="flex items-center gap-2 font-medium text-success">
              <span>Payment Released ✅</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <span>Payment Pending Release</span>
            </div>
          )}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Creator Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to release this payment to the creator? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              disabled={adminReleaseMut.isPending}
              onClick={async () => {
                if (contract.payment_id) {
                  try {
                    await adminReleaseMut.mutateAsync(contract.payment_id);
                    setConfirmOpen(false);
                  } catch {
                    // toast is shown by onError hook
                  }
                }
              }}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {adminReleaseMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Confirm Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubmitDialog({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<{ name: string; url: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const submit = useSubmitDeliverables();

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${contractId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("portfolios").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("portfolios").createSignedUrl
        ? await supabase.storage.from("portfolios").createSignedUrl(path, 60 * 60 * 24 * 30)
        : { data: null };
      const url = data?.signedUrl ?? "";
      if (!url) throw new Error("Could not sign URL");
      setUrls((u) => [...u, { name: file.name, url }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Upload className="h-3.5 w-3.5" /> Submit deliverables
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit deliverables</DialogTitle>
          <DialogDescription>Upload files or paste public links. The advertiser reviews before funds release.</DialogDescription>
        </DialogHeader>

        <div>
          <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-2">Upload files</label>
          <Input
            type="file"
            multiple
            disabled={uploading}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              files.forEach(upload);
              e.target.value = "";
            }}
          />
        </div>

        {urls.length > 0 && (
          <ul className="space-y-1 text-sm">
            {urls.map((u, i) => (
              <li key={i} className="flex items-center justify-between rounded border border-border/50 px-2 py-1.5">
                <span className="truncate">{u.name}</span>
                <button onClick={() => setUrls((cur) => cur.filter((_, j) => j !== i))}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-2">Notes (optional)</label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the advertiser should know?" />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={urls.length === 0 || submit.isPending}
            onClick={async () => {
              try {
                await submit.mutateAsync({ contractId, urls, notes: notes || undefined });
                setOpen(false);
                setUrls([]); setNotes("");
              } catch { /* toast already shown */ }
            }}
          >
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewButtons({ contractId }: { contractId: string }) {
  const [revOpen, setRevOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const review = useReviewDeliverables();

  return (
    <>
      <Button
        size="sm"
        className="gap-2"
        disabled={review.isPending}
        onClick={() => review.mutate({ contractId, decision: "approve" })}
      >
        {review.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Approve deliverables
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setRevOpen(true)}>
        <RotateCcw className="h-3.5 w-3.5" /> Request revision
      </Button>

      <Dialog open={revOpen} onOpenChange={setRevOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a revision</DialogTitle>
            <DialogDescription>Tell the creator what to change.</DialogDescription>
          </DialogHeader>
          <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Please adjust the intro and update the CTA…" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevOpen(false)}>Cancel</Button>
            <Button
              disabled={notes.length < 3 || review.isPending}
              onClick={async () => {
                await review.mutateAsync({ contractId, decision: "revision", notes });
                setRevOpen(false); setNotes("");
              }}
            >
              {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send revision request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
