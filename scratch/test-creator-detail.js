import { supabaseAdmin } from "../src/integrations/supabase/client.server.js";

async function run() {
  const creatorId = "abae743e-647a-4779-881e-087a2c1f8051"; // Hridyanshu Gupta

  console.log("=== Testing Query with creator_profiles_user_id_fkey ===");
  const { data, error } = await supabaseAdmin
    .from("creator_profiles")
    .select("*, profiles!creator_profiles_user_id_fkey!inner(display_name, avatar_url, location, bio, country, banner_url, banner_position)")
    .eq("user_id", creatorId)
    .maybeSingle();

  if (error) {
    console.error("Query failed:", error.message);
  } else {
    console.log("Query succeeded! Display name:", data?.profiles?.display_name);
  }
}

run();
