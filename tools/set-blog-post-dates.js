// One-off script: backfills the "postDate" field on the 17 real Substack
// posts already imported into staging, matching each by its `url` against
// the Substack feed's `post_date`. The 5 leftover test entries are left
// untouched entirely.
//
// Usage:
//   STRAPI_URL=https://admin-staging.capitalasaforce.com STRAPI_TOKEN=xxx node tools/set-blog-post-dates.js

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
const FEED_URL = "https://tochukwuezeukwu.substack.com/api/v1/posts?sort=new&limit=50";

if (!STRAPI_URL || !STRAPI_TOKEN) {
  console.error("Set STRAPI_URL and STRAPI_TOKEN environment variables first.");
  process.exit(1);
}

async function fetchAllBlogLinks() {
  const res = await fetch(STRAPI_URL + "/api/blog-links?pagination[pageSize]=100", {
    headers: { Authorization: "Bearer " + STRAPI_TOKEN },
  });
  if (!res.ok) throw new Error("Fetch failed: " + res.status + " " + (await res.text()));
  const json = await res.json();
  return json.data || [];
}

async function setPostDate(documentId, postDate) {
  const res = await fetch(STRAPI_URL + "/api/blog-links/" + documentId, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + STRAPI_TOKEN,
    },
    body: JSON.stringify({ data: { postDate } }),
  });
  if (!res.ok) throw new Error("Update failed: " + res.status + " " + (await res.text()));
  return res.json();
}

async function main() {
  const feedRes = await fetch(FEED_URL);
  if (!feedRes.ok) throw new Error("Feed fetch failed: " + feedRes.status);
  const posts = await feedRes.json();
  const dateByUrl = new Map(posts.map((p) => [p.canonical_url, p.post_date]));

  const items = await fetchAllBlogLinks();
  console.log("Found " + items.length + " entries");

  let matched = 0;
  for (const item of items) {
    const postDate = dateByUrl.get(item.url);
    if (!postDate) {
      console.log("Skipping (no match in feed): " + item.title);
      continue;
    }
    await setPostDate(item.documentId, postDate);
    console.log("Set postDate=" + postDate + ": " + item.title);
    matched++;
  }

  console.log("Done. Updated " + matched + " of " + items.length + " entries.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
