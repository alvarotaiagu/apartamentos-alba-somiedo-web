# Relieve REAL del IGN para la web (no para el 3D, que es de Lugar 3D):
#   - data/horizonte-provisional.json: el horizonte desde la casa (mismo esquema que data/lugar-horizonte.json de Lugar),
#     solo para trabajar mientras Lugar no entrega el suyo. La web usa SIEMPRE el de Lugar si existe.
#   - data/portada.json: el perfil de las peñas en CAPAS por distancia (lo que se ve desde la casa, de lejos a cerca)
#     para el dibujo de la portada, y las cimas con nombre (OSM) que asoman en el horizonte.
#   - img/relieve/somiedo.webp y img/relieve/asturias.webp: sombreado del relieve (gris 128 = llano) para el mapa de
#     «A cuánto queda», que se funde con el fondo (mix-blend-mode: soft-light) en los cuatro estados de luz.
#   - data/distancias.json: el mapa (rutas proyectadas y simplificadas) y el PERFIL DE ALTURA de cada ruta de
#     ref/raw/rutas.json (OSRM), medido sobre el MDT.
# Fuentes: MDT25 y MDT200 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt), CC BY 4.0 «© Instituto Geográfico
# Nacional»; cimas de OpenStreetMap (Overpass), ODbL. User-Agent genérico, sin datos personales.
#   python -I -X utf8 scripts/relieve.py
import json, math, os, sys, time, urllib.request, urllib.parse
from pathlib import Path
import numpy as np
import tifffile
from PIL import Image
from scipy import ndimage

RAIZ = Path(__file__).resolve().parent.parent
CACHE = RAIZ / 'ref/raw/relieve-cache'
CACHE.mkdir(parents=True, exist_ok=True)
UA = 'datos-mapa-script/1.0 (uso puntual)'

rutas = json.loads((RAIZ / 'ref/raw/rutas.json').read_text(encoding='utf-8'))
CASA = rutas['casa']
LAT0, LON0 = CASA['lat'], CASA['lon']
ALTURA_OJO = 1.6   # a la altura de una persona delante de la casa


def bajar(url, f):
    if f.exists() and f.stat().st_size > 1000:
        return
    for i in range(5):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            if len(data) > 1000:
                f.write_bytes(data)
                return
        except Exception as e:
            print('  reintento', i, e)
        time.sleep(3 * (i + 1))
    raise SystemExit('no baja ' + url)


def wcs(cov, S, N, O, E, nombre):
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    f = CACHE / nombre
    bajar(url, f)
    with tifffile.TiffFile(f) as t:
        a = t.pages[0].asarray().astype(np.float32)
        tags = t.pages[0].tags
        escala = tags['ModelPixelScaleTag'].value
        tie = tags['ModelTiepointTag'].value
    # EPSG:4258 en GeoTIFF: X = longitud, Y = latitud; el punto de anclaje es la esquina de arriba a la izquierda
    lon0, lat0 = tie[3], tie[4]
    dlon, dlat = escala[0], escala[1]
    a[a < -1000] = np.nan
    return {'z': a, 'lon0': lon0, 'lat0': lat0, 'dlon': dlon, 'dlat': dlat,
            'S': lat0 - a.shape[0] * dlat, 'N': lat0, 'O': lon0, 'E': lon0 + a.shape[1] * dlon}


def muestrear(M, lat, lon):
    """Altura bilineal en (lat, lon) (arrays). NaN fuera."""
    fy = (M['lat0'] - lat) / M['dlat'] - 0.5
    fx = (lon - M['lon0']) / M['dlon'] - 0.5
    return ndimage.map_coordinates(np.nan_to_num(M['z'], nan=0.0), [np.atleast_1d(fy), np.atleast_1d(fx)], order=1, mode='nearest')


print('MDT25 (horizonte, portada y mapa de Somiedo)…')
M25 = wcs('Elevacion4258_25', 42.80, 43.34, -6.64, -5.88, 'mdt25.tif')
print('  ', M25['z'].shape, 'paso', round(M25['dlat'] * 111000, 1), 'm')
print('MDT200 (mapa grande: Oviedo, León y el aeropuerto)…')
M200 = wcs('Elevacion4258_200', 42.48, 43.68, -6.80, -5.35, 'mdt200.tif')
print('  ', M200['z'].shape)

