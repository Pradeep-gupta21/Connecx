import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error("Missing SUPABASE keys");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);
const publicClient = createClient(supabaseUrl, supabaseAnonKey);

async function testProfileQueries() {
  const email = `test_advertiser_${Date.now()}@example.com`;
  const password = "password123";

  // Let's create a pending creator in the database to test with
  console.log("Creating/verifying test creator profile...");
  const testCreatorId = 'c0de1234-abcd-abcd-abcd-c0de12345678';
  
  // Clean up if already exists
  await adminClient.from('creator_profiles').delete().eq('user_id', testCreatorId);
  await adminClient.from('profiles').delete().eq('id', testCreatorId);
  await adminClient.auth.admin.deleteUser(testCreatorId);

  const { data: creatorUser, error: creatorAuthErr } = await adminClient.auth.admin.createUser({
    email: `test_pending_creator_${Date.now()}@example.com`,
    password: "password123",
    email_confirm: true
  });

  if (creatorAuthErr) {
    console.error("Failed to create test creator user:", creatorAuthErr);
    return;
  }

  const creatorId = creatorUser.user.id;
  console.log(`Creator created with ID: ${creatorId}`);

  // Insert profile and creator_profile as pending
  await adminClient.from('profiles').insert({
    id: creatorId,
    display_name: 'Test Pending Creator',
    username: `pending_${creatorId.substring(0, 8)}`,
    bio: 'Pending bio test',
    onboarded: true
  });

  await adminClient.from('creator_profiles').insert({
    user_id: creatorId,
    headline: 'Pending Creator Headline',
    categories: ['Tech'],
    rate_min: 100,
    rate_max: 500,
    approval_status: 'pending' // <-- Set to pending
  });

  // Insert a social account for this creator
  await adminClient.from('social_accounts').insert({
    user_id: creatorId,
    platform: 'instagram',
    handle: 'pending_insta',
    url: 'https://instagram.com/pending_insta',
    follower_count: 5000,
    engagement_rate: 0.045
  });

  console.log(`Creating advertiser user: ${email}...`);
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) {
    console.error("Failed to create advertiser:", authError);
    return;
  }

  const advertiserId = authData.user.id;

  try {
    console.log("Signing in as advertiser...");
    await publicClient.auth.signInWithPassword({ email, password });

    console.log(`Querying creator_profiles for creator ${creatorId}...`);
    const { data: creator, error: creatorErr } = await publicClient
      .from("creator_profiles")
      .select("*, profiles!creator_profiles_user_id_fkey!inner(display_name)")
      .eq("user_id", creatorId)
      .maybeSingle();

    if (creatorErr) {
      console.error("Creator Profile query failed:", creatorErr);
    } else {
      console.log("Creator Profile query result:", creator);
    }

    console.log(`Querying social_accounts for creator ${creatorId}...`);
    const { data: socials, error: socialsErr } = await publicClient
      .from("social_accounts")
      .select("*")
      .eq("user_id", creatorId);

    if (socialsErr) {
      console.error("Social Accounts query failed:", socialsErr);
    } else {
      console.log("Social Accounts query result:", socials);
    }

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    console.log("Cleaning up users...");
    await adminClient.auth.admin.deleteUser(advertiserId);
    await adminClient.from('creator_profiles').delete().eq('user_id', creatorId);
    await adminClient.from('profiles').delete().eq('id', creatorId);
    await adminClient.auth.admin.deleteUser(creatorId);
    console.log("Done.");
  }
}

testProfileQueries();
