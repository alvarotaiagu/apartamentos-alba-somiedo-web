# «El alba, hoy» · el horizonte real desde la casa de Apartamentos rurales Alba (Caunedo, Somiedo).
#
# Lo primero que entrega el agente Lugar 3D (la portada de Web depende de esto):
#   data/lugar-horizonte.json  { lat, lon, cota, alturaOjo, horizonte[360], distanciaKm[360], cimas[], ... }
#   data/lugar.json            { cotaCasa, lat, lon, ... } (la casa, comprobada sobre el Catastro)
#
# Fuentes (todas abiertas):
#   - MDT05, MDT25 y MDT200 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt)      CC BY 4.0, © IGN
#   - Edificios del Catastro INSPIRE (ovc.catastro.meh.es, WFS BU)                     © Dirección General del Catastro
#   - Cumbres con nombre de OpenStreetMap (scripts/lugar-osm.py)                       ODbL, © colaboradores de OSM
# Todo lo descargado se cachea en ref/raw/lugar-cache/ (no viaja a la web).
#
# Cómo se calcula (ver LUGAR.md, «El horizonte»):
#   - El ojo: el centro de la casa (Catastro D00110500QH27A, la casa alta de piedra y blanco) a ALTURA_OJO sobre el
#     MDT05 (las ventanas de la planta alta). Los primeros CERCA_IGNORA metros no cuentan (es la casa, su era y la
#     carretera: el MDT es el suelo desnudo y ahí no ve el edificio).
#   - Para cada rumbo (cada 0,1°) se recorre el terreno hasta 150 km: MDT05 hasta ~10 km, MDT25 hasta ~30 km y
#     MDT200 más allá. El ángulo de cada punto descuenta la curvatura de la Tierra con refracción terrestre normal
#     (radio efectivo R/(1−k), k = 0,13). El horizonte es el máximo.
#   - horizonte[a] (a = 0..359, 0 = norte, sentido horario) es el valor en el rumbo exacto a; horizonteFino lleva los
#     3600 valores (cada 0,1°) para que Alba.sol cruce el sol con el relieve sin perder picos estrechos.
#
# Uso: python -I -X utf8 scripts/lugar-horizonte.py      (antes, una vez: scripts/lugar-osm.py)
import json, math, pathlib, re, time, urllib.request
import numpy as np
from scipy import ndimage
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
DATA = R / 'data'; DATA.mkdir(exist_ok=True)
UA = {'User-Agent': 'datos-mapa-script/1.0 (uso puntual)'}       # sin datos personales

PUNTO_WEB = (43.067663, -6.256931)          # el de su web («cómo llegar»)
REF_CASA = 'D00110500QH27A'                 # la casa alta (ver LUGAR.md, «Qué edificio es»)
ALTURA_OJO = 4.0                            # m sobre el MDT en el centro de la casa: ventanas de la planta alta
CERCA_IGNORA = 30.0                         # m: la casa, su era y la carretera
R_TIERRA = 6371008.8
K_REFR = 0.13                               # refracción terrestre normal
R_EF = R_TIERRA / (1 - K_REFR)


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
    """Un GeoTIFF del WCS con su caja leída de las etiquetas (no se supone la pedida)."""
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


def wcs(cov, S, N, O, E, nombre):
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    bajar(url, CACHE / nombre)
    return Raster(CACHE / nombre)


def teselas(cov, S, N, O, E, nx, ny, base):
    out = []
    for i in range(nx):
        for j in range(ny):
            o, e = O + (E - O) * i / nx, O + (E - O) * (i + 1) / nx
            s, n = S + (N - S) * j / ny, S + (N - S) * (j + 1) / ny
            # solape de 0,004° para que el muestreo bilineal no caiga en el borde
            out.append(wcs(cov, round(s - 0.004, 5), round(n + 0.004, 5), round(o - 0.004, 5), round(e + 0.004, 5), f'{base}-{i}{j}.tif'))
    return out


