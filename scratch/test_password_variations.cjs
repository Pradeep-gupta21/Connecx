const { Client } = require('pg');

async function testPassword(password) {
  const client = new Client({
    host: "db.leymyvwnhfreufxayioa.supabase.co",
    port: 5432,
    user: "postgres",
    database: "postgres",
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 3000
  });

  try {
    await client.connect();
    console.log(`SUCCESS! The correct password is: ${password}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed for "${password}": ${err.message}`);
    return false;
  }
}

async function run() {
  const variations = [
    "#2Connecx$%!",
    "#2Connecx$%",
    "#2Connecx",
    "Connecx",
    "postgres",
    "Connecx123"
  ];

  for (const pw of variations) {
    const ok = await testPassword(pw);
    if (ok) break;
  }
}

run();
