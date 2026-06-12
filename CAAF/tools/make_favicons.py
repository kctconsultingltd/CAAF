from PIL import Image
from pathlib import Path

# Try to find a suitable source image in the img/ folder
img_dir = Path('img')
candidates = []
for ext in ('png','jpg','jpeg','webp'):
    candidates.extend(sorted(img_dir.glob(f'CAAF*.{ext}')))
if candidates:
    src = candidates[0]
else:
    # fallback: pick any image in img/
    any_img = list(img_dir.glob('*.*'))
    if any_img:
        src = any_img[0]
    else:
        raise SystemExit('No source image found in img/ folder')

out = Path('img')
out.mkdir(parents=True, exist_ok=True)

im = Image.open(src).convert('RGBA')
# Create PNG sizes
sizes = [16,32,48,64,96,128,180,256]
for s in sizes:
    im2 = im.copy()
    im2.thumbnail((s,s), Image.LANCZOS)
    im2.save(out / f'favicon-{s}x{s}.png')

# Apple touch icon
im2 = im.copy()
im2.thumbnail((180,180), Image.LANCZOS)
im2.save(out / 'apple-touch-icon.png')

# Create ICO with multiple sizes (Windows supports multiple sizes in a single .ico)
ico_sizes = [(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
# Pillow can save .ico with sizes parameter
im.save(out / 'favicon.ico', sizes=ico_sizes)

print('Favicons created in', out.resolve())