# ------------------------------------------------------------------ la casa (Catastro)
def poligonos(xml, patron_id):
    out = []
    for m in re.finditer(r'<(?:gml:featureMember|wfs:member|member)>(.*?)</(?:gml:featureMember|wfs:member|member)>', xml, re.S):
        f = m.group(1)
        lid = re.search(patron_id, f)
        pis = re.search(r'numberOfFloorsAboveGround>(\d+)', f); baj = re.search(r'numberOfFloorsBelowGround>(\d+)', f)
        anillos = []
        for pl in re.findall(r'<gml:posList[^>]*>([^<]+)</gml:posList>', f):
            v = list(map(float, pl.split()))
            anillos.append([(v[i], v[i + 1]) for i in range(0, len(v), 2)])     # lat lon (EPSG:4258)
        out.append({'id': lid.group(1) if lid else '?', 'pisos': int(pis.group(1)) if pis else None,
                    'bajo': int(baj.group(1)) if baj else None, 'anillos': anillos})
    return out


def wfs_bu(tipo, S, O, N, E, nombre):
    url = (f'https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=WFS&version=2.0.0&request=GetFeature'
           f'&typenames={tipo}&srsname=EPSG::4258&bbox={S},{O},{N},{E}')
    return bajar(url, CACHE / nombre).decode('latin-1')


def centroide(anillo):
    """Centroide de área de un anillo lat/lon (en metros locales y de vuelta)."""
    la0, lo0 = anillo[0]
    kx = 111320 * math.cos(math.radians(la0)); kz = 110950
    P = [((lo - lo0) * kx, (la - la0) * kz) for la, lo in anillo]
    A = cx = cy = 0.0
    for i in range(len(P) - 1):
        x0, y0 = P[i]; x1, y1 = P[i + 1]; c = x0 * y1 - x1 * y0
        A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    A /= 2; cx /= 6 * A; cy /= 6 * A
    return la0 + cy / kz, lo0 + cx / kx, abs(A)


bu = poligonos(wfs_bu('BU:Building', 43.0650, -6.2605, 43.0705, -6.2535, 'bu-Building.xml'), r'reference>([^<]+)')
bp = poligonos(wfs_bu('BU:BuildingPart', 43.0650, -6.2605, 43.0705, -6.2535, 'bu-BuildingPart.xml'), r'localId>([^<]+)')
casa = next(b for b in bu if b['id'] == REF_CASA)
CLAT, CLON, AREA = centroide(casa['anillos'][0])
parte = next(b for b in bp if b['id'].startswith(REF_CASA))
d_web = math.hypot((CLON - PUNTO_WEB[1]) * 111320 * math.cos(math.radians(CLAT)), (CLAT - PUNTO_WEB[0]) * 110950)
print(f'casa {REF_CASA}: centro {CLAT:.6f}, {CLON:.6f}; {AREA:.0f} m2; {parte["pisos"]} plantas + {parte["bajo"]} bajo rasante; a {d_web:.1f} m del punto de su web')

# ------------------------------------------------------------------ el relieve
m5 = teselas('Elevacion4258_5', CLAT - 0.10, CLAT + 0.10, CLON - 0.135, CLON + 0.135, 3, 3, 'mdt5')       # ~22 x 22 km
m25 = teselas('Elevacion4258_25', CLAT - 0.30, CLAT + 0.30, CLON - 0.41, CLON + 0.41, 2, 2, 'mdt25')     # ~67 x 67 km
m200 = [wcs('Elevacion4258_200', round(CLAT - 1.45, 3), round(CLAT + 1.45, 3), round(CLON - 2.0, 3), round(CLON + 2.0, 3), 'mdt200.tif')]
print('MDT05', [r.a.shape for r in m5][:1], 'x', len(m5), '· MDT25', [r.a.shape for r in m25][:1], 'x', len(m25), '· MDT200', m200[0].a.shape)
CAPAS = [m5, m25, m200]


def altura(lat, lon):
    """Altura (m) del MDT más fino que cubra cada punto. lat/lon: arrays planos."""
    lat = np.asarray(lat, np.float64); lon = np.asarray(lon, np.float64)
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


COTA_SUELO = float(altura(np.array([CLAT]), np.array([CLON]))[0])
# el suelo bajo la casa: de la planta del Catastro (la casa está en ladera; 1 planta bajo rasante al norte)
an = np.array(casa['anillos'][0])
suelo_borde = altura(an[:, 0], an[:, 1])
OJO = COTA_SUELO + ALTURA_OJO
print(f'cota MDT05 en el centro de la casa: {COTA_SUELO:.1f} m (bordes {np.nanmin(suelo_borde):.0f}-{np.nanmax(suelo_borde):.0f} m); ojo a {OJO:.1f} m')


