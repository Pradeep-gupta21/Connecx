import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = "https://leymyvwnhfreufxayioa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_gf3Jbszi2fJbbbYXggv97g_rZm12dhB";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  const { data: pitches, error } = await supabase.from('campaign_pitches').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("PITCH KEYS:", Object.keys(pitches[0] || {}));
  console.log("RECORD:", pitches[0]);
}

main().catch(console.error);
