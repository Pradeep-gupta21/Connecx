const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://leymyvwnhfreufxayioa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6bGV5bXl2d25oZnJldWZ4YXlvYSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3ODM2NjgzMzMsImV4cCI6MjA5OTI0NDMzM30.2CEZX66r15Cbdd4hUoOlVlyWOBh8sQKxwYckQuYS1dc";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log("--- STARTING TRANSACTIONAL ADMIN RELEASE FUND TEST ---");
  try {
    // 1. Get an existing contract/campaign to build our test case
    const { data: contracts, error: cErr } = await supabase
      .from('contracts')
      .select('id, advertiser_id, creator_id, campaign_id, amount')
      .limit(1);

    if (cErr) throw cErr;
    if (!contracts || contracts.length === 0) {
      console.error("No contracts found to run tests. Please create a contract first.");
      return;
    }

    const contract = contracts[0];
    const contractId = contract.id;
    const campaignId = contract.campaign_id;
    const advertiserId = contract.advertiser_id;
    const creatorId = contract.creator_id;
    const amount = Number(contract.amount);

    console.log(`Using Contract: ${contractId}, Campaign: ${campaignId}, Creator: ${creatorId}, Amount: ₹${amount}`);

    // Ensure wallet exists
    await supabase.rpc('ensure_wallet', { _user_id: creatorId });

    // 2. Create a pending payment
    const { data: payment, error: payErr } = await supabase
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
        status: 'pending',
        status_v2: 'pending',
        payout_status: 'pending',
        razorpay_order_id: `ord_admin_${Date.now()}`
      })
      .select('*')
      .single();
    if (payErr) throw payErr;
    console.log(`Created payment row: ID=${payment.id}, status_v2=${payment.status_v2}, payout_status=${payment.payout_status}`);

    // 3. Test Validation: Payment not yet received (still pending)
    console.log("Testing validation: Payment not received...");
    const { data: res1, error: err1 } = await supabase.rpc('admin_release_fund', {
      _payment_id: payment.id,
      _admin_id: advertiserId // using advertiser id as mock admin id
    });
    if (err1) throw err1;
    console.log("Validation Result (should be failure):", res1);
    if (res1.success) throw new Error("Expected failure for pending payment!");

    // 4. Simulate payment captured (HELD status)
    await supabase.from('payments').update({
      status: 'held',
      status_v2: 'held',
      razorpay_payment_id: `pay_mock_${Date.now()}`
    }).eq('id', payment.id);

    // Secure creator hold balance
    await supabase.rpc('apply_wallet_txn', {
      _user_id: creatorId,
      _type: 'hold',
      _amount: amount * 0.9,
      _reference_type: 'payment',
      _reference_id: payment.id,
      _description: 'Funds secured'
    });

    // Reset contract and campaign statuses to draft/open
    await supabase.from('contracts').update({ status: 'active', payment_id: payment.id }).eq('id', contractId);
    await supabase.from('campaigns').update({ status: 'payment_secured' }).eq('id', campaignId);

    // 5. Test Validation: Advertiser has not approved deliverables
    console.log("Testing validation: Deliverables not approved...");
    const { data: res2, error: err2 } = await supabase.rpc('admin_release_fund', {
      _payment_id: payment.id,
      _admin_id: advertiserId
    });
    if (err2) throw err2;
    console.log("Validation Result (should be failure):", res2);
    if (res2.success) throw new Error("Expected failure for unapproved contract!");

    // Approve contract deliverables
    await supabase.from('contracts').update({ status: 'approved' }).eq('id', contractId);

    // 6. Test Success Flow: Release fund
    console.log("Testing success flow: Releasing fund...");
    const { data: res3, error: err3 } = await supabase.rpc('admin_release_fund', {
      _payment_id: payment.id,
      _admin_id: advertiserId
    });
    if (err3) throw err3;
    console.log("Release Result (should be success):", res3);
    if (!res3.success) throw new Error(`Expected success, got: ${res3.error}`);

    // Verify payment columns updated
    const { data: updatedPay } = await supabase.from('payments').select('status, status_v2, payout_status, released_at, released_by').eq('id', payment.id).single();
    console.log("Updated Payment columns:", updatedPay);
    if (updatedPay.status !== 'released' || updatedPay.payout_status !== 'completed' || !updatedPay.released_at) {
      throw new Error("Payment columns did not update correctly!");
    }
    console.log("Success: Payment table updated correctly!");

    // Verify contract and campaign completed
    const { data: updatedContract } = await supabase.from('contracts').select('status').eq('id', contractId).single();
    const { data: updatedCampaign } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
    console.log(`Contract: ${updatedContract.status}, Campaign: ${updatedCampaign.status}`);
    if (updatedContract.status !== 'completed' || updatedCampaign.status !== 'completed') {
      throw new Error("Contract or campaign status did not update to completed!");
    }
    console.log("Success: Contract & Campaign marked completed!");

    // 7. Test Validation: Prevent duplicate payout
    console.log("Testing validation: Prevent duplicate payout...");
    const { data: res4, error: err4 } = await supabase.rpc('admin_release_fund', {
      _payment_id: payment.id,
      _admin_id: advertiserId
    });
    if (err4) throw err4;
    console.log("Duplicate Payout Result (should be failure):", res4);
    if (res4.success) throw new Error("Expected failure for duplicate release!");

    console.log("--- ALL TRANSACTIONAL TESTS PASSED SUCCESSFULLY ---");
  } catch (e) {
    console.error("E2E Test failed:", e);
  }
}

run();
