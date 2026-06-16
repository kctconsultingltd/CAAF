// Recurring job that polls the client's Substack feed and imports any post
// that isn't already in the "Blog Link" content type, so new posts show up on
// the website without anyone re-running the manual import script.
//
// Each entry's `postDate` is the post's actual Substack publish date, and the
// frontend sorts by postDate:desc — so a freshly imported post always sorts
// first without any renumbering of existing rows.
//
// After every run, a Telegram message is sent summarizing the result (set
// TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID to enable; silently skipped otherwise).

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

async function notifyTelegram(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch {
    // A failed notification should never break the import job.
  }
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
        await notifyTelegram(
          "[substack-import] Run failed: could not fetch feed (" + err.message + ")"
        );
        return;
      }

      const existing = await strapi
        .documents("api::blog-link.blog-link")
        .findMany({ fields: ["url"], limit: -1 });

      const existingUrls = new Set(existing.map((e: any) => e.url));

      const newPosts = posts
        .filter((p) => !existingUrls.has(p.canonical_url))
        .sort(
          (a, b) => new Date(a.post_date).getTime() - new Date(b.post_date).getTime()
        );

      if (!newPosts.length) {
        strapi.log.info("[substack-import] No new posts found.");
        await notifyTelegram("[substack-import] Run complete: no new posts found.");
        return;
      }

      const imported: string[] = [];
      const failed: { title: string; error: string }[] = [];

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

          await strapi.documents("api::blog-link.blog-link").create({
            data: {
              title: p.title,
              url: p.canonical_url,
              description: p.subtitle || "",
              coverImage: uploaded.id,
              postDate: p.post_date,
            },
          });

          strapi.log.info("[substack-import] Imported: " + p.title);
          imported.push(p.title);
        } catch (err: any) {
          strapi.log.error(
            "[substack-import] Failed to import \"" + p.title + "\": " + err.message
          );
          failed.push({ title: p.title, error: err.message });
        }
      }

      const lines = ["[substack-import] Run complete."];
      if (imported.length) {
        lines.push("Imported (" + imported.length + "):");
        imported.forEach((title) => lines.push("  ✓ " + title));
      }
      if (failed.length) {
        lines.push("Failed (" + failed.length + "):");
        failed.forEach((f) => lines.push("  ✗ " + f.title + " — " + f.error));
      }
      await notifyTelegram(lines.join("\n"));
    },
    options: {
      rule: "0 */6 * * *",
    },
  },
};