cota = float(muestrear(M25, np.array([LAT0]), np.array([LON0]))[0])
print('cota de la casa en el MDT25:', round(cota, 1), 'm')

# ---------------------------------------------------------------- horizonte por azimut (cada 0,5°)
R_T = 6371000.0
K_REFR = 0.13
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110574
paso = 20.0
dist = np.arange(40.0, 32000.0, paso)               # de 40 m a 32 km
AZ = np.arange(0, 360, 0.5)
ojo = cota + ALTURA_OJO
ang = np.empty((AZ.size, dist.size), np.float32)
for i, a in enumerate(AZ):
    r = math.radians(a)
    lat = LAT0 + dist * math.cos(r) / KY
    lon = LON0 + dist * math.sin(r) / KX
    z = muestrear(M25, lat, lon)
    caida = dist ** 2 * (1 - K_REFR) / (2 * R_T)     # curvatura de la Tierra con refracción
    ang[i] = np.degrees(np.arctan2(z - caida - ojo, dist))
hmax = ang.max(axis=1)
imax = ang.argmax(axis=1)
dmax = dist[imax] / 1000

def a360(v):   # de cada 0,5° a cada 1° (el máximo de los dos)
    return [round(float(max(v[2 * k], v[2 * k + 1])), 2) for k in range(360)]
hor360 = a360(hmax)
dist360 = [round(float(dmax[2 * k] if hmax[2 * k] >= hmax[2 * k + 1] else dmax[2 * k + 1]), 2) for k in range(360)]

# ---------------------------------------------------------------- capas para la portada: de lejos a cerca
# Cada capa es el borde de lo que se ve a partir de cierta distancia: lo que queda más cerca tapa lo de detrás.
BANDAS = [(9000, 32000), (4000, 9000), (1800, 4000), (40, 1800)]
capas = []
for d0, d1 in BANDAS:
    m = (dist >= d0) & (dist < d1)
    v = ang[:, m].max(axis=1)
    capas.append({'desde': d0, 'hasta': d1, 'perfil': [round(float(x), 2) for x in v]})

# ---------------------------------------------------------------- cimas con nombre que asoman en el horizonte (OSM)
def overpass(q):
    for url in ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']:
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            print('  overpass', url, e)
            time.sleep(3)
    raise SystemExit('Overpass no responde')

fpicos = CACHE / 'picos.json'
if not fpicos.exists():
    j = overpass(f'[out:json][timeout:60];node(around:20000,{LAT0},{LON0})["natural"~"peak|saddle"]["name"];out;')
    fpicos.write_text(json.dumps(j), encoding='utf-8')
picos = json.loads(fpicos.read_text(encoding='utf-8'))['elements']
cimas = []
for p in picos:
    dx = (p['lon'] - LON0) * KX; dy = (p['lat'] - LAT0) * KY
    d = math.hypot(dx, dy)
    if d < 300:
        continue
    az = (math.degrees(math.atan2(dx, dy)) + 360) % 360
    zp = float(muestrear(M25, np.array([p['lat']]), np.array([p['lon']]))[0])
    caida = d ** 2 * (1 - K_REFR) / (2 * R_T)
    alt = math.degrees(math.atan2(zp - caida - ojo, d))
    k = int(round(az * 2)) % 720
    # ¿asoma? su ángulo llega al horizonte de ese rumbo (con 0,35° de holgura por el redondeo del MDT y del punto)
    if alt >= hmax[k] - 0.35:
        cimas.append({'nombre': p['tags']['name'], 'tipo': p['tags'].get('natural'), 'azimut': round(az, 1), 'altura': round(alt, 2),
                      'cota': round(zp), 'cotaOsm': int(float(p['tags']['ele'])) if p['tags'].get('ele', '').replace('.', '').isdigit() else None,
                      'distanciaKm': round(d / 1000, 2), 'osm': f"node/{p['id']}"})
cimas.sort(key=lambda c: c['azimut'])
print('cimas en el horizonte:', [(c['nombre'], c['azimut'], c['altura'], c['cota']) for c in cimas])

