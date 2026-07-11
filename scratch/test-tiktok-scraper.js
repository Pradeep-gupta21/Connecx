async function run() {
  const url = "https://www.tiktok.com/@mrbeast";
  console.log("Fetching TikTok URL:", url);
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  };

  try {
    const response = await fetch(url, { headers });
    console.log("Response status:", response.status);
    const html = await response.text();
    console.log("HTML length:", html.length);

    console.log("Searching for followerCount in TikTok HTML...");
    // Pattern 1
    const match1 = html.match(/"followerCount"\s*:\s*(\d+)/);
    if (match1) {
      console.log("Found match 1:", match1[0]);
      console.log("Followers:", match1[1]);
    } else {
      console.log("Match 1 failed.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
