// One-off script: imports posts from a Substack publication's public API into
// the Strapi "Blog Link" content type, downloading each cover image and
// uploading it to the Strapi media library first.
//
// Usage:
//   STRAPI_URL=https://admin-staging.capitalasaforce.com STRAPI_TOKEN=xxx node tools/import-substack-posts.js

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
const FEED_URL = "https://tochukwuezeukwu.substack.com/api/v1/posts?sort=new&limit=50";

if (!STRAPI_URL || !STRAPI_TOKEN) {
  console.error("Set STRAPI_URL and STRAPI_TOKEN environment variables first.");
  process.exit(1);
}

async function uploadImage(imageUrl, filename) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error("Image download failed: " + imgRes.status);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const form = new FormData();
  form.append("files", new Blob([buf]), filename);

  const res = await fetch(STRAPI_URL + "/api/upload", {
    method: "POST",
    headers: { Authorization: "Bearer " + STRAPI_TOKEN },
    body: form,
  });
  if (!res.ok) throw new Error("Upload failed: " + res.status + " " + (await res.text()));
  const data = await res.json();
  return data[0].id;
}

async function createBlogLink({ title, url, description, coverImageId, postDate }) {
  const res = await fetch(STRAPI_URL + "/api/blog-links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + STRAPI_TOKEN,
    },
    body: JSON.stringify({
      data: { title, url, description, coverImage: coverImageId, postDate },
    }),
  });
  if (!res.ok) throw new Error("Create failed: " + res.status + " " + (await res.text()));
  return res.json();
}

async function main() {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error("Feed fetch failed: " + res.status);
  const posts = await res.json();
  console.log("Found " + posts.length + " posts");

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    try {
      const slug = p.canonical_url.split("/").pop();
      const imgId = await uploadImage(p.cover_image, slug + ".jpg");
      await createBlogLink({
        title: p.title,
        url: p.canonical_url,
        description: p.subtitle || "",
        coverImageId: imgId,
        postDate: p.post_date,
      });
      console.log("[" + (i + 1) + "/" + posts.length + "] Imported: " + p.title);
    } catch (err) {
      console.error("[" + (i + 1) + "/" + posts.length + "] FAILED: " + p.title + " -- " + err.message);
    }
  }
}

main();
