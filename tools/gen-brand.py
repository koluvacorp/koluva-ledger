"""Genera la identidad vectorial de Koluva Ledger (isotipo, imagotipo, logotipo, icono de app).
Isotipo propio: tres pilares isometricos (30 grados) que suben como escalera = cada asiento del libro suma un peldaño.
Uso: python tools/gen-brand.py  (necesita fonttools, brotli, pillow)"""
import math, os, io
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'www', 'assets')
RED, GRAN, INK, WHITE = '#C8102E', '#8A0F24', '#141416', '#FFFFFF'

# ---------- geometria del isotipo ----------
C30 = math.cos(math.radians(30))
def pillar(cx, cy, h, e=40.0):
    """Pilar isometrico: base centrada en (cx,cy), alto h. Devuelve caras top/left/right."""
    d = C30 * e
    def P(x, y): return (cx + x, cy + y - h)   # y de arriba hacia abajo; sube con h
    top = [P(0, -e), P(d, -e/2), P(0, 0), P(-d, -e/2)]
    left = [P(-d, -e/2), P(0, 0), (cx, cy + e), (cx - d, cy + e/2 + 0)]
    left = [P(-d, -e/2), P(0, 0), (cx, cy), (cx - d, cy - e/2)]
    right = [P(0, 0), P(d, -e/2), (cx + d, cy - e/2), (cx, cy)]
    return top, left, right

def build_faces():
    e, step, gap = 40.0, 1.17, 1.0
    out = []
    for i in (2, 1, 0):  # del fondo al frente
        cx = i * C30 * e * 2 * step / 2 * 1.0 * 1.0
        cx = i * C30 * e * step
        cy = -i * e * 0.5 * step
        h = 34 + i * 34
        t, l, r = pillar(cx, cy + e/2, h, e)
        out.append((t, l, r))
    return out

def shrink(poly, k=0.93):
    mx = sum(p[0] for p in poly) / len(poly); my = sum(p[1] for p in poly) / len(poly)
    return [(mx + (x - mx) * k, my + (y - my) * k) for x, y in poly]

def faces_fit(size=256, box=176):
    faces = build_faces()
    pts = [p for f in faces for poly in f for p in poly]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    s = box / max(x1 - x0, y1 - y0)
    ox = size/2 - (x0 + x1) / 2 * s; oy = size/2 - (y0 + y1) / 2 * s
    tr = lambda poly: [(x * s + ox, y * s + oy) for x, y in poly]
    return [tuple(shrink(tr(p)) for p in f) for f in faces]

def poly_d(poly): return 'M' + ' '.join(f'{x:.2f} {y:.2f}' for x, y in poly) + 'Z'

def iso_group(cols, size=256, box=176):
    """cols=(top,left,right) colores."""
    g = ['<g stroke-linejoin="round" stroke-width="2">']
    for faces in faces_fit(size, box):
        for poly, c in zip(faces, cols):
            g.append(f'<path fill="{c}" stroke="{c}" d="{poly_d(poly)}"/>')
    g.append('</g>')
    return ''.join(g)

