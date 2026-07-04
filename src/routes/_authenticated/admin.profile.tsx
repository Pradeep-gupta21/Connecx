import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Save } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/profile")({
  head: () => ({ meta: [{ title: "Admin profile · Admin" }] }),
  component: AdminProfile,
});

function AdminProfile() {
  const { user, signOut } = useAuth();
  const { profile } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() || null, avatar_url: avatarUrl.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Account"
        title="Admin profile"
        description="Lightweight profile shown to other operators — no onboarding, no portfolio."
      />
      <div className="surface-card p-6 max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback>{(name || user?.email || "A").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{name || "Admin"}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Admin" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="avatar">Avatar URL</Label>
            <Input id="avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
