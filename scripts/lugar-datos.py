# «El alba, hoy» · datos del 3D de Apartamentos rurales Alba (Caunedo, Somiedo).
#
# Fuentes (todas abiertas):
#   - MDT05, MDT25 y MDT200 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt)            CC BY 4.0, © IGN
#     (las teselas ya las bajó scripts/lugar-horizonte.py a ref/raw/lugar-cache/)
#   - Ortofoto PNOA por WMS (www.ign.es/wms-inspire/pnoa-ma) y WMTS (www.ign.es/wmts/pnoa-ma) CC BY 4.0, © IGN
#   - Edificios del Catastro INSPIRE (ovc.catastro.meh.es, WFS BU)                          © Dirección General del Catastro
#   - Pueblos y cumbres de OpenStreetMap (scripts/lugar-osm.py)                             ODbL, © colaboradores de OSM
# Salida: img/lugar/ (alturas en PNG y ortofotos en WebP) y data/lugar-escena.json (la escena).
#
# Coordenadas locales en metros desde el centro de la casa (data/lugar.json): x al este, z al sur, y arriba
# (altura sobre el nivel del mar del MDT MENOS la caída por la curvatura de la Tierra, r²/(2·R/(1−0,13)): así la
# escena es un plano tangente en la casa y el sol de Alba.sol vale tal cual en toda ella; a 6 km son 2,4 m).
# Alturas en PNG RGB: (R*256 + G) / 10 − 100 = metros.
#
# Uso: python -I -X utf8 scripts/lugar-datos.py     (antes: lugar-osm.py y lugar-horizonte.py)
import io, json, math, pathlib, re, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
OUT = R / 'img' / 'lugar'; OUT.mkdir(parents=True, exist_ok=True)
DATA = R / 'data'
UA = {'User-Agent': 'datos-mapa-script/1.0 (uso puntual)'}       # sin datos personales

LJ = json.loads((DATA / 'lugar.json').read_text(encoding='utf-8'))
HZ = json.loads((DATA / 'lugar-horizonte.json').read_text(encoding='utf-8'))
CASA = (LJ['lat'], LJ['lon'])
KX = 111320 * math.cos(math.radians(CASA[0])); KZ = 110950
R_EF = 6371008.8 / (1 - 0.13)
def loc(lat, lon): return ((np.asarray(lon) - CASA[1]) * KX, (CASA[0] - np.asarray(lat)) * KZ)
def geo(x, z): return (CASA[0] - np.asarray(z) / KZ, CASA[1] + np.asarray(x) / KX)
def caida(x, z): return (np.asarray(x) ** 2 + np.asarray(z) ** 2) / (2 * R_EF)

VALLE = 6000.0          # caja del valle: ±6 km (relieve a 20 m, ortofoto a ~4,7 m/px)
CERCA = 600.0           # caja de la casa: ±600 m (relieve a 4 m, ortofoto a ~0,6 m/px)
LEJOS = 32000.0         # anillo lejano: ±32 km (relieve a 250 m)
PLANO = 3000.0          # el plano del plan B: ±3 km


