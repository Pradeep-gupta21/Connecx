const { Client } = require('pg');

async function run() {
  const client = new Client({
    user: "postgres",
    password: "#2Connecx$%!",
    host: "db.leymyvwnhfreufxayioa.supabase.co",
    database: "postgres",
    port: 5432,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("Connected to database successfully.");

    // Query active RLS policies for social_accounts
    console.log("\n--- Policies on social_accounts ---");
    const res1 = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual 
      FROM pg_policies 
      WHERE tablename = 'social_accounts';
    `);
    res1.rows.forEach(r => {
      console.log(`- Policy: ${r.policyname} | CMD: ${r.cmd} | Roles: ${r.roles} | Qual: ${r.qual}`);
    });

    // Query active RLS policies for creator_profiles
    console.log("\n--- Policies on creator_profiles ---");
    const res2 = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual 
      FROM pg_policies 
      WHERE tablename = 'creator_profiles';
    `);
    res2.rows.forEach(r => {
      console.log(`- Policy: ${r.policyname} | CMD: ${r.cmd} | Roles: ${r.roles} | Qual: ${r.qual}`);
    });

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await client.end();
  }
}

run();
