const { Client } = require('pg');

async function tryConnect(config, name) {
  console.log(`\n--- Testing Connection: ${name} ---`);
  const client = new Client({
    ...config,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log(`SUCCESS connected to ${name}`);
    const res = await client.query("SELECT version();");
    console.log("Version:", res.rows[0].version);
    return client;
  } catch (err) {
    console.error(`FAILED connected to ${name}:`, err.message);
    return null;
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}

async function run() {
  const password = "#2Connecx$%!";
  
  // Test 1: Direct connection
  await tryConnect({
    host: "db.leymyvwnhfreufxayioa.supabase.co",
    port: 5432,
    user: "postgres",
    database: "postgres",
    password
  }, "Direct connection (db.leymyvwnhfreufxayioa.supabase.co:5432)");

  // Test 2: Pooler connection port 6543 (Transaction mode)
  await tryConnect({
    host: "aws-1-ap-south-1.pooler.supabase.com",
    port: 6543,
    user: "postgres.leymyvwnhfreufxayioa",
    database: "postgres",
    password
  }, "Pooler port 6543 (aws-1-ap-south-1.pooler.supabase.com:6543)");

  // Test 3: Pooler connection port 5432 (Session mode)
  await tryConnect({
    host: "aws-1-ap-south-1.pooler.supabase.com",
    port: 5432,
    user: "postgres.leymyvwnhfreufxayioa",
    database: "postgres",
    password
  }, "Pooler port 5432 (aws-1-ap-south-1.pooler.supabase.com:5432)");
}

run();