def destino(lat0, lon0, az, d):
    """Punto a distancia d (m) y rumbo az (rad) sobre la esfera."""
    p0, l0 = math.radians(lat0), math.radians(lon0)
    dr = np.asarray(d) / R_TIERRA
    p = np.arcsin(np.sin(p0) * np.cos(dr) + np.cos(p0) * np.sin(dr) * np.cos(az))
    l = l0 + np.arctan2(np.sin(az) * np.sin(dr) * np.cos(p0), np.cos(dr) - np.sin(p0) * np.sin(p))
    return np.degrees(p), np.degrees(l)


# distancias: cada 4 m hasta 2 km, luego crecientes (0,25 %) hasta 150 km
dist = [CERCA_IGNORA]
while dist[-1] < 150000:
    dist.append(dist[-1] + (4.0 if dist[-1] < 2000 else dist[-1] * 0.0025))
D = np.array(dist)
PASO = 0.1
AZS = np.arange(0, 360, PASO)
hor = np.zeros(len(AZS)); hdist = np.zeros(len(AZS)); hpt = np.zeros((len(AZS), 3))
t0 = time.time()
for i, a in enumerate(AZS):
    la, lo = destino(CLAT, CLON, math.radians(a), D)
    h = altura(la, lo)
    ang = np.degrees(np.arctan2(h - OJO - D * D / (2 * R_EF), D))
    k = int(np.nanargmax(ang))
    hor[i] = ang[k]; hdist[i] = D[k]; hpt[i] = (la[k], lo[k], h[k])
print(f'horizonte: {len(AZS)} rumbos x {len(D)} puntos en {time.time() - t0:.0f} s; máx {hor.max():.2f}° a {AZS[hor.argmax()]:.1f}°, mín {hor.min():.2f}° a {AZS[hor.argmin()]:.1f}°')

# ------------------------------------------------------------------ cumbres con nombre (OSM), comprobadas con el MDT
osm = json.loads((CACHE / 'osm-cimas.json').read_text(encoding='utf-8'))['elements']
kx = 111320 * math.cos(math.radians(CLAT)); kz = 110950


def azdist(lat, lon):
    """Rumbo (°) y distancia (m) del ojo a un punto (esfera)."""
    p1, p2 = math.radians(CLAT), math.radians(lat); dl = math.radians(lon - CLON)
    y = math.sin(dl) * math.cos(p2); x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    az = (math.degrees(math.atan2(y, x)) + 360) % 360
    c = math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl)
    return az, R_TIERRA * math.acos(min(1.0, c))


def hor_en(az):
    return float(np.interp(az % 360, np.append(AZS, 360), np.append(hor, hor[0])))


candidatas = []
for e in osm:
    t = e.get('tags', {})
    if 'lat' not in e or not t.get('name') or t.get('natural') != 'peak':
        continue
    az, d = azdist(e['lat'], e['lon'])
    if d < 150 or d > 140000:
        continue
    # la cota de la cumbre en el MDT: el máximo en 40 m alrededor del nodo de OSM (los nodos no siempre caen en el pico)
    off = np.linspace(-40, 40, 9)
    OX, OZ = np.meshgrid(off, off)
    hh = altura(e['lat'] + OZ.ravel() / kz, e['lon'] + OX.ravel() / kx)
    hm = float(np.nanmax(hh))
    ang = math.degrees(math.atan2(hm - OJO - d * d / (2 * R_EF), d))
    hz = hor_en(az)
    candidatas.append({'nombre': t['name'], 'azimut': round(az, 1), 'altura': round(ang, 2), 'cota': round(hm),
                       'coteOSM': t.get('ele'), 'distanciaKm': round(d / 1000, 2), 'sobra': round(ang - hz, 2),
                       'lat': e['lat'], 'lon': e['lon'], 'osm': e.get('id')})
# en el perfil: su ángulo llega al horizonte de ese rumbo (±0,25°; el nodo de OSM y el MDT no casan al metro)
vistas = [c for c in candidatas if c['sobra'] > -0.25]
vistas.sort(key=lambda c: c['azimut'])
ocultas = sorted([c for c in candidatas if -1.5 < c['sobra'] <= -0.25 and c['distanciaKm'] < 25], key=lambda c: c['sobra'], reverse=True)
print('cumbres con nombre en el perfil:')
for c in vistas:
    print(f"  {c['nombre']:<34} {c['azimut']:6.1f}°  {c['altura']:5.2f}°  {c['cota']:5d} m (OSM {c['coteOSM']})  {c['distanciaKm']:6.2f} km  {c['sobra']:+.2f}")