def svg(vb, title, body, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-labelledby="title"><title id="title">{title}</title>{extra}{body}</svg>'

# ---------- descriptor LEDGER en contornos (Outfit) ----------
font = instantiateVariableFont(TTFont(os.path.join(A, 'outfit-brand-latin.woff2')), {'wght': 600})
gs, cmap = font.getGlyphSet(), font.getBestCmap()
cap = font['OS/2'].sCapHeight or 700
def text_paths(txt, fill, track=60):
    x = 0; parts = []
    for ch in txt:
        n = cmap[ord(ch)]; pen = SVGPathPen(gs); gs[n].draw(pen)
        parts.append(f'<path d="{pen.getCommands()}" transform="translate({x} 0)"/>')
        x += gs[n].width + track
    return f'<g fill="{fill}" transform="translate(919 176) scale({67.8/cap:.5f} -{67.8/cap:.5f})">' + ''.join(parts) + '</g>', x * 67.8 / cap

WORD = ('<g transform="translate(260 55.98) scale(.562685)"><clipPath id="wu12"><rect x="-20" y="48" width="1400" height="160"/></clipPath>'
        '<g clip-path="url(#wu12)" fill="none" stroke="{c}" stroke-width="22" stroke-miterlimit="10">'
        '<path d="M11.0 48V208"/><path d="M142 24L11.0 124"/><path d="M52.5 93L122 232"/>'
        '<polygon points="229.50,60.70 171.22,94.35 171.22,161.65 229.50,195.30 287.78,161.65 287.78,94.35" stroke-linejoin="miter"/>'
        '<path d="M350.0 48V208"/><path d="M339 197.0H439"/><path d="M490.0 48V128A69.0 69.0 0 0 0 628.0 128V48"/>'
        '<path d="M675.8 24L762 232L845.2 24"/><path d="M853.8 232L929 34L1004.2 232"/><path d="M875 162H983"/></g></g>'
        '<rect x="874" y="54" width="5" height="148" fill="#C8102E"/>')

def imagotipo(ink, cols, name):
    desc, w = text_paths('LEDGER', ink)
    width = int(919 + w + 8)
    iso = f'<g transform="translate(0 15) scale(.882812)">{iso_group(cols)}</g>'
    return svg(f'0 0 {width} 256', f'Koluva Ledger imagotipo {name}', iso + WORD.format(c=ink) + desc)

def logotipo(ink, name):
    desc, w = text_paths('LEDGER', ink)
    width = int(919 - 260 + w + 8)
    return svg(f'260 0 {width} 256', f'Koluva Ledger logotipo {name}', WORD.format(c=ink) + desc)

def write(name, s):
    open(os.path.join(A, name), 'w', encoding='utf-8').write(s)

for nm, cols in (('color', (RED, GRAN, RED)), ('ink', (INK,)*3), ('white', (WHITE,)*3)):
    write(f'koluva-ledger-isotipo-{nm}.svg', svg('0 0 256 256', f'Koluva Ledger isotipo {nm}', iso_group(cols)))
for nm, ink, cols in (('white', WHITE, (WHITE,)*3), ('ink', INK, (INK,)*3), ('color', INK, (RED, GRAN, RED))):
    write(f'koluva-ledger-imagotipo-{nm}.svg', imagotipo(ink, cols, nm))
for nm, ink in (('white', WHITE), ('ink', INK)):
    write(f'koluva-ledger-logotipo-{nm}.svg', logotipo(ink, nm))

# icono de app: degradado rojo, pilares blanco/negro (brand book: "mitades blanca y negra sobre rojo")
grad = ('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#DC1B38"/><stop offset="1" stop-color="#8A0F24"/></linearGradient></defs>'
        '<rect width="512" height="512" rx="116" fill="url(#g)"/>')
icon_body = '<g transform="translate(256 256) scale(1.5) translate(-128 -128)">' + iso_group((WHITE, INK, WHITE), 256, 150) + '</g>'
write('app-icon.svg', svg('0 0 512 512', 'Koluva Ledger icono de app', icon_body, grad))

# PNG del icono (Pillow, supersampling 4x)
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def icon_png(px, maskable=False):
    S = px * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    grad_img = Image.new('RGB', (S, S))
    gp = grad_img.load(); c0, c1 = (0xDC, 0x1B, 0x38), (0x8A, 0x0F, 0x24)
    for y in range(S):
        for x in range(0, S, 1):
            gp[x, y] = lerp(c0, c1, (x + y) / (2 * S))
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, S - 1, S - 1), radius=0 if maskable else int(S * 116 / 512), fill=255)
    im.paste(grad_img, (0, 0), m)
    box = 150 if not maskable else 118
    d = ImageDraw.Draw(im)
    k = S / 512 * 1.5
    for faces in faces_fit(256, box):
        for poly, c in zip(faces, ((255, 255, 255), (20, 20, 22), (255, 255, 255))):
            pts = [((x - 128) * k + S / 2, (y - 128) * k + S / 2) for x, y in poly]
            d.polygon(pts, fill=c)
    return im.resize((px, px), Image.LANCZOS)

icon_png(1024).save(os.path.join(A, 'app-icon.png'))
icon_png(256).save(os.path.join(A, 'app-icon-256.png'))
icon_png(1024, True).save(os.path.join(A, 'app-icon-maskable.png'))
ico = icon_png(256); ico.save(os.path.join(A, 'app-icon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
# isotipo en grupos por pilar para la apertura animada
groups = []
for faces in faces_fit(256, 176):
    groups.append('<g class="p">' + ''.join(f'<path fill="{c}" stroke="{c}" stroke-width="2" stroke-linejoin="round" d="{poly_d(poly)}"/>' for poly, c in zip(faces, (RED, GRAN, RED))) + '</g>')
svg_iso = '<svg class="iso" viewBox="0 0 256 256" aria-hidden="true">' + ''.join(groups) + '</svg>'
open(os.path.join(ROOT, 'www', 'js', 'brand.js'), 'w', encoding='utf-8').write('window.LEDGER_ISO=' + __import__('json').dumps(svg_iso) + ';\n')
print('Marca Ledger generada en', A)
