async function run() {
  const url = "https://www.instagram.com/neymarjr/";
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const response = await fetch(url, { headers });
    const html = await response.text();
    console.log("Status:", response.status);
    console.log("Title tag:", html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim());
    console.log("HTML snippet:", html.substring(0, 1000));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
