import { supabaseAdmin } from "../src/integrations/supabase/client.server.js";

async function run() {
  const userId = "abae743e-647a-4779-881e-087a2c1f8051"; // Hridyanshu Gupta

  const { data: creatorRole, error: cErr } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "creator"
  });

  if (cErr) {
    console.error("has_role creator error:", cErr);
  } else {
    console.log("has_role creator success! Result:", creatorRole);
  }

  const { data: advRole, error: aErr } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "advertiser"
  });

  if (aErr) {
    console.error("has_role advertiser error:", aErr);
  } else {
    console.log("has_role advertiser success! Result:", advRole);
  }
}

run();
