const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const IMG_DIR = path.join(__dirname, "../img");
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;

// Local images to convert (external Vercel blob images are skipped)
const targets = [
  "handshake.jpg",
  "solardiscussion.jpg",
  "blackglobe2hands.png",
  "office-team.jpg",
  "Lagos Skyline-Cover.jpg",
  "CAAF-removebg-preview.png",
  "835.jpg",
  "vitaly-gariev-c9rttLPYNWA-unsplash.jpg",
  "africa-remove-bg.png",
];

async function optimizeImage(filename) {
  const input = path.join(IMG_DIR, filename);
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const output = path.join(IMG_DIR, base + ".webp");

  if (!fs.existsSync(input)) {
    console.log(`SKIP  ${filename} (not found)`);
    return;
  }

  const before = fs.statSync(input).size;
  await sharp(input)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(output);
  const after = fs.statSync(output).size;
  const pct = Math.round((1 - after / before) * 100);
  console.log(`OK    ${filename} → ${base}.webp  (${pct}% smaller)`);
}

(async () => {
  console.log("Optimizing images...\n");
  for (const f of targets) {
    await optimizeImage(f);
  }
  console.log("\nDone. Update <picture> tags in index.html to use .webp sources.");
})();
