# Lugares de OpenStreetMap para el horizonte y los rótulos del 3D de Alba (© colaboradores de OpenStreetMap, ODbL).
# Pide a Overpass (con espejos y reintentos) las cumbres con nombre en ~45 km alrededor de Caunedo (las que pueden
# formar el perfil que se ve desde la casa) y los pueblos, ríos y lagos del valle en ~12 km. Guarda la respuesta
# cruda en ref/raw/lugar-cache/osm-*.json. El emparejado (cumbre del perfil ↔ cumbre con nombre) lo hace
# scripts/lugar-horizonte.py, que no se fía del nombre: mira la cota del MDT y la línea de visión.
# Uso: python -I -X utf8 scripts/lugar-osm.py
import functools, json, pathlib, time, urllib.parse, urllib.request
print = functools.partial(print, flush=True)

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
UA = 'datos-mapa-script/1.0 (uso puntual)'          # sin datos personales; con UA de navegador Overpass da 406
ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
           'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
LEJOS = '42.66,-6.80,43.47,-5.70'                   # cumbres: ~45 km
CERCA = '42.98,-6.40,43.16,-6.12'                   # pueblos, ríos y lagos del valle: ~12 km
QC = f'''[out:json][timeout:120];
(
  node["natural"~"peak|saddle|ridge|cliff"]["name"]({LEJOS});
  node["mountain_pass"="yes"]["name"]({CERCA});
);
out body;'''
QV = f'''[out:json][timeout:120];
(
  node["place"~"town|village|hamlet|isolated_dwelling|locality"]({CERCA});
  nwr["natural"="water"]["name"]({CERCA});
  way["waterway"="river"]["name"]({CERCA});
  nwr["tourism"~"apartment|guest_house|hotel|chalet"]({CERCA});
  nwr["name"~"Mocoso|Caunedo|Alba",i]({CERCA});
);
out center tags;'''
QR = f'''[out:json][timeout:120];
(
  way["highway"~"primary|secondary|tertiary|unclassified|residential|track"](43.045,-6.29,43.09,-6.22);
  way["waterway"~"river|stream"](43.03,-6.31,43.10,-6.20);
);
out geom tags;'''


def pedir(Q):
    datos = urllib.parse.urlencode({'data': Q}).encode()
    espera = 4
    for vuelta in range(4):
        for url in ESPEJOS:
            try:
                req = urllib.request.Request(url, data=datos, headers={'User-Agent': UA})
                cuerpo = urllib.request.urlopen(req, timeout=75).read()
                j = json.loads(cuerpo)
                if 'elements' in j and j['elements']:
                    print('OK', url, len(j['elements']), 'elementos')
                    return j
                print('vacío', url)
            except Exception as e:
                print('falla', url, str(e)[:80])
        print('reintento en', espera, 's'); time.sleep(espera); espera *= 2
    raise SystemExit('Overpass no responde: vuelve a probar más tarde')


for nombre, q in (('osm-cimas.json', QC), ('osm-valle.json', QV), ('osm-vias.json', QR)):
    if (CACHE / nombre).exists():
        print('ya está', nombre); continue
    j = pedir(q)
    (CACHE / nombre).write_text(json.dumps(j, ensure_ascii=False), encoding='utf-8')
    time.sleep(2)
