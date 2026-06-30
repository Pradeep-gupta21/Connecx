import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { CREATOR_CATEGORIES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/campaigns/new")({
  head: () => ({ meta: [{ title: "New campaign · BrandBridge" }] }),
  component: NewCampaign,
});

const schema = z.object({
  title: z.string().min(3, "Give it a clear title"),
  brief: z.string().min(10, "Add a short brief"),
  category: z.string().min(1, "Pick a category"),
  budget_min: z.coerce.number().int().nonnegative().optional().or(z.literal("")),
  budget_max: z.coerce.number().int().nonnegative().optional().or(z.literal("")),
  deadline: z.string().optional(),
  status: z.enum(["draft", "open"]),
});

function NewCampaign() {
  const { user } = useAuth();
  const { activeRole, roles } = useWorkspace();
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", brief: "", category: "", status: "open" },
  });

  if (activeRole && activeRole !== "advertiser") {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <h1 className="font-display text-2xl font-semibold">Switch to your advertiser workspace</h1>
        <p className="mt-3 text-muted-foreground">
          {roles.includes("advertiser")
            ? "Use the workspace switcher in the top nav."
            : "Add the advertiser role from Settings to publish campaigns."}
        </p>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        advertiser_id: user.id,
        title: values.title,
        brief: values.brief,
        category: values.category,
        budget_min: values.budget_min === "" ? null : values.budget_min ?? null,
        budget_max: values.budget_max === "" ? null : values.budget_max ?? null,
        deadline: values.deadline || null,
        status: values.status,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Campaign created");
    navigate({ to: "/campaigns/$id", params: { id: data.id } });
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <PageHeader title="New campaign" description="A clear brief gets better pitches. Keep it concrete." />
      <form onSubmit={onSubmit} className="surface-card p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder="e.g. Summer launch — Instagram Reels" {...form.register("title")} />
          {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="brief">Brief</Label>
          <Textarea id="brief" rows={6} placeholder="Describe the campaign, deliverables, audience, and tone." {...form.register("brief")} />
          {form.formState.errors.brief && <p className="text-xs text-destructive">{form.formState.errors.brief.message}</p>}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(v) => form.setValue("category", v, { shouldValidate: true })}
            >
              <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
              <SelectContent>
                {CREATOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.formState.errors.category && <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (optional)</Label>
            <Input id="deadline" type="date" {...form.register("deadline")} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="budget_min">Budget min ($)</Label>
            <Input id="budget_min" type="number" min="0" placeholder="500" {...form.register("budget_min")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget_max">Budget max ($)</Label>
            <Input id="budget_max" type="number" min="0" placeholder="2500" {...form.register("budget_max")} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Publish as</Label>
          <Select value={form.watch("status")} onValueChange={(v: any) => form.setValue("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft (only you)</SelectItem>
              <SelectItem value="open">Open (visible to creators)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/campaigns" })}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create campaign"}
          </Button>
        </div>
      </form>
    </div>
  );
}
