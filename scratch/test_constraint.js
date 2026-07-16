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

async function testConstraint() {
  const testUserId = 'abae743e-647a-4779-881e-087a2c1f8051'; // Test creator user ID

  console.log("Fetching current profile state...");
  const { data: originalProfile, error: fetchErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', testUserId)
    .single();

  if (fetchErr) {
    console.error("Failed to fetch original profile:", fetchErr);
    return;
  }

  console.log("Attempting to set bio to null and onboarded to true (violating constraint)...");
  const { data, error } = await supabase
    .from('profiles')
    .update({
      onboarded: true,
      bio: null
    })
    .eq('id', testUserId)
    .select();

  if (error) {
    console.log("Update FAILED as expected! Error details:", error.message);
  } else {
    console.log("Update SUCCEEDED! This means the constraint is NOT active in the database. Updated profile:", data);
    
    // Restore original profile
    console.log("Restoring original profile...");
    await supabase
      .from('profiles')
      .update({
        onboarded: originalProfile.onboarded,
        bio: originalProfile.bio
      })
      .eq('id', testUserId);
  }
}

testConstraint();
