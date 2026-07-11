async function run() {
  const url = "https://www.instagram.com/neymarjr/";
  console.log("Fetching Instagram URL:", url);
  
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

    // Look for follower counts in meta tags or script tags
    // e.g. <meta content="222M Followers, 1,234 Following, 2,345 Posts..." name="description" />
    const matchMeta = html.match(/<meta\s+content="([^"]+ Followers[^"]+)"/i) || html.match(/content="([^"]+ Followers[^"]+)"/i);
    if (matchMeta) {
      console.log("Found Followers Meta Content:", matchMeta[1]);
    } else {
      console.log("Followers meta match failed. Searching for 'Followers' in HTML...");
      const regex = /.{0,100}followers.{0,100}/gi;
      let match;
      let count = 0;
      while ((match = regex.exec(html)) !== null && count < 5) {
        console.log(`Match ${++count}:`, match[0]);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
