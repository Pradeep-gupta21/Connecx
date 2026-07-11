async function run() {
  const url = "https://www.picuki.com/profile/neymarjr";
  console.log("Fetching Picuki URL:", url);
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const response = await fetch(url, { headers });
    console.log("Response status:", response.status);
    if (!response.ok) return;
    const html = await response.text();
    console.log("HTML length:", html.length);

    console.log("Searching for follower count in Picuki HTML...");
    // Picuki renders followers inside: <span class="followed-by">222.1M</span> or similar
    const match = html.match(/class="profile-followers-count"[^>]*>([\s\S]*?)<\/span>/i) 
                  || html.match(/followers[^>]*>([\s\S]*?)<\/span>/i)
                  || html.match(/([\d.]+[MK]?)\s*followers/i);
    if (match) {
      console.log("Found match:", match[0]);
      console.log("Followers text:", match[1]);
    } else {
      console.log("No match found. Scanning for numbers around 'followers'...");
      const regex = /.{0,100}followers.{0,100}/gi;
      let match;
      let count = 0;
      while ((match = regex.exec(html)) !== null && count < 5) {
        console.log(`Match ${++count}:`, match[0]);
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
