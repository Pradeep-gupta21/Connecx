import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio · Connecx" }] }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", external_url: "", tags: "" });

  const q = useQuery({
    queryKey: ["portfolio", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("portfolio")
        .select("*")
        .eq("creator_id", user!.id)
        .is("deleted_at", null)
        .order("position", { ascending: true });
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { error } = await supabase.from("portfolio").insert({
        creator_id: user!.id,
        title: form.title,
        description: form.description || null,
        external_url: form.external_url || null,
        tags,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to portfolio");
      qc.invalidateQueries({ queryKey: ["portfolio", user?.id] });
      setOpen(false);
      setForm({ title: "", description: "", external_url: "", tags: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio", user?.id] }),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolio"
        description="Showcase your best work to brands."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1.5" />Add item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add portfolio item</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <Input placeholder="External URL (Instagram, YouTube, etc.)" value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} />
                <Input placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                <Button className="w-full" disabled={!form.title || add.isPending} onClick={() => add.mutate()}>
                  {add.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      {q.isLoading ? (
        <ListSkeleton rows={4} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={ImageIcon} title="No portfolio items" description="Add your first piece of work to attract brands." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {q.data!.map((p: any) => (
            <div key={p.id} className="surface-card p-5 group">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display font-semibold truncate">{p.title}</h3>
                <button onClick={() => remove.mutate(p.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {p.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{p.description}</p>}
              {p.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
              )}
              {p.external_url && (
                <a href={p.external_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
