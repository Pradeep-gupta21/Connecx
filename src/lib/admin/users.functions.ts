import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSuperAdminUserId = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Paginate through users to find super admin email
    let page = 1;
    const target = "ventroofficial@gmail.com";
    while (page < 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const found = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
      if (found) return { userId: found.id };
      if (data.users.length < 200) break;
      page++;
    }
    return { userId: null as string | null };
  });

const SUPER_ADMIN_EMAIL = "ventroofficial@gmail.com";
const USER_STORAGE_BUCKETS = [
  "avatars",
  "portfolios",
  "brand-logos",
  "campaign-covers",
  "message-attachments",
  "profile-pictures",
  "profile-banners",
];

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data?.userId || typeof data.userId !== "string") {
      throw new Error("userId is required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId: actorId } = context;

    // Verify caller is admin
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: actorId,
      _role: "admin",
    });
    if (roleErr) throw new Error("Failed to verify permissions");
    if (!isAdmin) throw new Error("Only administrators can delete users");

    if (data.userId === actorId) {
      throw new Error("You cannot delete your own account from here");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up target user
    const { data: target, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr || !target?.user) throw new Error("User not found");

    if ((target.user.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL) {
      throw new Error("The super admin account cannot be deleted.");
    }

    // Remove user files from storage buckets (best effort)
    for (const bucket of USER_STORAGE_BUCKETS) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(data.userId, { limit: 1000 });
        if (files && files.length > 0) {
          const paths = files.map((f) => `${data.userId}/${f.name}`);
          await supabaseAdmin.storage.from(bucket).remove(paths);
        }
      } catch {
        // ignore per-bucket failures
      }
    }

    // Delete the auth user — cascades to public tables via FK constraints
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) throw new Error(delErr.message || "Failed to delete user");

    // Audit log
    try {
      await supabaseAdmin.from("activity_logs").insert({
        user_id: actorId,
        action: "user.deleted",
        entity_type: "profile",
        entity_id: data.userId,
        metadata: { email: target.user.email },
      });
    } catch {
      // non-fatal
    }

    return { ok: true };
  });
