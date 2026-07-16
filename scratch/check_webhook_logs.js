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

async function checkLogs() {
  console.log("Checking webhook response logs in database...");
  
  // 1. Let's create the helper function to query pg_net logs
  const createFuncSql = `
    CREATE OR REPLACE FUNCTION public.get_webhook_logs()
    RETURNS TABLE(id bigint, status_code integer, error_msg text)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      RETURN QUERY
      SELECT r.id, r.status_code, r.error_msg
      FROM net.http_responses r
      ORDER BY r.id DESC
      LIMIT 10;
    END;
    $$;
  `;

  // Wait, we can't run DDL via REST API, but wait!
  // Can we create it? No, DDL via REST API fails.
  // Wait, let's ask the user to run it in the SQL Editor, OR check if we can run it.
  // Actually, let's just ask the user to run this SELECT in their SQL Editor!
  // "SELECT * FROM net.http_responses ORDER BY created_at DESC LIMIT 10;"
  // This is much easier!
}

checkLogs();
