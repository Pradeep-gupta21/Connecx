async function run() {
  const handles = ["mrbeast", "pewdiepie", "tseries"];
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  for (const handle of handles) {
    const url = `https://www.youtube.com/@${handle}`;
    try {
      const response = await fetch(url, { headers });
      const html = await response.text();

      // Look inside c4TabbedHeaderRenderer or pageHeaderRenderer
      const match = html.match(/"(?:c4TabbedHeaderRenderer|pageHeaderRenderer)"[\s\S]+?"subscriberCountText"\s*:\s*\{.+?"simpleText"\s*:\s*"([^"]+)"/);
      if (match) {
        console.log(`Channel @${handle}: Exact Header Count: "${match[1]}"`);
      } else {
        console.log(`Channel @${handle}: Header match failed.`);
      }
    } catch (err) {
      console.error(`Channel @${handle}: Error:`, err.message);
    }
  }
}

run();
