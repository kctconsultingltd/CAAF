// Recurring job that polls the client's Substack feed and imports any post
// that isn't already in the "Blog Link" content type, so new posts show up on
// the website without anyone re-running the manual import script.
//
// Real posts always get a more-negative `order` than anything already in the
// table (see tools/reorder-blog-links.js for why), so this never needs to
// touch/renumber existing rows — it only ever computes currentMin - 1.

import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

const DEFAULT_FEED_URL =
  "https://tochukwuezeukwu.substack.com/api/v1/posts?sort=new&limit=50";

async function downloadToTempFile(imageUrl: string, filename: string) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Image download failed: " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), crypto.randomUUID() + "-" + filename);
  await fs.promises.writeFile(tmpPath, buf);
  return tmpPath;
}

export default {
  importSubstackPosts: {
    task: async ({ strapi }: { strapi: any }) => {
      const feedUrl = process.env.SUBSTACK_FEED_URL || DEFAULT_FEED_URL;

      let posts: any[];
      try {
        const res = await fetch(feedUrl);
        if (!res.ok) throw new Error("Feed fetch failed: " + res.status);
        posts = (await res.json()) as any[];
      } catch (err: any) {
        strapi.log.error("[substack-import] Failed to fetch feed: " + err.message);
        return;
      }

      const existing = await strapi
        .documents("api::blog-link.blog-link")
        .findMany({ fields: ["url", "order"], limit: -1 });

      const existingUrls = new Set(existing.map((e: any) => e.url));
      let currentMin = existing.reduce(
        (min: number, e: any) => Math.min(min, e.order ?? 0),
        0
      );

      const newPosts = posts
        .filter((p) => !existingUrls.has(p.canonical_url))
        .sort(
          (a, b) => new Date(a.post_date).getTime() - new Date(b.post_date).getTime()
        );

      if (!newPosts.length) {
        strapi.log.info("[substack-import] No new posts found.");
        return;
      }

      for (const p of newPosts) {
        try {
          const slug = p.canonical_url.split("/").pop();
          const tmpPath = await downloadToTempFile(p.cover_image, slug + ".jpg");
          const stat = await fs.promises.stat(tmpPath);

          const [uploaded] = await strapi
            .plugin("upload")
            .service("upload")
            .upload({
              data: {},
              files: {
                path: tmpPath,
                name: slug + ".jpg",
                type: "image/jpeg",
                size: stat.size,
              },
            });

          await fs.promises.unlink(tmpPath);

          currentMin -= 1;
          await strapi.documents("api::blog-link.blog-link").create({
            data: {
              title: p.title,
              url: p.canonical_url,
              description: p.subtitle || "",
              coverImage: uploaded.id,
              order: currentMin,
            },
          });

          strapi.log.info("[substack-import] Imported: " + p.title);
        } catch (err: any) {
          strapi.log.error(
            "[substack-import] Failed to import \"" + p.title + "\": " + err.message
          );
        }
      }
    },
    options: {
      rule: "0 */6 * * *",
    },
  },
};
