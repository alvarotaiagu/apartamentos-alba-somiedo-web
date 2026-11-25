# Fotos publicables → img/fotos/<nombre>-<ancho>.{webp,jpg} + img/fotos/fotos.json. NUNCA se amplía.
#   python -I -X utf8 scripts/fotos.py
# - EscapadaRural (ref/origen/portales/er-*.webp, hechas por los dueños, casi todas 1600×1200): PROVISIONALES, decisión
#   de Álvaro del 2026-11-25, a la espera de las originales. Elegidas a mano una a una (ver ELEGIDAS y README). Llevan la
#   marca de agua tenue del portal en el centro: NO se toca (ni se borra, ni se tapa, ni se recorta para esconderla, ni
#   se difumina). Tratamiento, el mismo para todas y sin inventar nada:
#     1. enderezar: el giro de las verticales (Hough sobre los bordes), solo si está entre 0,3° y 3°; se recorta lo justo
#        por los bordes para quitar las esquinas vacías (la marca, en el centro, no se toca);
#     2. balance de blancos suave: con los píxeles claros y casi neutros, a la mitad y como mucho un 6 % por canal;
#     3. la misma curva para todas: contraste ×1,04 alrededor del gris medio.
#   Se sirven a 480 y 800 (rejilla) y a su tamaño real, como mucho 1600 (solo el visor).
# - Sensación Rural (sr-*.webp, 750 px, sin marca de agua): solo la fachada de frente (las otras cuatro las enseña mejor
#   una de EscapadaRural). A su tamaño y a 480.
# - Siguen prohibidas las de EuroWeb Media (ref/origen/album, galeria, marca) y las de TusCasasRurales (tcr-*).
# - Paisaje de Wikimedia Commons (licencia comprobada una a una en scripts/commons.json): miniatura de 1280 de Commons,
#   servida a 480 y 800. Créditos en el pie (construir.mjs).
import json, math, time, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SAL = RAIZ / 'img/fotos'
SAL.mkdir(parents=True, exist_ok=True)
CACHE = RAIZ / 'ref/raw/commons-cache'
CACHE.mkdir(parents=True, exist_ok=True)
POR = RAIZ / 'ref/origen/portales'
UA = 'maqueta-web-local/1.0 (prueba de maqueta sin publicar)'

SR = {'casa-fachada': 'sr-apartamentos-rurales-alba-somiedo-137898.webp'}
# nombre en la web → fichero de EscapadaRural (las 20 elegidas de 32; descartes y motivos en el README)
ELEGIDAS = {
    'casa-escalera-pena': 'er-64a52c4d733e8.webp',
    'vista-ventana': 'er-6544fb1e9137d.webp',
    'salon-naranja-cocina': 'er-65732622805f9.webp',
    'comedor-buhardilla': 'er-6573262820962.webp',
    'salon-mesa': 'er-6573262e55a38.webp',
    'cocina-buhardilla': 'er-6573264970832.webp',
    'salon-cocina-pequeno': 'er-65732700a9f0f.webp',
    'cocina-pasillo': 'er-657327088e088.webp',
    'salon-sofa': 'er-657327a41bf4b.webp',
    'salon-blanco': 'er-6573287ecbd26.webp',
    'cocina-ventanas': 'er-65732896da60e.webp',
    'dormitorio-dos-camas': 'er-6573263d5881a.webp',
    'dormitorio-verde-ventana': 'er-6573265d191b2.webp',
    'dormitorio-verde-monte': 'er-657327221994f.webp',
    'dormitorio-crema': 'er-657327971fb29.webp',
    'dormitorio-blanco': 'er-657328859f0eb.webp',
    'bano-ventana-hidromasaje': 'er-65732642f124d.webp',
    'bano-hidromasaje-espejo': 'er-6573288c05c49.webp',
    'bano-ducha': 'er-65732715eed8e.webp',
    'banera-hidromasaje': 'er-65732653edbfb.webp',
}
COMMONS = json.loads((RAIZ / 'scripts/commons.json').read_text(encoding='utf-8'))


