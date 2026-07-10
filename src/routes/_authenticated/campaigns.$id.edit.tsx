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
      const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle<any>();
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
      platform: values.platform?.join(", ") || null,
      category: values.category?.join(", ") || null,
      creator_tier: values.creator_tier || null,
      objective: values.objective || null,
      content_types: values.content_types,
      creators_required: values.creators_required ?? 1,
      product_provided: Boolean(values.product_provided),
      product_name: values.product_provided ? values.product_name || null : null,
      product_value: values.product_provided ? (values.product_value === "" ? null : Number(values.product_value)) : null,
      shipping_regions: values.product_provided ? values.shipping_regions || null : null,
      payment_type: values.payment_type,
      commission_details: values.payment_type === "commission_only" || values.payment_type === "fixed_plus_commission" ? values.commission_details || null : null,
      budget_min: (values.payment_type === "fixed_payment" || values.payment_type === "fixed_plus_commission") && values.budget_min !== "" ? Number(values.budget_min) : null,
      budget_max: (values.payment_type === "fixed_payment" || values.payment_type === "fixed_plus_commission") && values.budget_max !== "" ? Number(values.budget_max) : null,
      application_deadline: values.application_deadline || null,
      content_delivery_deadline: values.content_delivery_deadline || null,
      deliverables: values.deliverables || null,
      languages: values.languages,
      location: values.location || null,
      requirements: values.requirements || null,
      attachments: values.attachments as any,
      visibility: values.visibility,
      publication_status: values.publication_status,
      status: values.publication_status === "published" ? "open" : "draft",
    } as any).eq("id", id);
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
          objective: (data.objective as string | undefined) ?? "Brand Awareness",
          content_types: Array.isArray(data.content_types) ? (data.content_types as string[]) : [],
          creators_required: (data.creators_required ?? 1) as number,
          accepted_creators_count: (data.accepted_creators_count ?? 0) as number,
          product_provided: Boolean(data.product_provided),
          product_name: data.product_name ?? "",
          product_value: (data.product_value ?? "") as any,
          shipping_regions: data.shipping_regions ?? "",
          payment_type: (data.payment_type as any) ?? "fixed_payment",
          commission_details: data.commission_details ?? "",
          budget_min: (data.budget_min ?? "") as any,
          budget_max: (data.budget_max ?? "") as any,
          application_deadline: data.application_deadline ?? data.deadline ?? "",
          content_delivery_deadline: data.content_delivery_deadline ?? data.deadline ?? "",
          deliverables: data.deliverables ?? "",
          location: data.location ?? "",
          requirements: data.requirements ?? "",
          languages: (data.languages ?? []) as string[],
          attachments: ((data.attachments ?? []) as any),
          visibility: (data.visibility as any) ?? "public",
          publication_status: (data.publication_status as any) ?? (data.status === "open" ? "published" : "draft"),
        }}
        onSubmit={onSubmit}
        onCancel={() => navigate({ to: "/campaigns/$id", params: { id } })}
        submitLabel="Save changes"
      />
    </div>
  );
}