def bajar(url, destino, intentos=5):
    if destino.exists() and destino.stat().st_size > 2000:
        return destino.read_bytes()
    for k in range(intentos):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
            if len(b) < 2000 and b'<' in b[:200]:
                raise IOError(b[:120])
            destino.write_bytes(b); print('bajado', destino.name, len(b) // 1024, 'KB'); return b
        except Exception as e:
            print('falla', destino.name, str(e)[:90]); time.sleep(3 + 4 * k)
    raise SystemExit('No se pudo bajar ' + destino.name)


class Raster:
    def __init__(self, f):
        t = tifffile.TiffFile(f); p = t.pages[0]
        self.a = p.asarray().astype(np.float32)
        sx, sy = p.tags['ModelPixelScaleTag'].value[:2]
        tp = p.tags['ModelTiepointTag'].value
        self.O, self.N = tp[3], tp[4]; self.sx, self.sy = sx, sy
        self.E = self.O + sx * self.a.shape[1]; self.S = self.N - sy * self.a.shape[0]
        self.a[self.a < -100] = np.nan
        t.close()

    def dentro(self, lat, lon, margen=2):
        return ((lat > self.S + margen * self.sy) & (lat < self.N - margen * self.sy) &
                (lon > self.O + margen * self.sx) & (lon < self.E - margen * self.sx))

    def muestrea(self, lat, lon, orden=1):
        fil = (self.N - lat) / self.sy - 0.5; col = (lon - self.O) / self.sx - 0.5
        return ndimage.map_coordinates(self.a, [fil, col], order=orden, mode='nearest', prefilter=False)


CAPAS = [[Raster(f) for f in sorted(CACHE.glob(p))] for p in ('mdt5-*.tif', 'mdt25-*.tif', 'mdt200.tif')]
assert all(CAPAS), 'faltan teselas del MDT: antes, scripts/lugar-horizonte.py'


def altura_geo(lat, lon):
    lat = np.asarray(lat, np.float64).ravel(); lon = np.asarray(lon, np.float64).ravel()
    h = np.full(lat.shape, np.nan)
    for capa in CAPAS:
        for r in capa:
            pend = np.isnan(h)
            if not pend.any():
                return h
            m = pend & r.dentro(lat, lon)
            if m.any():
                h[m] = r.muestrea(lat[m], lon[m])
    return h


def alt_xz(x, z):
    """Altura de la escena (MDT − caída por curvatura) en metros locales."""
    x = np.asarray(x, np.float64); z = np.asarray(z, np.float64)
    la, lo = geo(x, z)
    return (altura_geo(la, lo).reshape(x.shape) - caida(x, z))


def png_alturas(h, nombre, paso=0.1):
    # paso: precisión guardada (0,5 m en el valle y lejos: el MDT viene en metros enteros y así el PNG pesa la mitad)
    h = np.round(h / paso) * paso
    v = np.clip(np.round((h + 100.0) * 10), 0, 65535).astype(np.uint16)
    rgb = np.stack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), np.zeros_like(v, np.uint8)], -1)
    Image.fromarray(rgb, 'RGB').save(OUT / nombre, optimize=True)


def rejilla(lado, paso):
    n = int(round(2 * lado / paso)) + 1
    xs = np.linspace(-lado, lado, n)
    X, Z = np.meshgrid(xs, xs)
    return X, Z, n


# ------------------------------------------------------------------ alturas
rasters = {}
for nombre, lado, paso in (('valle', VALLE, 20.0), ('cerca', CERCA, 4.0), ('lejos', LEJOS, 250.0)):
    X, Z, n = rejilla(lado, paso)
    h = alt_xz(X, Z)
    if nombre == 'lejos':
        h = ndimage.gaussian_filter(h, 0.6)
    png_alturas(h, f'alturas-{nombre}.png', 0.1 if nombre == 'cerca' else 0.5)
    rasters[nombre] = {'x0': -lado, 'z0': -lado, 'x1': lado, 'z1': lado, 'w': n, 'h': n, 'archivo': f'alturas-{nombre}.png'}
    if nombre == 'lejos':                         # el hueco donde va el valle (en celdas, con una de solape)
        a = int(math.floor((LEJOS - VALLE) / paso)) + 1; b = n - 1 - a
        rasters[nombre]['hueco'] = [a, a, b, b]
    print('alturas', nombre, n, 'x', n, f'{np.nanmin(h):.0f}-{np.nanmax(h):.0f} m')
H_CASA = float(alt_xz(np.array([0.0]), np.array([0.0]))[0])
print('casa en la escena:', round(H_CASA, 2), 'm')


# ------------------------------------------------------------------ ortofotos
def wms(S, O, N, E, w, h, nombre):
    url = ('https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage'
           f'&STYLES=&CRS=EPSG:4326&BBOX={S},{O},{N},{E}&WIDTH={w}&HEIGHT={h}&FORMAT=image/jpeg')
    return Image.open(io.BytesIO(bajar(url, CACHE / nombre))).convert('RGB')


