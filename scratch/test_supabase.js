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

async function checkCreators() {
  const ids = [
    'abae743e-647a-4779-881e-087a2c1f8051',
    '3b62bd13-d836-43f4-a922-d27404029ea7'
  ];

  for (const id of ids) {
    const { data: creator, error } = await supabase
      .from('creator_profiles')
      .select('user_id, approval_status, deleted_at, follower_count')
      .eq('user_id', id)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching creator ${id}:`, error);
    } else {
      console.log(`Creator ${id}:`, creator);
    }
  }
}

checkCreators();
