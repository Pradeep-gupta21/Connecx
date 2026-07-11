async function run() {
  const username = "neymarjr";
  const url = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
  console.log("Fetching Instagram JSON endpoint:", url);
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  try {
    const response = await fetch(url, { headers });
    console.log("Response status:", response.status);
    if (response.ok) {
      const data = await response.json();
      console.log("Success! Followers count:", data.graphql?.user?.edge_followed_by?.count);
    } else {
      console.log("Failed to fetch. Checking if we can try topsearch...");
      const searchUrl = `https://www.instagram.com/web/search/topsearch/?context=blended&query=${username}`;
      const searchResponse = await fetch(searchUrl, { headers });
      console.log("Search Response status:", searchResponse.status);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const user = searchData.users?.find(u => u.user?.username === username)?.user;
        if (user) {
          console.log("Success via Search! Followers count:", user.follower_count);
        } else {
          console.log("User not found in search results.");
        }
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
