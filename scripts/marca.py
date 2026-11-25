# Iconos y la imagen para compartir: el medio sol del alba sobre la línea de las peñas, y la portada en pequeño.
#   python -I -X utf8 scripts/marca.py   → marca/favicon.svg, favicon-32.png, apple-touch-icon.png, icono-512.png, img/og.jpg
# La letra de «Alba» (Darker Grotesque 800, SIL OFL) se baja de Google Fonts a ref/raw/fuentes/ (User-Agent genérico).
import json, re, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
(RAIZ / 'marca').mkdir(exist_ok=True)
(RAIZ / 'img').mkdir(exist_ok=True)
FUENTES = RAIZ / 'ref/raw/fuentes'
FUENTES.mkdir(parents=True, exist_ok=True)
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) maqueta-web-local/1.0'

MARCA, ACENTO, FONDO = '#1D3A2D', '#B5401F', '#EEF2EE'
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="{FONDO}"/><path d="M14 43a18 18 0 0 1 36 0" fill="none" stroke="{ACENTO}" stroke-width="6" stroke-linecap="round"/><path d="M6 44.5l10-7 7 4 9-10 9 8 6-4 11 9" fill="none" stroke="{MARCA}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>'''
(RAIZ / 'marca/favicon.svg').write_text(svg, encoding='utf-8')

def icono(n, fondo_redondo=True):
    k = n / 64
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if fondo_redondo:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(14 * k), fill=FONDO)
    else:
        d.rectangle([0, 0, n, n], fill=FONDO)
    w = max(2, int(6 * k))
    d.arc([14 * k, 25 * k, 50 * k, 61 * k], 180, 360, fill=ACENTO, width=w)
    pts = [(6, 44.5), (16, 37.5), (23, 41.5), (32, 31.5), (41, 39.5), (47, 35.5), (58, 44.5)]
    d.line([(x * k, y * k) for x, y in pts], fill=MARCA, width=max(2, int(4 * k)), joint='curve')
    return im

icono(32).save(RAIZ / 'marca/favicon-32.png')
icono(180, False).convert('RGB').save(RAIZ / 'marca/apple-touch-icon.png')
icono(512).save(RAIZ / 'marca/icono-512.png')

# ---------- img/og.jpg: el panorama del respaldo, en pequeño ----------
def fuente(peso):
    f = FUENTES / f'darker-grotesque-{peso}.ttf'
    if not f.exists():
        css = urllib.request.urlopen(urllib.request.Request(f'https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@{peso}', headers={'User-Agent': 'curl/8'}), timeout=60).read().decode()
        url = re.findall(r'url\((https://[^)]+)\)', css)[-1]
        f.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read())
    return f

P = json.loads((RAIZ / 'data/portada.json').read_text(encoding='utf-8'))
W, H = 1200, 630
y0, a0, a1 = 470, 100, 260
kx = W / (a1 - a0); ky = kx
im = Image.new('RGB', (W, H), '#DCE8EF')
d = ImageDraw.Draw(im)
top, mid, low = (127, 170, 214), (169, 200, 228), (220, 232, 239)
for y in range(y0):
    t = y / y0
    c = [int(top[i] + (mid[i] - top[i]) * min(1, t / .55)) if t < .55 else int(mid[i] + (low[i] - mid[i]) * (t - .55) / .45) for i in range(3)]
    d.line([(0, y), (W, y)], fill=tuple(c))
try:
    fA = ImageFont.truetype(str(fuente(800)), 330)
    fT = ImageFont.truetype(str(fuente(700)), 44)
except Exception as e:
    print('sin la letra:', e); fA = fT = ImageFont.load_default()
colores = ['#A9BBC6', '#8BA1A9', '#5D796B', '#3A5546']
# «Alba» detrás de las peñas: la base, un cuarto por debajo de la cumbre más alta que tiene debajo
env = [max(c['perfil'][i] for c in P['capas']) for i in range(len(P['capas'][0]['perfil']))]
def alto_en(x):
    a = a0 + x / kx; i = a / (360 / len(env)); j = int(i); f = i - j
    return env[j % len(env)] * (1 - f) + env[(j + 1) % len(env)] * f
x0, ancho = 70, fA.getlength('Alba') if hasattr(fA, 'getlength') else 580
cima = max(alto_en(x) for x in range(int(x0), int(x0 + ancho), 6))
alto = 0.74 * 330
d.text((x0, y0 - cima * ky + alto * 0.25), 'Alba', font=fA, fill='#1D3A2D', anchor='ls')
for capa, col in zip(P['capas'], colores):
    v = capa['perfil']; n = len(v)
    pts = []
    a = a0
    while a <= a1:
        i = a / (360 / n); j = int(i); f = i - j
        val = v[j % n] * (1 - f) + v[(j + 1) % n] * f
        pts.append(((a - a0) * kx, y0 - val * ky)); a += 0.5
    d.polygon(pts + [(W, H), (0, H)], fill=col)
d.rectangle([0, y0 + 10, W, H], fill='#22362B')
d.text((70, 560), 'Apartamentos rurales · Caunedo, Somiedo', font=fT, fill='#F1F5EF', anchor='ls')
im.save(RAIZ / 'img/og.jpg', quality=84, optimize=True, progressive=True)
print('→ marca/*, img/og.jpg')
