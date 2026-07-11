import { supabaseAdmin } from "../src/integrations/supabase/client.server.js";

async function run() {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, title, brief, status, category, platform, budget_min, budget_max, deadline, created_at, advertiser_id, profiles:advertiser_id(display_name, avatar_url)")
    .is("deleted_at", null)
    .limit(5);

  if (error) {
    console.error("Campaign query error:", error);
  } else {
    console.log("Campaign query success! Results count:", data.length);
    console.log("Sample campaign:", JSON.stringify(data[0], null, 2));
  }
}

run();
