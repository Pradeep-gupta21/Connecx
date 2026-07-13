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
  console.log("=== INSPECTING DB PAYMENTS & CONTRACTS ===");
  try {
    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('id, amount, status, status_v2, contract_id, campaign_id, payee_id, payer_id')
      .limit(50);
    if (pErr) throw pErr;

    console.log(`Found ${payments.length} payments.`);
    for (const p of payments) {
      console.log(`\nPayment ID: ${p.id}`);
      console.log(`  Amount: ${p.amount}, status: ${p.status}, status_v2: ${p.status_v2}`);
      console.log(`  campaign_id: ${p.campaign_id}, contract_id: ${p.contract_id}`);
      
      if (p.contract_id) {
        const { data: c, error: cErr } = await supabase
          .from('contracts')
          .select('id, status, payment_id, campaign_id')
          .eq('id', p.contract_id)
          .maybeSingle();
        if (cErr) {
          console.log(`  Error fetching contract by contract_id:`, cErr.message);
        } else if (c) {
          console.log(`  Linked Contract (via contract_id): ID=${c.id}, status=${c.status}, payment_id=${c.payment_id}, campaign_id=${c.campaign_id}`);
        } else {
          console.log(`  Contract NOT found by contract_id: ${p.contract_id}`);
        }
      }

      // Also search contracts linked by campaign_id or payment_id
      const { data: c2, error: cErr2 } = await supabase
        .from('contracts')
        .select('id, status, payment_id, campaign_id')
        .eq('campaign_id', p.campaign_id)
        .limit(5);
      if (cErr2) {
        console.log(`  Error fetching contract by campaign_id:`, cErr2.message);
      } else if (c2 && c2.length > 0) {
        console.log(`  Contracts linked by campaign_id (${p.campaign_id}):`);
        for (const c of c2) {
          console.log(`    - Contract ID: ${c.id}, status: ${c.status}, payment_id: ${c.payment_id}`);
        }
      }
    }
  } catch (e) {
    console.error("Failed:", e);
  }
}

run();
