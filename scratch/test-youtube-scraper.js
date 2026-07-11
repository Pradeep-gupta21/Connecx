async function run() {
  const url = "https://www.youtube.com/@mrbeast";
  console.log("Fetching YouTube URL:", url);
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.log("Failed to fetch page.");
      return;
    }
    
    const html = await response.text();
    console.log("HTML fetched. Searching for 'subscriber' occurrences...");

    // Find and print matches containing 'subscriber' with some context
    const regex = /.{0,100}subscriber.{0,100}/gi;
    let match;
    let count = 0;
    while ((match = regex.exec(html)) !== null && count < 10) {
      console.log(`Match ${++count}:`, match[0]);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
