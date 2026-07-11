function parseFollowerText(numStr, unitStr) {
  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;
  if (!unitStr) return Math.round(num);
  
  const unit = unitStr.toUpperCase().trim();
  if (unit === "M" || unit === "MILLION") {
    return Math.round(num * 1000000);
  }
  if (unit === "K" || unit === "THOUSAND") {
    return Math.round(num * 1000);
  }
  if (unit === "B" || unit === "BILLION") {
    return Math.round(num * 1000000000);
  }
  if (unit === "CR" || unit === "CRORE") {
    return Math.round(num * 10000000); // 1 Crore = 10 Million
  }
  if (unit === "L" || unit === "LAKH") {
    return Math.round(num * 100000);   // 1 Lakh = 100 Thousand
  }
  return Math.round(num);
}

async function scrapeYoutube(handle) {
  const url = `https://www.youtube.com/@${handle}`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-IN,en-US,en;q=0.9", // Indian locale request
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    const html = await response.text();

    const regex = /([0-9.]+)\s*(M|K|B|Cr|L|million|billion|thousand|crore|lakh)?\s*subscribers/gi;
    const matches = html.matchAll(regex);
    let maxVal = 0;
    for (const m of matches) {
      // m[1] is the number string, m[2] is the unit string
      const val = parseFollowerText(m[1], m[2]);
      if (val > maxVal) maxVal = val;
    }
    return maxVal > 0 ? maxVal : null;
  } catch (e) {
    return null;
  }
}

async function run() {
  const testHandles = ["mrbeast", "pewdiepie", "tseries"];
  for (const handle of testHandles) {
    const count = await scrapeYoutube(handle);
    console.log(`Channel @${handle}: Scraped Subscribers =`, count ? count.toLocaleString() : "FAILED");
  }
}

run();