def mosaico(S, O, N, E, W, H, nx, ny, base):
    f = CACHE / (base + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    im = Image.new('RGB', (W, H))
    for i in range(nx):
        for j in range(ny):
            o, e = O + (E - O) * i / nx, O + (E - O) * (i + 1) / nx
            n, s = N - (N - S) * j / ny, N - (N - S) * (j + 1) / ny
            im.paste(wms(s, o, n, e, W // nx, H // ny, f'{base}-{i}{j}.jpg'), (i * W // nx, j * H // ny))
    im.save(f); return im


def wmts_caja(S, O, N, E, zoom, W, H, nombre):
    f = CACHE / (nombre + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    n = 2 ** zoom
    tx = lambda lon: (np.asarray(lon, np.float64) + 180) / 360 * n
    ty = lambda lat: (1 - np.arcsinh(np.tan(np.radians(np.asarray(lat, np.float64)))) / np.pi) / 2 * n
    x0, x1, y0, y1 = tx(O), tx(E), ty(N), ty(S)
    cols = range(int(x0), int(x1) + 1); filas = range(int(y0), int(y1) + 1)
    lienzo = Image.new('RGB', (len(cols) * 256, len(filas) * 256))
    tdir = CACHE / f'wmts{zoom}'; tdir.mkdir(exist_ok=True)
    for i, c in enumerate(cols):
        for j, r in enumerate(filas):
            url = ('https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible'
                   f'&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={zoom}&TileCol={c}&TileRow={r}')
            lienzo.paste(Image.open(io.BytesIO(bajar(url, tdir / f'{c}-{r}.jpg'))).convert('RGB'), (i * 256, j * 256))
    a = np.asarray(lienzo, np.float32)
    lat = N - (np.arange(H) + 0.5) / H * (N - S); lon = O + (np.arange(W) + 0.5) / W * (E - O)
    py = (ty(lat) - int(y0)) * 256 - 0.5; px = (tx(lon) - int(x0)) * 256 - 0.5
    PY, PX = np.meshgrid(py, px, indexing='ij')
    out = np.stack([ndimage.map_coordinates(a[..., k], [PY, PX], order=1) for k in range(3)], -1)
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); im.save(f); return im


def caja_ll(lado):
    n, o = geo(-lado, -lado); s, e = geo(lado, lado)
    return float(s), float(o), float(n), float(e)


def gradua(img, ref_img):
    a = np.asarray(img, np.float32); b = np.asarray(ref_img, np.float32)
    out = (a - a.reshape(-1, 3).mean(0)) / (a.reshape(-1, 3).std(0) + 1e-3) * b.reshape(-1, 3).std(0) + b.reshape(-1, 3).mean(0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


S, O, N, E = caja_ll(VALLE)
orto_v = mosaico(S, O, N, E, 2560, 2560, 2, 2, 'pnoa-valle')
S, O, N, E = caja_ll(CERCA)
orto_c = wmts_caja(S, O, N, E, 18, 2048, 2048, 'pnoa-cerca-z18')
S, O, N, E = caja_ll(LEJOS)
orto_l = wms(S, O, N, E, 1600, 1600, 'pnoa-lejos.jpg')
print('ortofotos', orto_v.size, orto_c.size, orto_l.size)


# ------------------------------------------------------------------ Catastro: la casa y el pueblo
def wfs_bu(tipo, S, O, N, E, nombre):
    url = (f'https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=WFS&version=2.0.0&request=GetFeature'
           f'&typenames={tipo}&srsname=EPSG::4258&bbox={S},{O},{N},{E}')
    return bajar(url, CACHE / nombre).decode('latin-1')


def poligonos(xml, patron_id):
    out = []
    for m in re.finditer(r'<(?:gml:featureMember|wfs:member|member)>(.*?)</(?:gml:featureMember|wfs:member|member)>', xml, re.S):
        f = m.group(1)
        lid = re.search(patron_id, f)
        pis = re.search(r'numberOfFloorsAboveGround>(\d+)', f); baj = re.search(r'numberOfFloorsBelowGround>(\d+)', f)
        anillos = []
        for pl in re.findall(r'<gml:posList[^>]*>([^<]+)</gml:posList>', f):
            v = list(map(float, pl.split()))
            anillos.append([(v[i], v[i + 1]) for i in range(0, len(v), 2)])
        out.append({'id': lid.group(1) if lid else '?', 'pisos': int(pis.group(1)) if pis else None,
                    'bajo': int(baj.group(1)) if baj else 0, 'anillos': anillos})
    return out


def area(pts):
    return 0.5 * abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts))))


def rect_orientado(pts):
    P = np.array(pts); mejor = None
    for g in np.radians(np.arange(0, 90, 0.5)):
        c, s = math.cos(g), math.sin(g)
        u = P[:, 0] * c + P[:, 1] * s; v = -P[:, 0] * s + P[:, 1] * c
        a = (u.max() - u.min()) * (v.max() - v.min())
        if mejor is None or a < mejor[0]:
            mejor = (a, g, (u.max() + u.min()) / 2, (v.max() + v.min()) / 2, u.max() - u.min(), v.max() - v.min())
    a, g, uc, vc, lu, lv = mejor
    c, s = math.cos(g), math.sin(g)
    return {'cx': round(uc * c - vc * s, 2), 'cz': round(uc * s + vc * c, 2), 'lu': round(lu, 2), 'lv': round(lv, 2), 'ang': round(g, 4)}


