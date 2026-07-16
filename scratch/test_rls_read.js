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

async function testRLS() {
  const email = `test_advertiser_${Date.now()}@example.com`;
  const password = "password123";
  const creatorId = 'abae743e-647a-4779-881e-087a2c1f8051';

  console.log(`Creating temporary test user: ${email}...`);
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) {
    console.error("Failed to create test user:", authError);
    return;
  }

  const tempUserId = authData.user.id;
  console.log(`Test user created with ID: ${tempUserId}. Logging in...`);

  try {
    const { data: sessionData, error: loginError } = await publicClient.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      console.error("Failed to sign in:", loginError);
      return;
    }

    console.log("Logged in successfully. Querying social_accounts for creator...");
    const { data: socials, error: queryError } = await publicClient
      .from('social_accounts')
      .select('*')
      .eq('user_id', creatorId);

    if (queryError) {
      console.error("Query failed with error:", queryError);
    } else {
      console.log("Query succeeded! Social accounts retrieved:", socials);
    }

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    console.log("Cleaning up: Deleting temporary test user...");
    await adminClient.auth.admin.deleteUser(tempUserId);
    console.log("Done.");
  }
}

testRLS();
