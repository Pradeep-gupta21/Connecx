import { supabaseAdmin } from "../src/integrations/supabase/client.server.js";

async function run() {
  const campaignId = "4734b341-7555-492f-acdf-eedd280de0a9";
  const userId = "abae743e-647a-4779-881e-087a2c1f8051"; // Creator/Advertiser user

  console.log("=== Querying single campaign ===");
  const { data: c, error: cErr } = await supabaseAdmin
    .from("campaigns")
    .select("*, profiles:advertiser_id(display_name, avatar_url, location)")
    .eq("id", campaignId)
    .maybeSingle();
  if (cErr) console.error("Campaign query error:", cErr);
  else console.log("Campaign query success!", !!c);

  console.log("=== Querying applications ===");
  const { data: apps, error: aErr } = await supabaseAdmin
    .from("applications")
    .select("*, profiles:creator_id(display_name, avatar_url, location)")
    .eq("campaign_id", campaignId);
  if (aErr) console.error("Applications query error:", aErr);
  else console.log("Applications query success! Count:", apps?.length);

  console.log("=== Querying contracts ===");
  const { data: contracts, error: ctErr } = await supabaseAdmin
    .from("contracts")
    .select("id, status, advertiser_id, creator_id, deliverable_urls, submission_notes, submitted_at, reviewed_at, revision_notes, revision_count, amount, currency, profiles:creator_id(display_name, avatar_url)")
    .eq("campaign_id", campaignId)
    .is("deleted_at", null);
  if (ctErr) console.error("Contracts query error:", ctErr);
  else console.log("Contracts query success! Count:", contracts?.length);
}

run();