S, O, N, E = caja_ll(CERCA - 40)
bp = poligonos(wfs_bu('BU:BuildingPart', S, O, N, E, 'bp-cerca.xml'), r'localId>([^<]+)')
print('Catastro: partes de edificio en la caja de la casa:', len(bp))
oc_a = np.asarray(orto_c, np.float32)
CW = orto_c.width


def a_px(x, z):
    return ((np.asarray(x) + CERCA) / (2 * CERCA) * CW, (np.asarray(z) + CERCA) / (2 * CERCA) * CW)


REF_CASA = LJ['catastro']                         # D00110500QH27A: la casa alta (ver LUGAR.md)
VECINA = ('D00110600QH27A', 'D00110700QH27A')     # la casa baja pegada al este (blanca, teja roja; no es Alba)
edificios = []
mascara = Image.new('L', (CW, CW), 0); dm = ImageDraw.Draw(mascara)
for b in bp:
    if not b['anillos']:
        continue
    pts = [tuple(float(t) for t in loc(la, lo)) for la, lo in b['anillos'][0]]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    if area(pts) < 6:
        continue
    c = np.mean(pts, 0)
    if abs(c[0]) > CERCA - 30 or abs(c[1]) > CERCA - 30:
        continue
    ref = b['id'].split('_')[0]
    # el tejado en la ortofoto (desplazado al norte por la perspectiva: se toma el polígono y 2 m al norte)
    mk = Image.new('L', (CW, CW), 0)
    ImageDraw.Draw(mk).polygon([tuple(map(float, a_px(x, z - 1.0))) for x, z in pts], fill=255)
    mkA = ndimage.binary_erosion(np.asarray(mk) > 0, iterations=3)
    col = np.median(oc_a[mkA], 0) if mkA.sum() > 20 else np.array([150, 80, 60], np.float32)
    for dz in (0.0, -1.0, -2.0):                  # para borrar el tejado de la foto (el edificio va en 3D)
        dm.polygon([tuple(map(float, a_px(x + 0, z + dz))) for x, z in pts], fill=255)
    suelo = alt_xz(np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
    tipo = 'alba' if ref == REF_CASA else ('vecina' if ref in VECINA else 'pueblo')
    edificios.append({'id': b['id'], 'tipo': tipo, 'pisos': b['pisos'] or 1, 'bajo': b['bajo'],
                      'anillo': [[round(x, 2), round(z, 2)] for x, z in pts], 'rect': rect_orientado(pts),
                      'suelo': round(float(np.nanmin(suelo)), 2), 'sueloMax': round(float(np.nanmax(suelo)), 2),
                      'tejado': '#%02x%02x%02x' % tuple(int(v) for v in np.clip(col, 0, 255)), 'area': round(area(pts), 1)})
edificios.sort(key=lambda e: ({'alba': 0, 'vecina': 1}.get(e['tipo'], 2), e['id']))
alba = [e for e in edificios if e['tipo'] == 'alba']
print('la casa:', [(e['id'], e['pisos'], e['bajo'], e['area'], e['rect'], e['suelo'], e['sueloMax']) for e in alba])
print('edificios en 3D:', len(edificios))

# la ortofoto de la casa sin tejados (relleno por convolución normalizada) y la del valle sin nada
m = ndimage.binary_dilation(np.asarray(mascara) > 0, iterations=2)
a = oc_a.copy()
peso = (~m).astype(np.float32)
for sigma in (3, 6, 12, 24):
    num = np.stack([ndimage.gaussian_filter(a[..., k] * peso, sigma) for k in range(3)], -1)
    den = ndimage.gaussian_filter(peso, sigma)[..., None]
    rel = num / np.maximum(den, 1e-4)
    hueco = m & (den[..., 0] > 0.15)
    a[hueco] = rel[hueco]; peso = np.maximum(peso, hueco.astype(np.float32)); m = m & ~hueco
orto_c2 = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.4))
orto_c2.save(OUT / 'orto-cerca-2048.webp', quality=72, method=6)
orto_c2.resize((1024, 1024), Image.LANCZOS).save(OUT / 'orto-cerca-1024.webp', quality=76, method=6)
orto_v.save(OUT / 'orto-valle-2560.webp', quality=70, method=6)
orto_v.resize((1280, 1280), Image.LANCZOS).save(OUT / 'orto-valle-1280.webp', quality=74, method=6)
# lejos: graduada al color del valle, algo desaturada (bruma)
i0 = int((LEJOS - VALLE) / (2 * LEJOS) * 1600); i1 = 1600 - i0
olg = np.asarray(gradua(orto_l, orto_v.resize((i1 - i0, i1 - i0))), np.float32)
gris = olg.mean(-1, keepdims=True); olg = gris + (olg - gris) * 0.8
Image.fromarray(np.clip(olg, 0, 255).astype(np.uint8)).save(OUT / 'orto-lejos-1600.webp', quality=68, method=6)
Image.fromarray(np.clip(olg, 0, 255).astype(np.uint8)).resize((800, 800), Image.LANCZOS).save(OUT / 'orto-lejos-800.webp', quality=72, method=6)
# el plano del plan B: el valle ±3 km
k0 = int((VALLE - PLANO) / (2 * VALLE) * 2560); k1 = 2560 - k0
pl = orto_v.crop((k0, k0, k1, k1))
pl.resize((1100, 1100), Image.LANCZOS).save(OUT / 'plano-1100.webp', quality=74, method=6)
pl.resize((720, 720), Image.LANCZOS).save(OUT / 'plano-720.webp', quality=76, method=6)
# sus alturas: todo el valle (±6 km) a 40 m, porque las sombras que caen en el plano vienen de peñas de fuera de él
X, Z, n = rejilla(VALLE, 40.0)
png_alturas(alt_xz(X, Z), 'alturas-plano.png', 0.5)
rasters['plano'] = {'x0': -VALLE, 'z0': -VALLE, 'x1': VALLE, 'z1': VALLE, 'w': n, 'h': n, 'archivo': 'alturas-plano.png'}


