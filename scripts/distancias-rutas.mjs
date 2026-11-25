// «A cuánto queda»: rutas REALES desde la casa con OSRM (servidor público, perfil coche) y, a pie, con el perfil foot de
// routing.openstreetmap.de. Datos de © colaboradores de OpenStreetMap (ODbL). Nada a ojo.
//   node scripts/distancias-rutas.mjs   → ref/raw/rutas.json  (geometría, km, minutos, carreteras, puntos de partida)
// Los sitios se han buscado en OSM por nombre (Overpass, 2026-11-25) y se fijan aquí por su id; el script vuelve a pedir
// sus coordenadas a OSM (si un id desaparece, ese sitio queda «por confirmar»).
// Algunos sitios no se alcanzan en coche: se va en coche hasta el punto de partida (pueblo o aparcamiento) y desde ahí
// a pie («tramos»). Los que están cerca de la casa se calculan también a pie desde la puerta.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, ruta, dormir, hav } from './distancias-util.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// la casa: coordenadas de su web (ref/DATOS-ALBA.md). Si Lugar 3D ya dejó data/lugar.json con las comprobadas sobre el
// Catastro, se usan esas.
let CASA = { lat: 43.067663, lon: -6.256931, fuente: 'su web (enlace «cómo llegar»), ref/DATOS-ALBA.md' };
try {
  const L = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/lugar.json'), 'utf8'));
  if (Number.isFinite(L.lat) && Number.isFinite(L.lon)) CASA = { lat: L.lat, lon: L.lon, fuente: 'data/lugar.json (Lugar 3D, comprobadas sobre el Catastro)' };
} catch (e) { /* sin el fichero de Lugar */ }

// grupo: cerca (a pie desde la puerta), valle (Somiedo), fuera (para llegar o salir)
// coche: true = en coche hasta el sitio; 'id' = en coche hasta ese punto de partida y luego a pie (pieDesde)
const SITIOS = [
  { id: 'mumian', nombre: 'Braña de Mumián', tipo: 'Braña', grupo: 'cerca', osm: 'node/4247991421', pieCasa: true },
  { id: 'pola', nombre: 'Pola de Somiedo', tipo: 'La capital del concejo', grupo: 'cerca', osm: 'node/128529689', coche: true, pieCasa: true },
  { id: 'peral', nombre: 'La Peral', tipo: 'Aldea de la braña', grupo: 'cerca', osm: 'node/1018490447', coche: true, pieCasa: true },
  { id: 'puerto', nombre: 'Puerto de Somiedo', tipo: 'El alto, a 1.485 m según OSM', grupo: 'valle', osm: 'node/1514399648', coche: true },
  { id: 'pornacal', nombre: 'Braña de La Pornacal', tipo: 'Braña de teitos', grupo: 'valle', osm: 'way/88276181', partida: { nombre: 'Villar de Vildas', osm: 'node/1025222988' }, pieCasa: true },
  { id: 'vallelago', nombre: 'Valle de Lago', tipo: 'Pueblo', grupo: 'valle', osm: 'node/1019268840', coche: true },
  { id: 'lagovalle', nombre: 'Lago del Valle', tipo: 'El lago más grande de Asturias', grupo: 'valle', osm: 'relation/1275459', partida: { nombre: 'Valle de Lago', osm: 'node/1019268840' } },
  { id: 'saliencia', nombre: 'Lagos de Saliencia', tipo: 'Lago de la Cueva, desde el alto de La Farrapona', grupo: 'valle', osm: 'way/176478704', partida: { nombre: 'Alto de La Farrapona (aparcamiento)', osm: 'way/360922081' } },
  { id: 'belmonte', nombre: 'Belmonte de Miranda', tipo: 'Villa', grupo: 'fuera', osm: 'node/2377539449', coche: true },
  { id: 'oviedo', nombre: 'Oviedo', tipo: 'Ciudad', grupo: 'fuera', buscar: 'node(43.30,-5.90,43.40,-5.80)["place"="city"];out;', coche: true },
  { id: 'leon', nombre: 'León', tipo: 'Ciudad', grupo: 'fuera', osm: 'node/31432063', coche: true },
  { id: 'aeropuerto', nombre: 'Aeropuerto de Asturias', tipo: 'Aeropuerto', grupo: 'fuera', osm: 'way/35951935', coche: true },
];
// el lago del Valle: la ruta a pie va hasta la orilla norte (la del camino), no al centro del agua
const PUNTO_LAGO = 'orilla';

const ids = { node: new Set(), way: new Set(), relation: new Set() };
for (const s of SITIOS) for (const o of [s.osm, s.partida && s.partida.osm]) if (o) { const [t, i] = o.split('/'); ids[t].add(i); }
const q = '[out:json][timeout:60];(' + Object.entries(ids).filter(([, v]) => v.size).map(([t, v]) => `${t}(id:${[...v].join(',')});`).join('') + ');out center tags geom;';
const J = await overpass(q);
const porId = new Map(J.elements.map((e) => [`${e.type}/${e.id}`, e]));
// con «out geom» Overpass no da «center»: el centro de la caja (bounds) de la vía o la relación
const punto = (e) => {
  if (Number.isFinite(e.lat)) return { lat: e.lat, lon: e.lon };
  if (e.center) return { lat: e.center.lat, lon: e.center.lon };
  const b = e.bounds;
  return { lat: (b.minlat + b.maxlat) / 2, lon: (b.minlon + b.maxlon) / 2 };
};
const nombreOsm = (e) => e.tags && (e.tags['name:es'] || e.tags.name);