def giro_verticales(im):
    """Grados que hay que girar (positivo = antihorario) para poner a plomo las verticales; None si no hay que tocar."""
    import cv2
    g = np.asarray(im.convert('L'))
    h, w = g.shape
    bordes = cv2.Canny(g, 60, 160)
    seg = cv2.HoughLinesP(bordes, 1, np.pi / 720, threshold=90, minLineLength=int(h * 0.14), maxLineGap=6)
    if seg is None:
        return None
    ang, peso = [], []
    for x1, y1, x2, y2 in np.asarray(seg).reshape(-1, 4):
        dx, dy = x2 - x1, y2 - y1
        if dy == 0:
            continue
        a = math.degrees(math.atan2(dx, dy))          # 0 = vertical
        if a > 90: a -= 180
        if a < -90: a += 180
        if abs(a) <= 8:
            ang.append(a); peso.append(math.hypot(dx, dy))
    if len(ang) < 6:
        return None
    orden = np.argsort(ang); a = np.array(ang)[orden]; p = np.array(peso)[orden]
    med = float(a[np.searchsorted(np.cumsum(p), p.sum() / 2)])
    return med if 0.3 <= abs(med) <= 3 else None


def enderezar(im, grados):
    W, H = im.size
    t = math.radians(abs(grados))
    s = min(W / (W * math.cos(t) + H * math.sin(t)), H / (W * math.sin(t) + H * math.cos(t)))
    r = im.rotate(grados, resample=Image.BICUBIC, expand=False)
    w, h = int(W * s) // 2 * 2, int(H * s) // 2 * 2
    x0, y0 = (W - w) // 2, (H - h) // 2
    return r.crop((x0, y0, x0 + w, y0 + h))


def color(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    lum = a.mean(axis=2)
    sat = a.max(axis=2) - a.min(axis=2)
    m = (lum > np.percentile(lum, 97)) & (sat < 40) & (lum < 250)
    gan = [1.0, 1.0, 1.0]
    if m.sum() > 200:
        med = a[m].mean(axis=0)
        gris = med.mean()
        gan = [float(np.clip(1 + 0.5 * (gris / c - 1), 0.94, 1.06)) for c in med]
        a = a * np.array(gan)
    a = 127.5 + (a - 127.5) * 1.04                      # la misma curva para todas
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), [round(x, 3) for x in gan]


lista = []

def guardar(nombre, im, anchos, calidad=80):
    im = im.convert('RGB')
    w0, h0 = im.size
    hechos = []
    for w in sorted(set(min(a, w0) for a in anchos)):
        h = round(h0 * w / w0)
        r = im if w == w0 else im.resize((w, h), Image.LANCZOS)
        r.save(SAL / f'{nombre}-{w}.webp', 'WEBP', quality=calidad, method=6)
        r.save(SAL / f'{nombre}-{w}.jpg', 'JPEG', quality=82, optimize=True, progressive=True)
        hechos.append(w)
    return {'nombre': nombre, 'ancho': w0, 'alto': h0, 'anchos': hechos}

for nombre, f in SR.items():
    im = Image.open(POR / f)
    d = guardar(nombre, im, [480, im.size[0]])
    d['origen'] = 'Sensación Rural (ficha del alojamiento), sin marca de agua'
    lista.append(d)
    print(nombre, d['ancho'], 'x', d['alto'], d['anchos'])

for nombre, f in ELEGIDAS.items():
    im = Image.open(POR / f).convert('RGB')
    g = giro_verticales(im)
    if g is not None:
        im = enderezar(im, g)
    im, gan = color(im)
    d = guardar(nombre, im, [480, 800, 1600], calidad=78)
    d['origen'] = 'EscapadaRural (ficha del alojamiento; fotos de los dueños), provisional, con la marca de agua del portal'
    d['fuente'] = f
    d['tratamiento'] = {'giro': round(g, 2) if g is not None else 0, 'balance': gan, 'contraste': 1.04}
    lista.append(d)
    print(nombre, f, d['ancho'], 'x', d['alto'], d['anchos'], 'giro', d['tratamiento']['giro'], 'balance', gan)

for c in COMMONS:
    f = CACHE / (c['nombre'] + '.jpg')
    if not f.exists():
        req = urllib.request.Request(c['miniatura'], headers={'User-Agent': UA})
        f.write_bytes(urllib.request.urlopen(req, timeout=90).read())
        time.sleep(1)
    im = Image.open(f)
    d = guardar(c['nombre'], im, [480, 800])
    d['origen'] = 'Wikimedia Commons'
    lista.append(d)
    print(c['nombre'], d['ancho'], 'x', d['alto'], d['anchos'])

(SAL / 'fotos.json').write_text(json.dumps(lista, ensure_ascii=False, indent=1), encoding='utf-8')
# lo que ya no sale de aquí (fotos de una versión anterior) se borra, para que no viaje nada que no se use
vivos = {f'{d["nombre"]}-{w}.{e}' for d in lista for w in d['anchos'] for e in ('webp', 'jpg')} | {'fotos.json'}
for p in SAL.iterdir():
    if p.name not in vivos:
        p.unlink(); print('  fuera', p.name)
print('→ img/fotos/fotos.json')