# ------------------------------------------------------------------ rótulos (nombres comprobados en OSM)
valle = json.loads((CACHE / 'osm-valle.json').read_text(encoding='utf-8'))['elements']
cimas = json.loads((CACHE / 'osm-cimas.json').read_text(encoding='utf-8'))['elements']
nombres_cima = {c['nombre'] for c in HZ['cimas']} | {c['nombre'] for c in HZ.get('tapadas', [])}
lugares = []


def cumbre_en(lat, lon):
    """Lo más alto en 40 m alrededor del nodo (los nodos de OSM no siempre caen en el pico)."""
    off = np.linspace(-40, 40, 9); OX, OZ = np.meshgrid(off, off)
    x, z = loc(lat, lon)
    hh = alt_xz(x + OX, z + OZ); k = np.nanargmax(hh)
    return float(x + OX.ravel()[k]), float(hh.ravel()[k]), float(z + OZ.ravel()[k])


for e in cimas:
    t = e.get('tags', {})
    if t.get('natural') != 'peak' or 'lat' not in e:
        continue
    x, z = loc(e['lat'], e['lon'])
    if abs(x) > VALLE - 300 or abs(z) > VALLE - 300:
        continue
    importante = t.get('name') in nombres_cima or (t.get('ele') and float(t['ele']) >= 1940)
    if not importante:
        continue
    cx, cy, cz = cumbre_en(e['lat'], e['lon'])
    cota = round(float(altura_geo(*geo(np.array([cx]), np.array([cz])))[0]))
    lugares.append({'clave': 'osm' + str(e['id']), 'tipo': 'cima', 'nombre': t.get('name:es') or t['name'],
                    'sub': f'{cota:,} m'.replace(',', '.'), 'x': round(cx, 1), 'y': round(cy + 6, 1), 'z': round(cz, 1),
                    'enPerfil': t.get('name') in {c['nombre'] for c in HZ['cimas']}, 'osm': e['id']})
