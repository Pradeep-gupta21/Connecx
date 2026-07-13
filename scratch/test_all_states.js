import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://leymyvwnhfreufxayioa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "sb_secret_gf3Jbszi2fJbbbYXggv97g_rZm12dhB";

function isNewSupabaseApiKey(value) {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey) {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY)
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log("=== RUNNING ESCROW RELEASE STATE VALIDATION TESTS ===");

  try {
    // Get a base contract to run our mock payments against
    const { data: contracts, error: cErr } = await supabase
      .from('contracts')
      .select('id, advertiser_id, creator_id, campaign_id, amount')
      .limit(1);

    if (cErr) throw cErr;
    if (!contracts || contracts.length === 0) {
      console.error("No contracts found to execute test cases.");
      return;
    }

    const contract = contracts[0];
    const contractId = contract.id;
    const campaignId = contract.campaign_id;
    const advertiserId = contract.advertiser_id;
    const creatorId = contract.creator_id;
    const amount = Number(contract.amount);

    // Mock admin ID (must have admin role in user_roles table)
    // Find an admin user
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1);
    
    if (!admins || admins.length === 0) {
      console.error("No admin user found in user_roles table. Please ensure an admin exists.");
      return;
    }
    const adminId = admins[0].user_id;
    console.log(`Using Admin Caller ID: ${adminId}`);

    // Helper to insert a payment
    async function createTestPayment(status, status_v2 = null, contractStatus = 'active') {
      // Set contract status
      await supabase.from('contracts').update({ status: contractStatus }).eq('id', contractId);
      
      const { data: pay, error } = await supabase
        .from('payments')
        .insert({
          payer_id: advertiserId,
          payee_id: creatorId,
          campaign_id: campaignId,
          contract_id: contractId,
          amount: amount,
          creator_earnings: amount * 0.9,
          platform_fee: amount * 0.1,
          gst: 0,
          currency: 'INR',
          type: 'campaign_payment',
          status: status,
          status_v2: status_v2 || status,
          payout_status: 'pending',
          razorpay_order_id: `ord_test_${Date.now()}_${Math.floor(Math.random()*1000)}`
        })
        .select('*')
        .single();
      if (error) throw error;
      return pay;
    }

    // Test 1: Unauthorized Access Prevention
    console.log("\nTesting: Unauthorized Access...");
    const mockUser = advertiserId; // non-admin
    const testPayAuth = await createTestPayment('held', 'held', 'approved');
    const { data: data1, error: error1 } = await supabase.rpc('admin_release_fund', {
      _payment_id: testPayAuth.id,
      _admin_id: mockUser
    });
    console.log("Result:", { data: data1, error: error1 });

    // Test 2: Pending State
    console.log("\nTesting State: Pending...");
    const payPending = await createTestPayment('pending', 'pending', 'approved');
    const { data: data2, error: error2 } = await supabase.rpc('admin_release_fund', {
      _payment_id: payPending.id,
      _admin_id: adminId
    });
    console.log("Result:", { data: data2, error: error2 });

    // Test 3: Cancelled State
    console.log("\nTesting State: Cancelled...");
    const payCancelled = await createTestPayment('cancelled', 'cancelled', 'approved');
    const { data: data3, error: error3 } = await supabase.rpc('admin_release_fund', {
      _payment_id: payCancelled.id,
      _admin_id: adminId
    });
    console.log("Result:", { data: data3, error: error3 });

    // Test 4: Refunded State
    console.log("\nTesting State: Refunded...");
    const payRefunded = await createTestPayment('refunded', 'refunded', 'approved');
    const { data: data4, error: error4 } = await supabase.rpc('admin_release_fund', {
      _payment_id: payRefunded.id,
      _admin_id: adminId
    });
    console.log("Result:", { data: data4, error: error4 });

    // Test 5: Awaiting Advertiser Approval
    console.log("\nTesting State: Awaiting Approval (Contract active)...");
    const payAwaiting = await createTestPayment('held', 'held', 'active');
    const { data: data5, error: error5 } = await supabase.rpc('admin_release_fund', {
      _payment_id: payAwaiting.id,
      _admin_id: adminId
    });
    console.log("Result:", { data: data5, error: error5 });

    // Test 6: Approved State (Successful Release Flow)
    console.log("\nTesting State: Approved (Success path)...");
    const paySuccess = await createTestPayment('held', 'held', 'approved');
    const { data: data6, error: error6 } = await supabase.rpc('admin_release_fund', {
      _payment_id: paySuccess.id,
      _admin_id: adminId
    });
    console.log("Result:", { data: data6, error: error6 });

    if (data6 && data6.success) {
      console.log("Release RPC succeeded!");

      // Verify Notification Sent
      const { data: notif } = await supabase
        .from('notifications')
        .select('title, body, type')
        .eq('user_id', creatorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      console.log("Latest Notification for Creator:", notif);

      // Verify Audit Logs
      const { data: actLog } = await supabase
        .from('activity_logs')
        .select('action, user_id, entity_id')
        .eq('entity_id', paySuccess.id)
        .single();
      console.log("Audit Activity Log:", actLog);

      // Test 7: Released State (Duplicate prevention)
      console.log("\nTesting State: Released (Duplicate prevention)...");
      const { data: data7, error: error7 } = await supabase.rpc('admin_release_fund', {
        _payment_id: paySuccess.id,
        _admin_id: adminId
      });
      console.log("Result:", { data: data7, error: error7 });
    }

    console.log("\n=== ESCROW STATE VALIDATION TESTING COMPLETE ===");

  } catch (e) {
    console.error("Test execution failed:", e);
  }
}

run();
