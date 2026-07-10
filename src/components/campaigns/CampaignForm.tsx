import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronDown, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { CREATOR_CATEGORIES } from "@/lib/constants";

export const PLATFORMS = ["Instagram", "TikTok", "YouTube", "X / Twitter", "LinkedIn", "Twitch", "Podcast", "Blog"] as const;
export const CREATOR_TIERS = [
  { value: "nano", label: "Nano (1K–10K)" },
  { value: "micro", label: "Micro (10K–100K)" },
  { value: "mid", label: "Mid (100K–500K)" },
  { value: "macro", label: "Macro (500K–1M)" },
  { value: "mega", label: "Mega (1M+)" },
] as const;
export const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Japanese", "Korean", "Chinese", "Arabic", "Hindi"] as const;
export const CAMPAIGN_OBJECTIVES = ["Brand Awareness", "Sales", "Lead Generation", "Website Traffic", "App Installs", "Product Launch", "User Generated Content (UGC)"] as const;
export const CONTENT_TYPES = ["Reel", "Story", "Feed Post", "Carousel", "YouTube Short", "Long-form Video", "Live Stream", "TikTok Video", "X Post", "LinkedIn Post"] as const;
export const PAYMENT_TYPES = ["fixed_payment", "commission_only", "fixed_plus_commission", "gifted_collaboration"] as const;
export const VISIBILITY_OPTIONS = ["public", "invite_only", "unlisted"] as const;
export const PUBLICATION_STATUS_OPTIONS = ["draft", "published"] as const;

const schema = z.object({
  title: z.string().min(3, "Give it a clear title"),
  brief: z.string().min(10, "Add a short brief"),
  platform: z.array(z.string()).min(1, "Pick at least one platform"),
  category: z.array(z.string()).min(1, "Pick at least one category"),
  creator_tier: z.string().optional(),
  objective: z.enum(CAMPAIGN_OBJECTIVES, { required_error: "Pick a campaign objective" }),
  content_types: z.array(z.string()).min(1, "Pick at least one content type"),
  creators_required: z.coerce.number().int().min(1, "At least 1 creator").max(1000, "Max 1000 creators"),
  product_provided: z.boolean().default(false),
  product_name: z.string().optional(),
  product_value: z.union([z.coerce.number().int().nonnegative(), z.literal("")]).optional(),
  shipping_regions: z.string().optional(),
  payment_type: z.enum(PAYMENT_TYPES, { required_error: "Select a payment type" }),
  commission_details: z.string().optional(),
  budget_min: z.union([z.coerce.number().int().nonnegative(), z.literal("")]).optional(),
  budget_max: z.union([z.coerce.number().int().nonnegative(), z.literal("")]).optional(),
  application_deadline: z.string().min(1, "Pick an application deadline"),
  content_delivery_deadline: z.string().min(1, "Pick a content delivery deadline"),
  deliverables: z.string().optional(),
  location: z.string().optional(),
  requirements: z.string().optional(),
  visibility: z.enum(VISIBILITY_OPTIONS, { required_error: "Choose a visibility option" }),
  publication_status: z.enum(PUBLICATION_STATUS_OPTIONS, { required_error: "Choose a publication status" }),
}).superRefine((values, ctx) => {
  if ((values.payment_type === "fixed_payment" || values.payment_type === "fixed_plus_commission") && (values.budget_min === "" || values.budget_min == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budget_min"], message: "Add a minimum budget" });
  }
  if ((values.payment_type === "fixed_payment" || values.payment_type === "fixed_plus_commission") && (values.budget_max === "" || values.budget_max == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budget_max"], message: "Add a maximum budget" });
  }
  if ((values.payment_type === "fixed_payment" || values.payment_type === "fixed_plus_commission") && values.budget_min !== "" && values.budget_min != null && values.budget_max !== "" && values.budget_max != null && Number(values.budget_max) < Number(values.budget_min)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budget_max"], message: "Budget max should be greater than or equal to budget min" });
  }
  if (values.payment_type === "gifted_collaboration" && !values.product_provided) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["product_provided"], message: "Gifted collaborations require product shipping" });
  }
  if (values.product_provided && !values.product_name?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["product_name"], message: "Add the product name" });
  }
  if (values.product_provided && values.product_value !== "" && values.product_value != null && Number(values.product_value) < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["product_value"], message: "Product value cannot be negative" });
  }
  if (values.application_deadline) {
    const appDate = new Date(values.application_deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (appDate < today) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["application_deadline"], message: "Application deadline cannot be in the past" });
    }
  }
  if (values.application_deadline && values.content_delivery_deadline) {
    const appDate = new Date(values.application_deadline);
    const deliveryDate = new Date(values.content_delivery_deadline);
    if (deliveryDate <= appDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["content_delivery_deadline"], message: "Delivery deadline must be after the application deadline" });
    }
  }
});

