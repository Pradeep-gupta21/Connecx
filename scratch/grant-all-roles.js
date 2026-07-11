import { supabaseAdmin } from "../src/integrations/supabase/client.server.js";

async function run() {
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name");

  if (pErr) {
    console.error("Error fetching profiles:", pErr);
    return;
  }

  console.log(`Found ${profiles.length} profiles. Granting both creator and advertiser roles...`);

  for (const p of profiles) {
    console.log(`Processing user: ${p.display_name} (${p.id})`);

    // 1. Grant creator role
    const { error: cRoleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: p.id, role: "creator" })
      .select();
    if (cRoleErr && cRoleErr.code !== "23505") { // 23505 is unique constraint violation (already has role)
      console.error(`  Error granting creator role:`, cRoleErr.message);
    } else {
      console.log(`  Granted creator role`);
    }

    // 2. Grant advertiser role
    const { error: aRoleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: p.id, role: "advertiser" })
      .select();
    if (aRoleErr && aRoleErr.code !== "23505") {
      console.error(`  Error granting advertiser role:`, aRoleErr.message);
    } else {
      console.log(`  Granted advertiser role`);
    }

    // 3. Ensure creator_profiles row exists
    const { error: cProfErr } = await supabaseAdmin
      .from("creator_profiles")
      .upsert({ user_id: p.id }, { onConflict: "user_id" });
    if (cProfErr) {
      console.error(`  Error creating creator profile:`, cProfErr.message);
    }

    // 4. Ensure advertiser_profiles row exists
    const { error: aProfErr } = await supabaseAdmin
      .from("advertiser_profiles")
      .upsert({ user_id: p.id, brand_name: p.display_name }, { onConflict: "user_id" });
    if (aProfErr) {
      console.error(`  Error creating advertiser profile:`, aProfErr.message);
    }
  }

  console.log("All roles and profiles successfully granted and ensured!");
}

run();
