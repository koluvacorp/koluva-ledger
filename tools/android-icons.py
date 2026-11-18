"""Iconos Android (adaptativo + clásico + splash) desde la geometría del isotipo de Ledger."""
import os, importlib.util, sys
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('gb', os.path.join(ROOT, 'tools', 'gen-brand.py')); gb = importlib.util.module_from_spec(spec); spec.loader.exec_module(gb)
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

def pillars(px, box_ratio, colors, bg=None):
    S = px * 4; im = Image.new('RGBA', (S, S), bg or (0, 0, 0, 0)); d = ImageDraw.Draw(im); k = S / 256
    for faces in gb.faces_fit(256, 256 * box_ratio):
        for poly, c in zip(faces, colors): d.polygon([(x * k, y * k) for x, y in poly], fill=c)
    return im.resize((px, px), Image.LANCZOS)

W, K = (255, 255, 255, 255), (20, 20, 22, 255)
for name, m in dens.items():
    fg = pillars(int(108 * m), 0.50, (W, K, W)); fg.save(os.path.join(RES, f'mipmap-{name}', 'ic_launcher_foreground.png'))
    px = int(48 * m); icon = gb.icon_png(px)
    icon.save(os.path.join(RES, f'mipmap-{name}', 'ic_launcher.png'))
    mask = Image.new('L', (px * 4, px * 4), 0); ImageDraw.Draw(mask).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255); mask = mask.resize((px, px), Image.LANCZOS)
    r = Image.new('RGBA', (px, px), (0, 0, 0, 0)); r.paste(gb.icon_png(px, True), (0, 0), mask); r.save(os.path.join(RES, f'mipmap-{name}', 'ic_launcher_round.png'))
# splash: fondo tinta + isotipo a color centrado
logo = pillars(512, 0.9, ((200, 16, 46, 255), (138, 15, 36, 255), (200, 16, 46, 255))); logo.save(os.path.join(RES, 'drawable', 'splash_logo.png'))
for root, _, files in os.walk(RES):
    for f in files:
        if f == 'splash.png': os.remove(os.path.join(root, f))
open(os.path.join(RES, 'drawable', 'splash.xml'), 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n  <item><shape android:shape="rectangle"><solid android:color="#141416"/></shape></item>\n  <item android:gravity="center" android:width="120dp" android:height="120dp"><bitmap android:src="@drawable/splash_logo" android:gravity="fill"/></item>\n</layer-list>\n')
open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#C8102E</color></resources>\n')
print('Iconos Android listos')