for e in valle:
    t = e.get('tags', {})
    if t.get('place') not in ('hamlet', 'village', 'town') or 'lat' not in e:
        continue
    x, z = loc(e['lat'], e['lon'])
    if abs(x) > 4500 or abs(z) > 4500:
        continue
    y = float(alt_xz(np.array([x]), np.array([z]))[0])
    nombre = t.get('name:es') or t['name']
    lugares.append({'clave': 'osm' + str(e['id']), 'tipo': 'casa' if nombre == 'Caunedo' else 'pueblo', 'nombre': nombre,
                    'sub': f'{round(y + caida(x, z)):,} m'.replace(',', '.'), 'x': round(float(x), 1), 'y': round(y + 4, 1),
                    'z': round(float(z), 1), 'osm': e['id']})
# la casa: su propio rótulo (no el nodo del pueblo)
lugares = [l for l in lugares if l['nombre'] != 'Caunedo']
lugares.append({'clave': 'alba', 'tipo': 'alba', 'nombre': 'Alba', 'sub': f"{LJ['cotaCasa']} m · Caunedo", 'x': 0.0,
                'y': round(H_CASA + 11, 1), 'z': 0.0})
print('rótulos:', [(l['nombre'], l['sub']) for l in lugares])

# ------------------------------------------------------------------ el recorrido de la cámara
# De las cumbres al valle y a la casa. [p, posición, a dónde mira]; la holgura sobre el relieve se comprueba abajo.
# La casa: (0, H_CASA, 0). La peña de enfrente (la que da sombra al amanecer) queda al ENE, a 0,3-0,6 km.
def H(x, z): return float(alt_xz(np.array([x]), np.array([z]))[0])


REC = [
    (0.00, (3900, None, 2700), 'sobre 380', (0, H_CASA + 150, 0)),       # sobre Peña Salgada (SE): el portillo del sol de invierno
    (0.22, (2300, None, -300), 'sobre 330', (-200, H_CASA + 60, 300)),   # cruza por encima de la Peña de Gúa, mirando el valle al oeste
    (0.45, (150, None, -3000), 'sobre 420', (-100, H_CASA - 40, -700)),  # sobre la Pola, mirando valle arriba: Gúa abajo y Caunedo al fondo
    (0.68, (-250, None, -620), 'sobre 70', (20, H_CASA + 8, 0)),         # baja por el valle hacia Caunedo
    (0.86, (-75, None, 60), 'sobre 30', (0, H_CASA + 4, 0)),             # rodea el pueblo por el suroeste
    (1.00, (-18, None, 11), 'sobre 1.7', (1, H_CASA + 4.5, -0.5)),       # en la calle, al suroeste: el hastial oeste y la fachada de la escalera
]
recorrido = []
for p, (x, _, z), regla, mira in REC:
    alto = float(regla.split()[1])
    y = H(x, z) + alto
    recorrido.append({'p': p, 'pos': [x, round(y, 1), z], 'mira': [round(v, 1) for v in mira]})


def holgura(rec, n=3000):
    """Holgura mínima de la cámara sobre el relieve, con la misma interpolación que lugar.js (monótona)."""
    ps = [r['p'] for r in rec]

    def mono(vs):
        k = len(ps); d = [(vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]) for i in range(k - 1)]; mm = [0.0] * k
        for i in range(1, k - 1):
            if d[i - 1] * d[i] <= 0:
                continue
            h0, h1 = ps[i] - ps[i - 1], ps[i + 1] - ps[i]
            mm[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i])

        def f(p):
            if p <= ps[0]: return vs[0]
            if p >= ps[-1]: return vs[-1]
            j = 0
            while j < k - 2 and p > ps[j + 1]: j += 1
            h = ps[j + 1] - ps[j]; t = (p - ps[j]) / h
            return (2 * t**3 - 3 * t**2 + 1) * vs[j] + (t**3 - 2 * t**2 + t) * h * mm[j] + (-2 * t**3 + 3 * t**2) * vs[j + 1] + (t**3 - t**2) * h * mm[j + 1]
        return f
    fx, fy, fz = (mono([r['pos'][i] for r in rec]) for i in range(3))
    P = np.linspace(0, 1, n)
    xs = np.array([fx(p) for p in P]); ys = np.array([fy(p) for p in P]); zs = np.array([fz(p) for p in P])
    g = alt_xz(xs, zs)
    return ys - g, P, xs, zs


