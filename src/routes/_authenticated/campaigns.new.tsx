import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { CampaignForm, type CampaignFormValues } from "@/components/campaigns/CampaignForm";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/campaigns/new")({
  head: () => ({ meta: [{ title: "New campaign · Connecx" }] }),
  component: NewCampaign,
});

function NewCampaign() {
  const { user } = useAuth();
  const { activeRole, roles } = useWorkspace();
  const navigate = useNavigate();

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

  const onSubmit = async (values: CampaignFormValues) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        advertiser_id: user.id,
        title: values.title,
        brief: values.brief,
        platform: values.platform || null,
        category: values.category,
        creator_tier: values.creator_tier || null,
        budget_min: values.budget_min === "" ? null : (values.budget_min as number) ?? null,
        budget_max: values.budget_max === "" ? null : (values.budget_max as number) ?? null,
        deadline: values.deadline || null,
        deliverables: values.deliverables || null,
        languages: values.languages,
        location: values.location || null,
        requirements: values.requirements || null,
        attachments: values.attachments as any,
        status: values.status,
      })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("Campaign created");
    navigate({ to: "/campaigns/$id", params: { id: data.id } });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <PageHeader title="New campaign" description="A clear brief gets better pitches. Keep it concrete." />
      <CampaignForm onSubmit={onSubmit} onCancel={() => navigate({ to: "/campaigns" })} submitLabel="Create campaign" />
    </div>
  );
}