hz = {'lat': LAT0, 'lon': LON0, 'cota': round(cota, 1), 'alturaOjo': ALTURA_OJO, 'horizonte': hor360, 'distanciaKm': dist360,
      'cimas': [{k: c[k] for k in ('nombre', 'azimut', 'altura', 'cota', 'distanciaKm')} for c in cimas if c['tipo'] == 'peak'],
      'fuente': 'PROVISIONAL de la web (scripts/relieve.py): MDT25 del IGN (CC BY 4.0), paso 20 m hasta 32 km, curvatura con refracción 0,13. La web usa data/lugar-horizonte.json (Lugar 3D) si existe.'}
(RAIZ / 'data').mkdir(exist_ok=True)
(RAIZ / 'data/horizonte-provisional.json').write_text(json.dumps(hz, ensure_ascii=False), encoding='utf-8')

portada = {'fuente': 'MDT25 del IGN (CC BY 4.0) · cimas: OpenStreetMap (ODbL)', 'cota': round(cota, 1), 'paso': 0.5,
           'capas': capas, 'cimas': cimas}
(RAIZ / 'data/portada.json').write_text(json.dumps(portada, ensure_ascii=False), encoding='utf-8')
print('horizonte: mín', min(hor360), 'máx', max(hor360), 'en', hor360.index(max(hor360)), '°')