print('casi en el perfil (tapadas por poco):')
for c in ocultas[:12]:
    print(f"  {c['nombre']:<34} {c['azimut']:6.1f}°  {c['altura']:5.2f}°  {c['cota']:5d} m (OSM {c['coteOSM']})  {c['distanciaKm']:6.2f} km  {c['sobra']:+.2f}")
moc = [c for c in candidatas if 'ocoso' in c['nombre']]
print('Mocoso:', moc)

json.dump({'candidatas': candidatas, 'casa': [CLAT, CLON], 'ojo': OJO}, open(CACHE / 'lugar-cimas-candidatas.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ------------------------------------------------------------------ salida
H360 = [round(float(hor[int(round(a / PASO))]), 2) for a in range(360)]
D360 = [round(float(hdist[int(round(a / PASO))]) / 1000, 2) for a in range(360)]
cimas = [{'nombre': c['nombre'], 'azimut': c['azimut'], 'altura': c['altura'], 'cota': c['cota'],
          'distanciaKm': c['distanciaKm'], 'fuente': f"OSM node {c['osm']} · cota del MDT del IGN"} for c in vistas]
salida = {
    'lat': round(CLAT, 6), 'lon': round(CLON, 6), 'cota': round(COTA_SUELO, 1), 'alturaOjo': ALTURA_OJO,
    'horizonte': H360, 'distanciaKm': D360, 'cimas': cimas,
    # cumbres que su texto nombra pero que NO forman el perfil (tapadas por relieve más cercano): para no rotularlas
    'tapadas': [{'nombre': c['nombre'], 'azimut': c['azimut'], 'altura': c['altura'], 'cota': c['cota'],
                 'distanciaKm': c['distanciaKm'], 'tapadaPor': round(-c['sobra'], 2),
                 'fuente': f"OSM node {c['osm']} (ele {c['coteOSM']}) · cota del MDT del IGN"} for c in moc],
    'paso': PASO, 'horizonteFino': [round(float(v), 2) for v in hor],
    'nota': ('Ángulo en grados sobre la horizontal del relieve visto desde la casa (centro de la casa del Catastro '
             f'{REF_CASA}, a {ALTURA_OJO:g} m sobre el suelo), con el MDT05/MDT25/MDT200 del IGN (CC BY 4.0) hasta 150 km, '
             f'curvatura de la Tierra y refracción terrestre k = {K_REFR}. horizonte[a]: rumbo a (0 = norte, sentido horario); '
             f'horizonteFino: cada {PASO}°. El MDT es el suelo desnudo: no ve árboles ni casas. Cumbres: nombres de '
             'OpenStreetMap comprobados contra el perfil del MDT.'),
    'fuente': 'scripts/lugar-horizonte.py (agente Lugar 3D)', 'fecha': time.strftime('%Y-%m-%d'),
}
(DATA / 'lugar-horizonte.json').write_text(json.dumps(salida, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
lj = DATA / 'lugar.json'
previo = json.loads(lj.read_text(encoding='utf-8')) if lj.exists() else {}
previo.update({
    'cotaCasa': round(COTA_SUELO), 'lat': round(CLAT, 6), 'lon': round(CLON, 6),
    'cotaCasaNota': ('metros sobre el nivel del mar: terreno del MDT05 del IGN en el centro de la casa (está en ladera: '
                     f'de {np.nanmin(suelo_borde):.0f} a {np.nanmax(suelo_borde):.0f} m en sus bordes)'),
    'catastro': REF_CASA, 'coordenadasNota': f'centro de la casa en el Catastro ({REF_CASA}); el punto de su web cae a {d_web:.0f} m',
    'fuente': 'scripts/lugar-horizonte.py (agente Lugar 3D)', 'fecha': time.strftime('%Y-%m-%d'),
})
lj.write_text(json.dumps(previo, ensure_ascii=False, indent=1), encoding='utf-8')
print('escrito data/lugar-horizonte.json', (DATA / 'lugar-horizonte.json').stat().st_size // 1024, 'KB y data/lugar.json')
