import { supabaseAdmin } from "../src/integrations/supabase/client.server.js";

async function run() {
  const userId = "abae743e-647a-4779-881e-087a2c1f8051"; // Hridyanshu Gupta

  console.log("=== Querying applications as Advertiser ===");
  const { data: advApps, error: advErr } = await supabaseAdmin
    .from("applications")
    .select("id, status, pitch, created_at, campaign_id, creator_id, campaigns!inner(title, category, budget_min, budget_max, advertiser_id), profiles:creator_id(display_name, avatar_url, location)")
    .eq("campaigns.advertiser_id", userId);
  if (advErr) console.error("Advertiser apps error:", advErr);
  else console.log("Advertiser apps success! Count:", advApps.length);

  console.log("=== Querying applications as Creator ===");
  const { data: creApps, error: creErr } = await supabaseAdmin
    .from("applications")
    .select("id, status, pitch, created_at, campaign_id, campaigns(title, category, budget_min, budget_max, profiles:advertiser_id(display_name, avatar_url))")
    .eq("creator_id", userId);
  if (creErr) console.error("Creator apps error:", creErr);
  else console.log("Creator apps success! Count:", creApps.length);
}

run();
