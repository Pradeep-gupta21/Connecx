import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Ban, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; name: string; suspend: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, display_name, avatar_url, country, active_role, suspended_at, suspended_reason, created_at, user_roles(role)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (search.trim()) query = query.ilike("display_name", `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const suspend = useMutation({
    mutationFn: async ({ id, suspend, reason }: { id: string; suspend: boolean; reason?: string }) => {
      const { error } = await supabase.rpc("admin_set_suspension", { _user_id: id, _suspend: suspend, _reason: reason || undefined });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.suspend ? "User suspended" : "User reinstated");
      qc.invalidateQueries({ queryKey: ["admin"] });
      setConfirm(null);
      setReason("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by display name…" className="pl-9" />
        </div>
        <div className="text-xs text-muted-foreground">{q.data?.length ?? 0} users</div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_120px_120px_120px_140px] px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground border-b border-border">
          <div>User</div><div>Role</div><div>Country</div><div>Status</div><div className="text-right">Actions</div>
        </div>
        {q.isLoading && <div className="p-8 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
        {(q.data ?? []).map((u: any) => (
          <div key={u.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_120px_140px] items-center gap-3 px-5 py-4 border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 shrink-0"><AvatarImage src={u.avatar_url ?? undefined} /><AvatarFallback>{(u.display_name ?? "?").slice(0,1)}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <div className="font-medium truncate">{u.display_name ?? "Unnamed"}</div>
                <code className="text-[10px] text-muted-foreground font-mono">{u.id.slice(0, 12)}</code>
              </div>
            </div>
            <div className="text-sm text-muted-foreground capitalize">{u.active_role ?? "—"}</div>
            <div className="text-sm text-muted-foreground">{u.country ?? "—"}</div>
            <div>
              {u.suspended_at ? (
                <Badge variant="destructive">Suspended</Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              )}
            </div>
            <div className="flex md:justify-end">
              {u.suspended_at ? (
                <Button variant="outline" size="sm" onClick={() => setConfirm({ id: u.id, name: u.display_name ?? "user", suspend: false })}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reinstate
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirm({ id: u.id, name: u.display_name ?? "user", suspend: true })}>
                  <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                </Button>
              )}
            </div>
          </div>
        ))}
        {!q.isLoading && (q.data ?? []).length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">No users match.</div>
        )}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.suspend ? "Suspend" : "Reinstate"} {confirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.suspend
                ? "The user will lose access immediately and see a suspension notice."
                : "The user will regain access to the platform."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm?.suspend && (
            <Textarea placeholder="Reason (shown to user)" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && suspend.mutate({ id: confirm.id, suspend: confirm.suspend, reason })}>
              {suspend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
