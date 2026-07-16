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

async function approveCreators() {
  const ids = [
    'abae743e-647a-4779-881e-087a2c1f8051',
    '3b62bd13-d836-43f4-a922-d27404029ea7'
  ];

  for (const id of ids) {
    console.log(`Approving creator ${id}...`);
    const { data, error } = await supabase
      .from('creator_profiles')
      .update({ approval_status: 'approved' })
      .eq('user_id', id)
      .select('user_id, approval_status');

    if (error) {
      console.error(`Error approving creator ${id}:`, error);
    } else {
      console.log(`Creator ${id} updated successfully:`, data);
    }
  }
}

approveCreators();
