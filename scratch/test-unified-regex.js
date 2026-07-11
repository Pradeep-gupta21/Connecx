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

async function scrapeYoutube(handle) {
  const url = `https://www.youtube.com/@${handle}`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    const html = await response.text();

    const regex = /([0-9.]+)\s*(M|K|B|million|billion|thousand)?\s*subscribers/gi;
    const matches = html.matchAll(regex);
    let maxVal = 0;
    for (const m of matches) {
      const val = parseFollowerText(m[0]);
      if (val > maxVal) maxVal = val;
    }
    return maxVal > 0 ? maxVal : null;
  } catch (e) {
    return null;
  }
}

async function run() {
  const testHandles = ["mrbeast", "pewdiepie", "tseries", "marquesbrownlee"];
  for (const handle of testHandles) {
    const count = await scrapeYoutube(handle);
    console.log(`Channel @${handle}: Scraped Subscribers =`, count ? count.toLocaleString() : "FAILED");
  }
}

run();
