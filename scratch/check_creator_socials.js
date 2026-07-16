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

async function checkCreatorSocials() {
  const { data: profiles, error: err1 } = await supabase
    .from('creator_profiles')
    .select('user_id, headline');

  if (err1) {
    console.error("Error fetching creator profiles:", err1);
    return;
  }

  const { data: socials, error: err2 } = await supabase
    .from('social_accounts')
    .select('user_id')
    .is('deleted_at', null);

  if (err2) {
    console.error("Error fetching social accounts:", err2);
    return;
  }

  const socialCounts = {};
  socials.forEach(s => {
    socialCounts[s.user_id] = (socialCounts[s.user_id] || 0) + 1;
  });

  const creatorsWithoutSocials = profiles.filter(p => !socialCounts[p.user_id]);
  console.log("Total creators:", profiles.length);
  console.log("Creators without social accounts:", creatorsWithoutSocials);
}

checkCreatorSocials();
