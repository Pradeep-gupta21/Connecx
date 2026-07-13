const { Client } = require('pg');

async function run() {
  const client = new Client({
    user: "postgres.leymyvwnhfreufxayioa",
    password: "#2Connecx$%!",
    host: "aws-1-ap-south-1.pooler.supabase.com",
    database: "postgres",
    port: 5432,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("Connected to Supabase Postgres directly via port 5432.");

    const queries = [
      `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending';`,
      `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS released_at timestamp with time zone;`,
      `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES auth.users(id);`
    ];

    for (const q of queries) {
      try {
        console.log("Running:", q);
        await client.query(q);
        console.log("Success.");
      } catch (err) {
        console.error("Query failed:", err.message);
      }
    }
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await client.end();
  }
}

run();
