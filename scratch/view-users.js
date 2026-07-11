import { supabaseAdmin } from "../src/integrations/supabase/client.server.js";

async function run() {
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, active_role, onboarded")
    .limit(10);
  
  if (pErr) {
    console.error("Profiles error:", pErr);
    return;
  }

  const { data: roles, error: rErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role");

  if (rErr) {
    console.error("Roles error:", rErr);
    return;
  }

  console.log("=== PROFILES ===");
  console.log(JSON.stringify(profiles, null, 2));
  console.log("=== USER ROLES ===");
  console.log(JSON.stringify(roles, null, 2));
}

run();