# ---------------------------------------------------------------- sombreado del relieve (gris 128 = llano)
def sombreado(M, S, N, O, E, ancho, f, exag=1.0):
    alto = int(round(ancho * ((N - S) * KY) / ((E - O) * KX)))
    lat = N - (np.arange(alto) + 0.5) / alto * (N - S)
    lon = O + (np.arange(ancho) + 0.5) / ancho * (E - O)
    LA, LO = np.meshgrid(lat, lon, indexing='ij')
    z = muestrear(M, LA.ravel(), LO.ravel()).reshape(alto, ancho)
    px = (E - O) * KX / ancho; py = (N - S) * KY / alto
    gy, gx = np.gradient(z * exag, py, px)
    # luz del noroeste a 45° (la convención de los mapas)
    az, el = math.radians(315), math.radians(45)
    pend = np.arctan(np.hypot(gx, gy))
    asp = np.arctan2(-gx, gy)
    luz = np.sin(el) * np.cos(pend) + np.cos(el) * np.sin(pend) * np.cos(az - asp)
    plano = math.sin(el)
    g = 128 + (luz - plano) * 150
    g = np.clip(g, 18, 238).astype(np.uint8)
    (RAIZ / 'img/relieve').mkdir(parents=True, exist_ok=True)
    Image.fromarray(g, 'L').save(RAIZ / f, 'WEBP', quality=72, method=6)
    print(' ', f, ancho, 'x', alto, os.path.getsize(RAIZ / f) // 1024, 'KB')
    return {'S': S, 'N': N, 'O': O, 'E': E, 'ancho': ancho, 'alto': alto}

def P(lon, lat):
    return [(lon - LON0) * KX, -(lat - LAT0) * KY]

CERCA = (42.995, 43.300, -6.420, -6.040)
LEJOS = (42.520, 43.640, -6.760, -5.400)
cajaC = sombreado(M25, *CERCA, 1100, 'img/relieve/somiedo.webp', exag=1.0)
cajaL = sombreado(M200, *LEJOS, 760, 'img/relieve/asturias.webp', exag=1.6)

# ---------------------------------------------------------------- rutas: geometría en metros y perfil de altura
def simplificar(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        mx, im = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            t = ((px - ax) * dx + (py - ay) * dy) / L if L else 0
            t = max(0, min(1, t))
            ex, ey = ax + t * dx - px, ay + t * dy - py
            d = ex * ex + ey * ey
            if d > mx:
                mx, im = d, i
        if mx > tol * tol:
            keep[im] = True; pila.append((a, im)); pila.append((im, b))
    return [p for p, k in zip(pts, keep) if k]

def camino(pts):
    s = 'M%d %d' % (round(pts[0][0]), round(pts[0][1]))
    px, py = round(pts[0][0]), round(pts[0][1])
    for x, y in pts[1:]:
        x, y = round(x), round(y)
        if x == px and y == py:
            continue
        s += 'l%d %d' % (x - px, y - py); px, py = x, y
    return s.replace(' -', '-')

def perfil(geo):
    """Alturas a lo largo de la ruta: cada ~40 m sobre el MDT25 (o el MDT200 fuera de su caja)."""
    lon = np.array([g[0] for g in geo]); lat = np.array([g[1] for g in geo])
    x = (lon - LON0) * KX; y = (lat - LAT0) * KY
    seg = np.hypot(np.diff(x), np.diff(y)); acum = np.concatenate([[0], np.cumsum(seg)])
    total = acum[-1]
    n = int(max(2, min(4000, total // 40)))
    s = np.linspace(0, total, n)
    la = np.interp(s, acum, lat); lo = np.interp(s, acum, lon)
    dentro = (la > M25['S'] + 0.002) & (la < M25['N'] - 0.002) & (lo > M25['O'] + 0.002) & (lo < M25['E'] - 0.002)
    z = np.where(dentro, muestrear(M25, la, lo), muestrear(M200, la, lo))
    z = ndimage.uniform_filter1d(z, 3)
    subida = float(np.clip(np.diff(z), 0, None).sum()); bajada = float(np.clip(-np.diff(z), 0, None).sum())
    # para el dibujo, como mucho 140 puntos
    k = np.linspace(0, n - 1, min(n, 140)).round().astype(int)
    return {'km': [round(float(v) / 1000, 3) for v in s[k]], 'm': [round(float(v)) for v in z[k]],
            'min': round(float(z.min())), 'max': round(float(z.max())), 'sube': round(subida), 'baja': round(bajada),
            'fin': round(float(z[-1])), 'mdt': 'MDT25' if dentro.all() else 'MDT25 y MDT200'}

def tramo(t):
    if not t:
        return None
    pts = [P(lo, la) for lo, la in t['geometria']]
    tol = 6 if t['km'] < 30 else 40
    return {'km': t['km'], 'minutos': t['minutos'], 'carreteras': t.get('carreteras', []), 'desde': t.get('desde'),
            'd': camino(simplificar(pts, tol)), 'perfil': perfil(t['geometria'])}

mapa = {'fuente': 'Rutas: OSRM sobre OpenStreetMap (ODbL). Relieve y alturas: MDT25 y MDT200 del IGN (CC BY 4.0).',
        'fecha': rutas['fecha'], 'casa': {'lat': LAT0, 'lon': LON0, 'cota': round(cota)},
        'relieve': {'cerca': dict(zip(('x', 'y'), P(CERCA[2], CERCA[1]))) | {'w': (CERCA[3] - CERCA[2]) * KX, 'h': (CERCA[1] - CERCA[0]) * KY, 'src': 'img/relieve/somiedo.webp'},
                    'lejos': dict(zip(('x', 'y'), P(LEJOS[2], LEJOS[1]))) | {'w': (LEJOS[3] - LEJOS[2]) * KX, 'h': (LEJOS[1] - LEJOS[0]) * KY, 'src': 'img/relieve/asturias.webp'}},
        'orden': rutas['orden'], 'sitios': {}}
for k in ('cerca', 'lejos'):
    for c in ('x', 'y', 'w', 'h'):
        mapa['relieve'][k][c] = round(mapa['relieve'][k][c])
for sid in rutas['orden']:
    s = rutas['sitios'][sid]
    if 'lat' not in s:
        continue
    zp = float(muestrear(M25 if (M25['S'] < s['lat'] < M25['N'] and M25['O'] < s['lon'] < M25['E']) else M200, np.array([s['lat']]), np.array([s['lon']]))[0])
    o = {'nombre': s['nombre'], 'tipo': s['tipo'], 'grupo': s['grupo'], 'xy': [round(v) for v in P(s['lon'], s['lat'])], 'cota': round(zp),
         'rectaKm': s['recta_km'], 'coche': tramo(s.get('coche')), 'pie': tramo(s.get('pie')), 'pieCasa': tramo(s.get('pieCasa'))}
    if s.get('partida'):
        o['partida'] = {'nombre': s['partida']['nombre'], 'xy': [round(v) for v in P(s['partida']['lon'], s['partida']['lat'])]}
    mapa['sitios'][sid] = o
    print(' ', sid, 'cota', round(zp), '| coche', o['coche'] and (o['coche']['perfil']['min'], o['coche']['perfil']['max']), '| pie', o['pie'] and (o['pie']['perfil']['sube'], o['pie']['perfil']['baja']))
(RAIZ / 'data/distancias.json').write_text(json.dumps(mapa, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('→ data/horizonte-provisional.json, data/portada.json, data/distancias.json, img/relieve/*.webp')
