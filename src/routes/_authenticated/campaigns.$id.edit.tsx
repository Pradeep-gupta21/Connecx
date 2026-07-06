import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { CampaignForm, type CampaignFormValues } from "@/components/campaigns/CampaignForm";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/campaigns/$id/edit")({
  head: () => ({ meta: [{ title: "Edit campaign · Connecx" }] }),
  component: EditCampaign,
});

function EditCampaign() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["campaign-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Campaign not found.</div>;
  if (user?.id !== data.advertiser_id) return <div className="text-center py-20 text-muted-foreground">You don't own this campaign.</div>;

  const onSubmit = async (values: CampaignFormValues) => {
    const { error } = await supabase.from("campaigns").update({
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
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Campaign updated");
    navigate({ to: "/campaigns/$id", params: { id } });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <PageHeader title="Edit campaign" description="Tune the brief — creators will see your latest changes instantly." />
      <CampaignForm
        initialValues={{
          title: data.title,
          brief: data.brief ?? "",
          platform: data.platform ?? "",
          category: data.category ?? "",
          creator_tier: data.creator_tier ?? "",
          budget_min: (data.budget_min ?? "") as any,
          budget_max: (data.budget_max ?? "") as any,
          deadline: data.deadline ?? "",
          deliverables: data.deliverables ?? "",
          location: data.location ?? "",
          requirements: data.requirements ?? "",
          languages: (data.languages ?? []) as string[],
          attachments: ((data.attachments ?? []) as any),
          status: (data.status === "draft" ? "draft" : "open"),
        }}
        onSubmit={onSubmit}
        onCancel={() => navigate({ to: "/campaigns/$id", params: { id } })}
        submitLabel="Save changes"
      />
    </div>
  );
}
