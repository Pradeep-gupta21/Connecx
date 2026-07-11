function parseFollowerText(text) {
  const clean = text.toUpperCase().replace(/,/g, "").trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  
  if (clean.includes("M") || clean.includes("MILLION")) {
    return Math.round(num * 1000000);
  }
  if (clean.includes("K") || clean.includes("THOUSAND")) {
    return Math.round(num * 1000);
  }
  if (clean.includes("B") || clean.includes("BILLION")) {
    return Math.round(num * 1000000000);
  }
  return Math.round(num);
}

async function run() {
  const url = "https://www.youtube.com/@mrbeast";
  console.log("Fetching YouTube URL:", url);
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const response = await fetch(url, { headers });
    const html = await response.text();

    console.log("=== Finding All Matches ===");
    // Match all "subscriberCountText" values on the page
    const regex = /"subscriberCountText"\s*:\s*\{.+?"simpleText"\s*:\s*"([^"]+)"/g;
    let match;
    let counts = [];
    
    // Using a simpler non-global search in a loop or matchAll
    const allMatches = html.matchAll(/"subscriberCountText"\s*:\s*\{.+?"simpleText"\s*:\s*"([^"]+)"/g);
    for (const m of allMatches) {
      const parsed = parseFollowerText(m[1].replace(/subscribers/gi, "").trim());
      console.log(`Found string: "${m[1]}" -> Parsed: ${parsed}`);
      counts.push(parsed);
    }

    if (counts.length > 0) {
      const maxCount = Math.max(...counts);
      console.log("Maximum subscriber count found:", maxCount);
    } else {
      console.log("No subscriber counts found.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
