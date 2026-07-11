async function run() {
  const url = "https://www.instagram.com/neymarjr/";
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const response = await fetch(url, { headers });
    const html = await response.text();

    console.log("=== Searching for edge_followed_by ===");
    const match = html.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/) || html.match(/"userInteractionCount"\s*:\s*"(\d+)"/);
    if (match) {
      console.log("Found match:", match[0]);
      console.log("Followers:", match[1]);
    } else {
      console.log("No count matches found. Printing first 5 matches for 'count' in JSON...");
      const regex = /"count"\s*:\s*(\d+)/g;
      const all = html.matchAll(regex);
      let count = 0;
      for (const m of all) {
        console.log(`Match ${++count}:`, m[0]);
        if (count >= 10) break;
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