export type CampaignFormValues = z.infer<typeof schema> & {
  languages: string[];
  attachments: { name: string; url: string }[];
};

export type CampaignFormProps = {
  initialValues?: Partial<CampaignFormValues> & { id?: string };
  onSubmit: (values: CampaignFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
};

type MultiSelectDropdownProps = {
  label: string;
  helperText: string;
  options: readonly string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  error?: string;
};

function MultiSelectDropdown({ label, helperText, options, selectedValues, onToggle, error }: MultiSelectDropdownProps) {
  const selectedCount = selectedValues.length;

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{helperText}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="flex w-full items-center justify-between gap-2 text-left font-normal">
            <span className="truncate">
              {selectedCount > 0 ? `${selectedCount} selected` : `Select ${label.toLowerCase()}`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[min(24rem,calc(100vw-2rem))] max-w-[24rem]">
          <div className="max-h-[260px] overflow-y-auto p-1">
            {options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option}
                checked={selectedValues.includes(option)}
                onCheckedChange={() => onToggle(option)}
                className="rounded-md"
              >
                {option}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((value) => (
            <Badge key={value} variant="secondary" className="text-xs">
              {value}
            </Badge>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const parseSelectionValue = (value?: string | string[] | null) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export function CampaignForm({ initialValues, onSubmit, onCancel, submitLabel = "Save campaign" }: CampaignFormProps) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      title: initialValues?.title ?? "",
      brief: initialValues?.brief ?? "",
      platform: parseSelectionValue(initialValues?.platform as string | string[] | undefined),
      category: parseSelectionValue(initialValues?.category as string | string[] | undefined),
      creator_tier: initialValues?.creator_tier ?? "",
      objective: (initialValues?.objective as any) ?? "Brand Awareness",
      content_types: initialValues?.content_types ?? [],
      creators_required: (initialValues?.creators_required as any) ?? 1,
      product_provided: Boolean(initialValues?.product_provided),
      product_name: initialValues?.product_name ?? "",
      product_value: (initialValues?.product_value as any) ?? "",
      shipping_regions: initialValues?.shipping_regions ?? "",
      payment_type: (initialValues?.payment_type as any) ?? "fixed_payment",
      commission_details: initialValues?.commission_details ?? "",
      budget_min: (initialValues?.budget_min as any) ?? "",
      budget_max: (initialValues?.budget_max as any) ?? "",
      application_deadline: initialValues?.application_deadline ?? "",
      content_delivery_deadline: initialValues?.content_delivery_deadline ?? "",
      deliverables: initialValues?.deliverables ?? "",
      location: initialValues?.location ?? "",
      requirements: initialValues?.requirements ?? "",
      visibility: (initialValues?.visibility as any) ?? "public",
      publication_status: (initialValues?.publication_status as any) ?? "draft",
    },
  });
  const [languages, setLanguages] = useState<string[]>(initialValues?.languages ?? []);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>(initialValues?.attachments ?? []);
  const [uploading, setUploading] = useState(false);

  const contentTypes = form.watch("content_types") ?? [];
  const selectedPlatforms = form.watch("platform") ?? [];
  const selectedCategories = form.watch("category") ?? [];
  const paymentType = form.watch("payment_type");
  const productProvided = form.watch("product_provided");
  const creatorsRequired = Number(form.watch("creators_required") || 1);

  const toggleLang = (l: string) =>
    setLanguages((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  const toggleSelection = (field: "platform" | "category", value: string) => {
    const current = (field === "platform" ? selectedPlatforms : selectedCategories) as string[];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    form.setValue(field, next, { shouldValidate: true, shouldDirty: true });
  };

  const toggleContentType = (value: string) => {
    const next = contentTypes.includes(value) ? contentTypes.filter((item) => item !== value) : [...contentTypes, value];
    form.setValue("content_types", next, { shouldValidate: true, shouldDirty: true });
  };

  const onFile = async (file: File) => {
    setUploading(true);
    const { data: userData } = await supabase.auth.getUser();
    const path = `${userData.user?.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("campaign-covers").upload(path, file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: signed } = await supabase.storage.from("campaign-covers").createSignedUrl(path, 60 * 60 * 24 * 365);
    setAttachments((a) => [...a, { name: file.name, url: signed?.signedUrl ?? path }]);
    setUploading(false);
  };

  const submit = form.handleSubmit(async (values) => {
    await onSubmit({ ...values, languages, attachments } as unknown as CampaignFormValues);
  });

  return (
    <form onSubmit={submit} className="surface-card p-6 md:p-8 space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" placeholder="e.g. Summer launch — Instagram Reels" {...form.register("title")} />
        {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="brief">Description</Label>
        <Textarea id="brief" rows={6} placeholder="Describe the campaign, audience, and tone." {...form.register("brief")} />
        {form.formState.errors.brief && <p className="text-xs text-destructive">{form.formState.errors.brief.message}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MultiSelectDropdown
          label="Platform"
          helperText="Select every platform that fits this campaign."
          options={PLATFORMS}
          selectedValues={selectedPlatforms}
          onToggle={(value) => toggleSelection("platform", value)}
          error={form.formState.errors.platform?.message}
        />
        <MultiSelectDropdown
          label="Category"
          helperText="Choose the most relevant categories."
          options={CREATOR_CATEGORIES}
          selectedValues={selectedCategories}
          onToggle={(value) => toggleSelection("category", value)}
          error={form.formState.errors.category?.message}
        />
      </div>

      <div className="space-y-2">
        <Label>Campaign Objective</Label>
        <Select value={form.watch("objective")} onValueChange={(v) => form.setValue("objective", v as any, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Choose an objective" /></SelectTrigger>
          <SelectContent>
            {CAMPAIGN_OBJECTIVES.map((objective) => <SelectItem key={objective} value={objective}>{objective}</SelectItem>)}
          </SelectContent>
        </Select>
        {form.formState.errors.objective && <p className="text-xs text-destructive">{form.formState.errors.objective.message}</p>}
      </div>

      <MultiSelectDropdown
        label="Content Types"
        helperText="Select all formats you want creators to create."
        options={CONTENT_TYPES}
        selectedValues={contentTypes}
        onToggle={toggleContentType}
        error={form.formState.errors.content_types?.message}
      />

      <div className="space-y-2">
        <Label htmlFor="creators_required">Creators Required</Label>
        <Input id="creators_required" type="number" min="1" max="1000" step="1" {...form.register("creators_required")} />
        <p className="text-xs text-muted-foreground">This campaign is looking for {creatorsRequired} creators.</p>
        {form.formState.errors.creators_required && <p className="text-xs text-destructive">{form.formState.errors.creators_required.message}</p>}
      </div>

      <div className="rounded-xl border border-border/60 p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="product_provided">Product will be shipped to creators</Label>
            <p className="text-xs text-muted-foreground">Share product and shipping details when your campaign includes physical product delivery.</p>
          </div>
          <Switch id="product_provided" checked={productProvided} onCheckedChange={(checked) => form.setValue("product_provided", Boolean(checked), { shouldValidate: true, shouldDirty: true })} />
        </div>
        {productProvided && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name</Label>
              <Input id="product_name" placeholder="e.g. The Daily Bottle" {...form.register("product_name")} />
              {form.formState.errors.product_name && <p className="text-xs text-destructive">{form.formState.errors.product_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_value">Product Value (₹)</Label>
              <Input id="product_value" type="number" min="0" placeholder="2500" {...form.register("product_value")} />
              {form.formState.errors.product_value && <p className="text-xs text-destructive">{form.formState.errors.product_value.message}</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="shipping_regions">Shipping Regions / Countries</Label>
              <Input id="shipping_regions" placeholder="India, UAE, UK" {...form.register("shipping_regions")} />
              <p className="text-xs text-muted-foreground">Use a comma-separated list if you need multiple regions.</p>
            </div>
          </div>
        )}
        {form.formState.errors.product_provided && <p className="text-xs text-destructive">{form.formState.errors.product_provided.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Payment Type</Label>
        <Select value={paymentType} onValueChange={(value) => form.setValue("payment_type", value as any, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Pick a payment model" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed_payment">Fixed Payment</SelectItem>
            <SelectItem value="commission_only">Commission Only</SelectItem>
            <SelectItem value="fixed_plus_commission">Fixed + Commission</SelectItem>
            <SelectItem value="gifted_collaboration">Gifted Collaboration</SelectItem>
          </SelectContent>
        </Select>
        {form.formState.errors.payment_type && <p className="text-xs text-destructive">{form.formState.errors.payment_type.message}</p>}
      </div>

      {(paymentType === "fixed_payment" || paymentType === "fixed_plus_commission") && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="budget_min">Budget min (₹)</Label>
            <Input id="budget_min" type="number" min="0" placeholder="500" {...form.register("budget_min")} />
            {form.formState.errors.budget_min && <p className="text-xs text-destructive">{form.formState.errors.budget_min.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget_max">Budget max (₹)</Label>
            <Input id="budget_max" type="number" min="0" placeholder="2500" {...form.register("budget_max")} />
            {form.formState.errors.budget_max && <p className="text-xs text-destructive">{form.formState.errors.budget_max.message}</p>}
          </div>
        </div>
      )}

      {(paymentType === "commission_only" || paymentType === "fixed_plus_commission") && (
        <div className="space-y-2">
          <Label htmlFor="commission_details">Commission Details</Label>
          <Textarea id="commission_details" rows={3} placeholder="Share commission terms, percentages, or performance milestones." {...form.register("commission_details")} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="application_deadline">Application Deadline</Label>
          <Input id="application_deadline" type="date" {...form.register("application_deadline")} />
          <p className="text-xs text-muted-foreground">Last day creators can apply.</p>
          {form.formState.errors.application_deadline && <p className="text-xs text-destructive">{form.formState.errors.application_deadline.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="content_delivery_deadline">Content Delivery Deadline</Label>
          <Input id="content_delivery_deadline" type="date" {...form.register("content_delivery_deadline")} />
          <p className="text-xs text-muted-foreground">Last day selected creators must submit content.</p>
          {form.formState.errors.content_delivery_deadline && <p className="text-xs text-destructive">{form.formState.errors.content_delivery_deadline.message}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" placeholder="e.g. Global, US only, EU" {...form.register("location")} />
        </div>
        <div className="space-y-2">
          <Label>Creator size</Label>
          <Select value={form.watch("creator_tier") || ""} onValueChange={(v) => form.setValue("creator_tier", v)}>
            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              {CREATOR_TIERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="deliverables">Deliverables</Label>
        <Textarea id="deliverables" rows={3} placeholder="e.g. 1 Reel, 3 Stories, 1 static post" {...form.register("deliverables")} />
      </div>

      <div className="space-y-2">
        <Label>Languages</Label>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((l) => {
            const active = languages.includes(l);
            return (
              <button
                type="button"
                key={l}
                onClick={() => toggleLang(l)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:text-foreground")
                }
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="requirements">Requirements</Label>
        <Textarea id="requirements" rows={3} placeholder="Must-haves: follower count, past brand work, exclusivity, etc." {...form.register("requirements")} />
      </div>

      <div className="space-y-2">
        <Label>Attachments</Label>
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <Badge key={i} variant="secondary" className="gap-1.5 pr-1">
              <a href={a.url} target="_blank" rel="noreferrer" className="max-w-[160px] truncate">{a.name}</a>
              <button type="button" onClick={() => setAttachments((cur) => cur.filter((_, j) => j !== i))} className="rounded-full hover:bg-background/60 p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <label className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
            Add file
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select value={form.watch("visibility")} onValueChange={(value) => form.setValue("visibility", value as any, { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Choose visibility" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="invite_only">Invite Only</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.visibility && <p className="text-xs text-destructive">{form.formState.errors.visibility.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Publication Status</Label>
          <Select value={form.watch("publication_status")} onValueChange={(value) => form.setValue("publication_status", value as any, { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Choose status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.publication_status && <p className="text-xs text-destructive">{form.formState.errors.publication_status.message}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </div>
    </form>
  );
}