const r5 = (v) => Math.round(v * 1e5) / 1e5;
function resumen(j) {
  const r = j.routes[0];
  const carreteras = [];
  for (const leg of r.legs) for (const s of leg.steps) { const ref = (s.ref || '').split(';')[0].trim(); if (ref && s.distance > 400 && carreteras[carreteras.length - 1] !== ref) carreteras.push(ref); }
  return {
    km: +(r.distance / 1000).toFixed(2),
    minutos: Math.max(1, Math.round(r.duration / 60)),
    carreteras,
    snap_origen_m: Math.round(j.waypoints[0].distance),
    snap_destino_m: Math.round(j.waypoints[1].distance),
    geometria: r.geometry.coordinates.map(([lo, la]) => [r5(lo), r5(la)]),
  };
}

const salida = {
  fuente: 'OSRM: router.project-osrm.org (coche) y routing.openstreetmap.de/routed-foot (a pie); datos de © colaboradores de OpenStreetMap, ODbL',
  fecha: new Date().toISOString().slice(0, 10),
  nota: 'Tiempos de OSRM con velocidades teóricas, sin tráfico ni paradas: orientativos. A pie, a paso llano (OSRM no cuenta la subida). snap_*_m = distancia del punto pedido al camino donde empieza o acaba la ruta.',
  casa: CASA,
  orden: SITIOS.map((s) => s.id),
  sitios: {},
};

let Q = null;
if (SITIOS.some((s) => s.buscar)) Q = SITIOS.filter((s) => s.buscar);
for (const s of SITIOS) {
  const d = { nombre: s.nombre, tipo: s.tipo, grupo: s.grupo };
  try {
    let e = s.osm ? porId.get(s.osm) : null;
    if (!e && s.buscar) {
      const jj = await overpass('[out:json][timeout:40];' + s.buscar);
      e = jj.elements.find((x) => /oviedo/i.test((x.tags && (x.tags['name:es'] || x.tags.name)) || ''));
    }
    if (!e) throw new Error('no está en OSM: ' + (s.osm || s.buscar));
    let pt = punto(e);
    // el lago: el punto de su orilla más cercano a la partida (el camino llega por el norte)
    if (s.partida && e.type === 'relation' && e.members && PUNTO_LAGO === 'orilla') {
      const p0 = punto(porId.get(s.partida.osm));
      let mejor = null;
      for (const m of e.members) for (const g of (m.geometry || [])) if (!mejor || hav(p0, g) < hav(p0, mejor)) mejor = g;
      if (mejor) pt = mejor;
    }
    if (s.partida && e.type === 'way' && e.geometry) {
      const p0 = punto(porId.get(s.partida.osm));
      pt = e.geometry.reduce((m, g) => (hav(p0, g) < hav(p0, m) ? g : m));
    }
    Object.assign(d, { osm: `${e.type}/${e.id}`, osm_nombre: nombreOsm(e), lat: r5(pt.lat), lon: r5(pt.lon), ele_osm: e.tags && e.tags.ele ? +e.tags.ele : null });
    d.recta_km = +(hav(CASA, d) / 1000).toFixed(2);
    if (s.coche) { d.coche = resumen(await ruta(CASA, d, 'coche')); await dormir(1200); }
    if (s.partida) {
      const pe = porId.get(s.partida.osm);
      const pp = punto(pe);
      d.partida = { nombre: s.partida.nombre, osm: s.partida.osm, lat: r5(pp.lat), lon: r5(pp.lon) };
      d.coche = resumen(await ruta(CASA, pp, 'coche')); await dormir(1200);
      d.pie = resumen(await ruta(pp, d, 'pie')); d.pie.desde = 'partida'; await dormir(1200);
    }
    if (s.pieCasa) {
      const p = resumen(await ruta(CASA, d, 'pie')); p.desde = 'casa';
      if (d.pie) d.pieCasa = p; else d.pie = p;
      await dormir(1200);
    }
  } catch (er) { d.error = er.message; }
  salida.sitios[s.id] = d;
  const t = (x) => (x ? `${x.km} km ${x.minutos} min${x.carreteras && x.carreteras.length ? ' ' + x.carreteras.join('>') : ''} (snap ${x.snap_origen_m}/${x.snap_destino_m} m)` : '-');
  console.log(s.id.padEnd(11), d.osm || '', d.osm_nombre || '', '| recta', d.recta_km, '| coche', t(d.coche), '| pie', t(d.pie), d.pieCasa ? '| pie desde casa ' + t(d.pieCasa) : '', d.error || '');
}
fs.mkdirSync(path.join(RAIZ, 'ref/raw'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), JSON.stringify(salida));
console.log('→ ref/raw/rutas.json');
