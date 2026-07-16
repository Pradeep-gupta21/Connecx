import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, bio, onboarded');

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  const invalid = data.filter(p => p.onboarded && (!p.display_name?.trim() || !p.username?.trim() || !p.bio?.trim()));
  console.log("Total profiles:", data.length);
  console.log("Invalid onboarded profiles:", invalid);
}

checkProfiles();
