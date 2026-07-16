import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE keys");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function applyMigration(filename) {
  const filePath = path.join('supabase', 'migrations', filename);
  console.log(`Reading migration: ${filePath}...`);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`Executing SQL from ${filename}...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error(`Error executing ${filename}:`, error);
  } else {
    console.log(`Successfully executed ${filename}. Result:`, data);
  }
}

async function run() {
  try {
    await applyMigration('20260715135000_fix_social_accounts_rls_policy.sql');
    await applyMigration('20260716090000_strict_profile_validation.sql');
    await applyMigration('20260716091000_creator_rates_and_socials_validation.sql');
  } catch (err) {
    console.error("Failed to apply migrations:", err);
  }
}

run();
