// One-off script: fixes the "order" field on existing Blog Link entries so the
// 17 real Substack posts always sort before the 5 leftover test entries.
//
// Real posts get negative order values (newest = most negative).
// Test entries get large positive order values, keeping their relative order.
//
// After this runs once, the cron importer (cron-tasks.ts) only ever needs to
// compute new_order = current_minimum_order - 1 for each new post, so it never
// has to touch/renumber any existing row again.
//
// Usage:
//   STRAPI_URL=https://admin-staging.capitalasaforce.com STRAPI_TOKEN=xxx node tools/reorder-blog-links.js

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;

const TEST_ENTRY_TITLES = [
  "Vertical",
  "Fifa World Cup 2026",
];

if (!STRAPI_URL || !STRAPI_TOKEN) {
  console.error("Set STRAPI_URL and STRAPI_TOKEN environment variables first.");
  process.exit(1);
}

async function fetchAll() {
  const res = await fetch(STRAPI_URL + "/api/blog-links?pagination[pageSize]=100&sort=order:asc", {
    headers: { Authorization: "Bearer " + STRAPI_TOKEN },
  });
  if (!res.ok) throw new Error("Fetch failed: " + res.status + " " + (await res.text()));
  const json = await res.json();
  return json.data || [];
}

async function setOrder(documentId, order) {
  const res = await fetch(STRAPI_URL + "/api/blog-links/" + documentId, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + STRAPI_TOKEN,
    },
    body: JSON.stringify({ data: { order } }),
  });
  if (!res.ok) throw new Error("Update failed: " + res.status + " " + (await res.text()));
  return res.json();
}

async function main() {
  const items = await fetchAll();
  console.log("Found " + items.length + " entries");

  const testEntries = items.filter((item) =>
    TEST_ENTRY_TITLES.some((t) => item.title === t || item.title.startsWith(t))
  );
  const realPosts = items.filter((item) => !testEntries.includes(item));

  // realPosts is already sorted order:asc (0 = newest from the import script),
  // so index 0 is the newest. Newest should get the most negative order.
  for (let i = 0; i < realPosts.length; i++) {
    const newOrder = -(realPosts.length - i);
    await setOrder(realPosts[i].documentId, newOrder);
    console.log("Real post -> order " + newOrder + ": " + realPosts[i].title);
  }

  // testEntries keep their existing relative order, pushed to large positive values.
  for (let i = 0; i < testEntries.length; i++) {
    const newOrder = 9000 + i;
    await setOrder(testEntries[i].documentId, newOrder);
    console.log("Test entry -> order " + newOrder + ": " + testEntries[i].title);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
