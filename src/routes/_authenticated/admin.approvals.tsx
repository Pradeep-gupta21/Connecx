import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: AdminApprovals,
});

function AdminApprovals() {
  const qc = useQueryClient();

  const creators = useQuery({
    queryKey: ["admin", "approvals", "creator"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_profiles")
        .select("user_id, headline, niches, approval_status, created_at, profiles!creator_profiles_profile_fkey(display_name, avatar_url, country)")
        .eq("approval_status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const advertisers = useQuery({
    queryKey: ["admin", "approvals", "advertiser"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertiser_profiles")
        .select("user_id, company_name, industry, approval_status, created_at, profiles!advertiser_profiles_profile_fkey(display_name, avatar_url, country)")
        .eq("approval_status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const act = useMutation({
    mutationFn: async ({ kind, id, status, reason }: { kind: "creator" | "advertiser"; id: string; status: "approved" | "rejected"; reason?: string }) => {
      const { error } = await supabase.rpc("admin_set_approval", { _kind: kind, _user_id: id, _status: status, _reason: reason ?? null });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(`${v.kind} ${v.status}`);
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderCard = (kind: "creator" | "advertiser", row: any) => {
    const profile = row.profiles;
    const title = kind === "creator" ? row.headline || "Creator profile" : row.company_name || "Advertiser";
    return (
      <motion.div
        key={row.user_id}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="surface-card p-5 flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <Avatar className="h-11 w-11 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback>{(profile?.display_name ?? "?").slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{profile?.display_name ?? "Unnamed"}</div>
          <div className="text-sm text-muted-foreground truncate">{title}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{profile?.country ?? "—"}</span>
            <span>·</span>
            <span>Submitted {new Date(row.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => act.mutate({ kind, id: row.user_id, status: "rejected", reason: "Does not meet quality standards" })}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
          <Button
            size="sm"
            onClick={() => act.mutate({ kind, id: row.user_id, status: "approved" })}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
          </Button>
        </div>
      </motion.div>
    );
  };

  return (
    <Tabs defaultValue="creator">
      <TabsList>
        <TabsTrigger value="creator">Creators <Badge variant="secondary" className="ml-2">{creators.data?.length ?? 0}</Badge></TabsTrigger>
        <TabsTrigger value="advertiser">Advertisers <Badge variant="secondary" className="ml-2">{advertisers.data?.length ?? 0}</Badge></TabsTrigger>
      </TabsList>
      <TabsContent value="creator" className="mt-4 space-y-3">
        {(creators.data ?? []).map((r) => renderCard("creator", r))}
        {!creators.isLoading && (creators.data ?? []).length === 0 && (
          <EmptyState icon={Sparkles} title="Inbox zero" description="No creator profiles pending review." />
        )}
      </TabsContent>
      <TabsContent value="advertiser" className="mt-4 space-y-3">
        {(advertisers.data ?? []).map((r) => renderCard("advertiser", r))}
        {!advertisers.isLoading && (advertisers.data ?? []).length === 0 && (
          <EmptyState icon={Sparkles} title="All clear" description="No advertiser profiles pending review." />
        )}
      </TabsContent>
    </Tabs>
  );
}
