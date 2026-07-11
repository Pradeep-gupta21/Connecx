async function run() {
  const url = "https://www.facebook.com/NeymarJr/";
  console.log("Fetching Facebook URL:", url);
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const response = await fetch(url, { headers });
    console.log("Response status:", response.status);
    const html = await response.text();
    console.log("HTML length:", html.length);

    console.log("Searching for 'followers' or 'likes' in Facebook HTML...");
    // Facebook has follower counts in meta tags or script elements
    const regex = /([0-9.]+)\s*(M|K|B|Cr|L|million|billion|thousand)?\s*(?:followers|likes|people follow|people like)/gi;
    const matches = html.matchAll(regex);
    let count = 0;
    for (const m of matches) {
      console.log(`Match ${++count}:`, m[0]);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
