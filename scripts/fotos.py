# Fotos publicables → img/fotos/<nombre>-<ancho>.{webp,jpg} + img/fotos/fotos.json. NUNCA se amplía.
#   python -I -X utf8 scripts/fotos.py
# - Las 5 de Sensación Rural (ref/origen/portales/sr-*.webp, 750 px, sin marca de agua): a su tamaño y a 480.
#   Las de EuroWeb Media (ref/origen/album, galeria, marca), EscapadaRural y TusCasasRurales NO se publican.
# - Paisaje de Wikimedia Commons (licencia comprobada una a una en scripts/commons.json): se baja la miniatura de
#   1280 px de Commons (User-Agent genérico) y se sirve a 480 y 800. Créditos en el pie (construir.mjs).
import json, time, urllib.request
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SAL = RAIZ / 'img/fotos'
SAL.mkdir(parents=True, exist_ok=True)
CACHE = RAIZ / 'ref/raw/commons-cache'
CACHE.mkdir(parents=True, exist_ok=True)
UA = 'maqueta-web-local/1.0 (prueba de maqueta sin publicar)'

SR = {
    'casa-escalera': 'sr-apartamentos-rurales-alba-somiedo-137894.webp',
    'bano-hidromasaje': 'sr-apartamentos-rurales-alba-somiedo-137895.webp',
    'dormitorio-verde': 'sr-apartamentos-rurales-alba-somiedo-137896.webp',
    'bano-ventana': 'sr-apartamentos-rurales-alba-somiedo-137897.webp',
    'casa-fachada': 'sr-apartamentos-rurales-alba-somiedo-137898.webp',
}
COMMONS = json.loads((RAIZ / 'scripts/commons.json').read_text(encoding='utf-8'))

lista = []

def guardar(nombre, im, anchos):
    im = im.convert('RGB')
    w0, h0 = im.size
    hechos = []
    for w in sorted(set(min(a, w0) for a in anchos)):
        h = round(h0 * w / w0)
        r = im if w == w0 else im.resize((w, h), Image.LANCZOS)
        r.save(SAL / f'{nombre}-{w}.webp', 'WEBP', quality=80, method=6)
        r.save(SAL / f'{nombre}-{w}.jpg', 'JPEG', quality=82, optimize=True, progressive=True)
        hechos.append(w)
    return {'nombre': nombre, 'ancho': w0, 'alto': h0, 'anchos': hechos}

for nombre, f in SR.items():
    im = Image.open(RAIZ / 'ref/origen/portales' / f)
    d = guardar(nombre, im, [480, im.size[0]])
    d['origen'] = 'Sensación Rural (ficha del alojamiento), sin marca de agua'
    lista.append(d)
    print(nombre, d['ancho'], 'x', d['alto'], d['anchos'])

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
print('→ img/fotos/fotos.json')
