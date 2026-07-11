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

    console.log("=== Generic Regex Matches ===");
    // Pattern to look for any number followed by "subscribers" or "million subscribers"
    const regex = /[0-9.]+\s*(?:M|K|B|million|million|billion|thousand)?\s*subscribers/gi;
    const matches = html.match(regex);
    if (matches) {
      // Print unique matches
      const unique = Array.from(new Set(matches));
      console.log("Found subscriber strings:", unique);
    } else {
      console.log("No subscriber strings found.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
