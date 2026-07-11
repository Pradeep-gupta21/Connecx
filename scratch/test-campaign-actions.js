import { supabaseAdmin } from "../src/integrations/supabase/client.server.js";

async function run() {
  const campaignId = "4734b341-7555-492f-acdf-eedd280de0a9"; // Hridyanshu's campaign
  const userId = "abae743e-647a-4779-881e-087a2c1f8051"; // Hridyanshu's id

  console.log("=== Testing Campaign Update ===");
  // We'll run this as service role (admin) but we want to see if triggers cause any error
  const { data: updateData, error: updateErr } = await supabaseAdmin
    .from("campaigns")
    .update({ title: "Updated Title Test" })
    .eq("id", campaignId)
    .select();

  if (updateErr) {
    console.error("Campaign update failed:", updateErr);
  } else {
    console.log("Campaign update succeeded!");
  }

  console.log("=== Testing Campaign Soft-Delete ===");
  const { data: deleteData, error: deleteErr } = await supabaseAdmin
    .from("campaigns")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", campaignId)
    .select();

  if (deleteErr) {
    console.error("Campaign soft-delete failed:", deleteErr);
  } else {
    console.log("Campaign soft-delete succeeded!");
    
    // Revert soft delete so we don't mess up testing data
    await supabaseAdmin.from("campaigns").update({ deleted_at: null }).eq("id", campaignId);
  }
}

run();