for vuelta in range(6):
    hol, P, xs, zs = holgura(recorrido)
    malo = hol < np.where(P > 0.95, 1.2, np.where(P > 0.8, 10, 40))
    if not malo.any():
        break
    k = int(np.argmin(hol - np.where(P > 0.95, 1.2, np.where(P > 0.8, 10, 40))))
    j = min(range(len(recorrido)), key=lambda i: abs(recorrido[i]['p'] - P[k]))
    recorrido[j]['pos'][1] = round(recorrido[j]['pos'][1] + 25, 1)
    print('  sube el punto', j, 'por la holgura en p =', round(float(P[k]), 3), round(float(hol[k]), 1), 'm')
hol, P, xs, zs = holgura(recorrido)
print('holgura mínima de la cámara:', round(float(hol[P < 0.8].min()), 1), 'm (hasta 0,8) ·', round(float(hol[P >= 0.8].min()), 1), 'm (final)')

# la cámara final no puede caer dentro ni pegada a un edificio
def dentro_pol(x, z, an):
    c = False
    for i in range(len(an)):
        (x1, z1), (x2, z2) = an[i], an[i - 1]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            c = not c
    return c


fx, fz = recorrido[-1]['pos'][0], recorrido[-1]['pos'][2]
cerca_edif = min(min(math.hypot(fx - x, fz - z) for x, z in e['anillo']) for e in edificios)
assert not any(dentro_pol(fx, fz, e['anillo']) for e in edificios), 'la cámara final cae dentro de un edificio'
print('cámara final: a', round(cerca_edif, 1), 'm del vértice de edificio más cercano')

PARADAS = [
    {'desde': 0.0, 't': 'Desde las cumbres', 'd': 'Peña Salgada y el Altu Putracón, a casi 2.000 m. Por el portillo entre las dos entra el sol de invierno.'},
    {'desde': 0.22, 't': 'La sombra de las peñas', 'd': 'Por la mañana, las peñas del este tapan el sol al valle; la línea de luz baja despacio por la ladera de enfrente.'},
    {'desde': 0.45, 't': 'El valle', 'd': 'Desde encima de la Pola: abajo Gúa y, al fondo, Caunedo. El valle se abre al norte y se cierra en peñas por los otros tres lados.'},
    {'desde': 0.68, 't': 'Caunedo', 'd': 'La casa está en la parte alta del pueblo, a 960 m, con la peña encima.'},
    {'desde': 0.86, 't': 'La casa', 'd': 'Piedra abajo, blanco arriba, teja roja y la escalera de madera. Aquí es donde el sol «entra».'},
]

escena = {
    'casa': {'x': 0, 'z': 0, 'y': round(H_CASA, 2), 'cota': LJ['cotaCasa'], 'catastro': REF_CASA},
    'rasters': rasters,
    'orto': {
        'valle': {'x0': -VALLE, 'z0': -VALLE, 'x1': VALLE, 'z1': VALLE, 'archivos': {'alta': 'orto-valle-2560.webp', 'baja': 'orto-valle-1280.webp'}},
        'cerca': {'x0': -CERCA, 'z0': -CERCA, 'x1': CERCA, 'z1': CERCA, 'archivos': {'alta': 'orto-cerca-2048.webp', 'baja': 'orto-cerca-1024.webp'}},
        'lejos': {'x0': -LEJOS, 'z0': -LEJOS, 'x1': LEJOS, 'z1': LEJOS, 'archivos': {'alta': 'orto-lejos-1600.webp', 'baja': 'orto-lejos-800.webp'}},
        'plano': {'x0': -PLANO, 'z0': -PLANO, 'x1': PLANO, 'z1': PLANO, 'archivos': {'alta': 'plano-1100.webp', 'baja': 'plano-720.webp'}},
    },
    'edificios': edificios,
    'lugares': lugares,
    'recorrido': recorrido,
    'paradas': PARADAS,
    'curvatura': {'rEfectivo': round(R_EF), 'nota': 'y = MDT − (x² + z²) / (2·rEfectivo): plano tangente en la casa'},
    'fuente': 'scripts/lugar-datos.py (agente Lugar 3D)', 'fecha': time.strftime('%Y-%m-%d'),
}
(DATA / 'lugar-escena.json').write_text(json.dumps(escena, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('escrito data/lugar-escena.json', (DATA / 'lugar-escena.json').stat().st_size // 1024, 'KB')
tot = 0
for f in sorted(OUT.iterdir()):
    tot += f.stat().st_size; print(f'  {f.name:<24} {f.stat().st_size // 1024:>5} KB')
print('img/lugar/:', tot // 1024, 'KB')
