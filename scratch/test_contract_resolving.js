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
  console.log("=== TESTING CONTRACT RESOLVING LOGIC ===");
  try {
    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('id, amount, status, status_v2, contract_id, campaign_id, payee_id')
      .eq('status_v2', 'held')
      .limit(50);
    if (pErr) throw pErr;

    console.log(`Found ${payments.length} held payments.`);
    for (const p of payments) {
      console.log(`\nPayment ID: ${p.id}`);
      console.log(`  Amount: ${p.amount}, campaign_id: ${p.campaign_id}, contract_id: ${p.contract_id}`);

      // 1. Old logic:
      let oldContract = null;
      try {
        let query = supabase
          .from("contracts")
          .select("id, status, campaign_id, creator_id");
        query = p.contract_id
          ? query.eq("id", p.contract_id)
          : query.eq("campaign_id", p.campaign_id);
        const { data, error } = await query.maybeSingle();
        if (error) {
          console.log(`  Old logic error: ${error.message}`);
        } else {
          oldContract = data;
          console.log(`  Old logic found: ID=${data?.id}, status=${data?.status}, creator_id=${data?.creator_id}`);
        }
      } catch (err) {
        console.log(`  Old logic exception:`, err);
      }

      // 2. New proposed logic:
      let newContract = null;
      try {
        if (p.contract_id) {
          const { data } = await supabase
            .from("contracts")
            .select("id, status, campaign_id, creator_id")
            .eq("id", p.contract_id)
            .maybeSingle();
          newContract = data;
        } else {
          const { data: byPayment } = await supabase
            .from("contracts")
            .select("id, status, campaign_id, creator_id")
            .eq("payment_id", p.id)
            .maybeSingle();
          
          if (byPayment) {
            newContract = byPayment;
          } else {
            const { data: byFallback } = await supabase
              .from("contracts")
              .select("id, status, campaign_id, creator_id")
              .eq("campaign_id", p.campaign_id)
              .eq("creator_id", p.payee_id)
              .maybeSingle();
            newContract = byFallback;
          }
        }
        console.log(`  New logic found: ID=${newContract?.id}, status=${newContract?.status}, creator_id=${newContract?.creator_id}`);
      } catch (err) {
        console.log(`  New logic exception:`, err);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

run();
