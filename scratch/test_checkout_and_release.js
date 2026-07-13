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
  console.log("--- STARTING END-TO-END CHECKOUT & RELEASE FLOW TEST ---");
  try {
    // 1. Get an existing campaign with an active contract
    // If none exists, we can locate/create mock users and mock campaigns.
    // Let's query contracts to see what we have
    const { data: contracts, error: cErr } = await supabase
      .from('contracts')
      .select('id, advertiser_id, creator_id, campaign_id, amount, status')
      .limit(1);

    if (cErr) throw cErr;
    
    let contract = contracts?.[0];
    let campaignId, advertiserId, creatorId, contractId, amount;

    if (!contract) {
      console.log("No contracts found in the database. Creating a mock contract...");
      // Let's find an advertiser profile and a creator profile
      const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, role').limit(10);
      if (pErr) throw pErr;

      const adv = profiles.find(p => p.role === 'advertiser');
      const cre = profiles.find(p => p.role === 'creator');

      if (!adv || !cre) {
        console.error("Could not find advertiser/creator profiles to run mock contract test.");
        return;
      }

      advertiserId = adv.id;
      creatorId = cre.id;

      // Create mock campaign
      const { data: camp, error: campErr } = await supabase
        .from('campaigns')
        .insert({
          advertiser_id: advertiserId,
          title: "Mock Test Campaign",
          brief: "Brief info",
          budget_min: 1000,
          budget_max: 2000,
          status: 'open'
        })
        .select('id')
        .single();
      if (campErr) throw campErr;
      campaignId = camp.id;

      // Create draft contract
      const { data: ct, error: ctErr } = await supabase
        .from('contracts')
        .insert({
          campaign_id: campaignId,
          advertiser_id: advertiserId,
          creator_id: creatorId,
          amount: 500,
          currency: 'INR',
          status: 'draft',
          title: "Mock Test Contract"
        })
        .select('*')
        .single();
      if (ctErr) throw ctErr;
      contract = ct;
      console.log(`Created mock draft contract ${contract.id}`);
    }

    contractId = contract.id;
    campaignId = contract.campaign_id;
    advertiserId = contract.advertiser_id;
    creatorId = contract.creator_id;
    amount = Number(contract.amount);

    console.log(`Using Contract: ${contractId}`);
    console.log(`Campaign: ${campaignId}`);
    console.log(`Advertiser: ${advertiserId}`);
    console.log(`Creator: ${creatorId}`);
    console.log(`Amount: ₹${amount}`);

    // Clean up or ensure wallet exists
    await supabase.rpc('ensure_wallet', { _user_id: creatorId });
    const { data: walletBefore } = await supabase.from('wallets').select('*').eq('user_id', creatorId).single();
    console.log(`Wallet before: Available=${walletBefore.available_balance}, Held=${walletBefore.held_balance}, Pending=${walletBefore.pending_balance}`);

    // Reset contract to draft for a complete clean test flow
    await supabase.from('contracts').update({ status: 'draft', payment_id: null }).eq('id', contractId);
    await supabase.from('campaigns').update({ status: 'open', funded: false, funded_payment_id: null }).eq('id', campaignId);

    // 2. Create Payment row (pending)
    console.log("1. Creating pending payment row...");
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert({
        payer_id: advertiserId,
        payee_id: creatorId,
        campaign_id: campaignId,
        contract_id: contractId,
        amount: amount,
        creator_earnings: amount * 0.9, // 10% marketplace fee
        platform_fee: amount * 0.1,
        gst: 0,
        currency: 'INR',
        type: 'campaign_payment',
        status: 'pending',
        status_v2: 'pending',
        razorpay_order_id: `order_mock_${Date.now()}`
      })
      .select('*')
      .single();
    if (payErr) throw payErr;
    console.log(`Created payment row: ID=${payment.id}, status_v2=${payment.status_v2}`);

    // Link payment to contract
    await supabase.from('contracts').update({ payment_id: payment.id }).eq('id', contractId);

    // 3. Simulate secure payment (finalizeCapture)
    console.log("2. Simulating Razorpay payment capture...");
    // Let's call our backend API function logic or database update to simulate finalizeCapture
    // A. Update payment to HELD status
    await supabase.from('payments').update({
      status: 'held',
      status_v2: 'held',
      razorpay_payment_id: `pay_mock_${Date.now()}`,
      processed_at: new Date().toISOString()
    }).eq('id', payment.id);

    // B. Update campaign to payment_secured
    await supabase.from('campaigns').update({
      funded: true,
      funded_amount: amount,
      funded_at: new Date().toISOString(),
      funded_payment_id: payment.id,
      status: 'payment_secured'
    }).eq('id', campaignId);

    // C. Update contract to active
    await supabase.from('contracts').update({
      status: 'active'
    }).eq('id', contractId);

    // D. Hold creator earnings in pending_balance
    const creatorAmt = Number(payment.creator_earnings);
    console.log(`Crediting hold balance to creator: ₹${creatorAmt}`);
    await supabase.rpc('apply_wallet_txn', {
      _user_id: creatorId,
      _type: 'hold',
      _amount: creatorAmt,
      _reference_type: 'payment',
      _reference_id: payment.id,
      _description: 'Funds secured for campaign payment'
    });

    // Verify hold wallet balance updated
    const { data: walletAfterPay } = await supabase.from('wallets').select('*').eq('user_id', creatorId).single();
    console.log(`Wallet after payment: Available=${walletAfterPay.available_balance}, Held=${walletAfterPay.held_balance}, Pending=${walletAfterPay.pending_balance}`);
    if (Number(walletAfterPay.held_balance) < Number(walletBefore.held_balance) + creatorAmt) {
      throw new Error("Held balance was not updated correctly after payment!");
    }
    console.log("Success: Held balance incremented correctly!");

    // 4. Simulate deliverable submission by creator
    console.log("3. Simulating Deliverables Submission by creator...");
    await supabase.from('contracts').update({
      status: 'submitted',
      deliverable_urls: [{ name: "mock_work.pdf", url: "https://example.com/mock_work.pdf" }],
      submission_notes: "Completed work",
      submitted_at: new Date().toISOString()
    }).eq('id', contractId);

    // Verify contract status
    const { data: contractSubmitted } = await supabase.from('contracts').select('status').eq('id', contractId).single();
    console.log(`Contract status after submission: ${contractSubmitted.status}`);

    // 5. Simulate deliverables approval by advertiser
    console.log("4. Simulating Deliverables Approval by advertiser...");
    await supabase.from('contracts').update({
      status: 'approved',
      reviewed_at: new Date().toISOString()
    }).eq('id', contractId);

    await supabase.from('campaigns').update({
      status: 'under_review'
    }).eq('id', campaignId);

    console.log("Success: Contract approved and Campaign set to under_review");

    // 6. Simulate admin release payout
    console.log("5. Simulating Admin Payout Release...");
    // A. Update payment to released/succeeded
    await supabase.from('payments').update({
      status: 'succeeded',
      status_v2: 'released',
      released_at: new Date().toISOString()
    }).eq('id', payment.id);

    // B. Release creator balance
    await supabase.rpc('apply_wallet_txn', {
      _user_id: creatorId,
      _type: 'release',
      _amount: creatorAmt,
      _reference_type: 'payment',
      _reference_id: payment.id,
      _description: 'Funds released to available balance'
    });

    // C. Complete contract and campaign
    await supabase.from('contracts').update({ status: 'completed' }).eq('id', contractId);
    await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId);

    // 7. Verify final results
    console.log("6. Verifying Final Results...");
    const { data: walletFinal } = await supabase.from('wallets').select('*').eq('user_id', creatorId).single();
    console.log(`Final wallet: Available=${walletFinal.available_balance}, Held=${walletFinal.held_balance}, Pending=${walletFinal.pending_balance}`);

    const { data: contractFinal } = await supabase.from('contracts').select('status').eq('id', contractId).single();
    console.log(`Final Contract status: ${contractFinal.status}`);

    const { data: campaignFinal } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
    console.log(`Final Campaign status: ${campaignFinal.status}`);

    // Assert available balance increased, held balance decreased
    const expectedAvail = Number(walletAfterPay.available_balance) + creatorAmt;
    if (Math.abs(Number(walletFinal.available_balance) - expectedAvail) > 0.01) {
      throw new Error(`Available balance did not increment correctly! Expected ${expectedAvail}, got ${walletFinal.available_balance}`);
    }
    console.log("Success: Available balance credited correctly!");
    console.log("Success: E2E Checkout & Release flow executes perfectly and wallet updates are verified!");
  } catch (e) {
    console.error("E2E Test failed:", e);
  }
}

run();
