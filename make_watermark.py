# Makes assets/eye.png: the app icon's eye on a see-through background, for the corner watermark.
# Runs during the build so no extra image has to be committed.
import os
from PIL import Image

root = os.path.dirname(os.path.abspath(__file__))
src = Image.open(os.path.join(root, "assets", "icon.png")).convert("RGB")
w, h = src.size
bg = src.getpixel((8, 8))
out = Image.new("RGBA", (w, h))
px = src.load()
po = out.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        d = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
        a = max(0, min(255, (d - 18) * 5))
        po[x, y] = (r, g, b, a)
box = out.getbbox()
if box:
    out = out.crop(box)
out.thumbnail((180, 180), Image.LANCZOS)
out.save(os.path.join(root, "assets", "eye.png"))
print("eye.png", out.size)
