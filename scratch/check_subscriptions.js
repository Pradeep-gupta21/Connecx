import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE keys");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSubs() {
  console.log("Checking push_subscriptions table...");
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (error) {
    console.error("Error fetching subscriptions:", error);
    return;
  }

  console.log(`Total active push subscriptions: ${subs.length}`);
  console.log(JSON.stringify(subs, null, 2));
}

checkSubs();
