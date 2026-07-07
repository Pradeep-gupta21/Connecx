import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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

const schema = z.object({
  title: z.string().min(3, "Give it a clear title"),
  brief: z.string().min(10, "Add a short brief"),
  platform: z.string().optional(),
  category: z.string().min(1, "Pick a category"),
  creator_tier: z.string().optional(),
  budget_min: z.union([z.coerce.number().int().nonnegative(), z.literal("")]).optional(),
  budget_max: z.union([z.coerce.number().int().nonnegative(), z.literal("")]).optional(),
  deadline: z.string().optional(),
  deliverables: z.string().optional(),
  location: z.string().optional(),
  requirements: z.string().optional(),
  status: z.enum(["draft", "open"]),
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

export function CampaignForm({ initialValues, onSubmit, onCancel, submitLabel = "Save campaign" }: CampaignFormProps) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialValues?.title ?? "",
      brief: initialValues?.brief ?? "",
      platform: initialValues?.platform ?? "",
      category: initialValues?.category ?? "",
      creator_tier: initialValues?.creator_tier ?? "",
      budget_min: (initialValues?.budget_min as any) ?? "",
      budget_max: (initialValues?.budget_max as any) ?? "",
      deadline: initialValues?.deadline ?? "",
      deliverables: initialValues?.deliverables ?? "",
      location: initialValues?.location ?? "",
      requirements: initialValues?.requirements ?? "",
      status: (initialValues?.status as any) ?? "open",
    },
  });
  const [languages, setLanguages] = useState<string[]>(initialValues?.languages ?? []);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>(initialValues?.attachments ?? []);
  const [uploading, setUploading] = useState(false);

  const toggleLang = (l: string) =>
    setLanguages((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

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
    await onSubmit({ ...values, languages, attachments } as CampaignFormValues);
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

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Platform</Label>
          <Select value={form.watch("platform") || ""} onValueChange={(v) => form.setValue("platform", v)}>
            <SelectTrigger><SelectValue placeholder="Pick a platform" /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v, { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
            <SelectContent>
              {CREATOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {form.formState.errors.category && <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="budget_min">Budget min (₹)</Label>
          <Input id="budget_min" type="number" min="0" placeholder="500" {...form.register("budget_min")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget_max">Budget max (₹)</Label>
          <Input id="budget_max" type="number" min="0" placeholder="2500" {...form.register("budget_max")} />
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

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" type="date" {...form.register("deadline")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" placeholder="e.g. Global, US only, EU" {...form.register("location")} />
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

      <div className="space-y-2">
        <Label>Publish as</Label>
        <Select value={form.watch("status")} onValueChange={(v: any) => form.setValue("status", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft (only you)</SelectItem>
            <SelectItem value="open">Published (visible to creators)</SelectItem>
          </SelectContent>
        </Select>
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
