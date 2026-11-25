/* Comprobación de js/sol.js contra referencias independientes (agente Lugar 3D).
   1. Posición del sol: JPL Horizons (NASA), observador topocéntrico en la casa, acimut y altura sin refracción
      (QUANTITIES=4, APPARENT=AIRLESS) en 48 instantes de 2026 → error de acimut y de altura geométrica.
      Y con refracción (APPARENT=REFRACTED, atmósfera estándar de Horizons) → error de la altura aparente.
   2. Orto y ocaso con horizonte plano: Open-Meteo (archivo histórico, «daily=sunrise,sunset», hora de Madrid)
      todos los días de 2025 → diferencia con Alba.sol.oficial().
   3. La tabla de la entrada del sol en la casa el día 21 de cada mes (2026) y los días sin sol directo.
   Las respuestas se guardan en ref/raw/lugar-cache/ (si están, no se vuelven a pedir).
   Uso: node scripts/lugar-sol.mjs            (--md imprime la tabla en Markdown para LUGAR.md) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, 'ref/raw/lugar-cache');
fs.mkdirSync(CACHE, { recursive: true });
const UA = { 'User-Agent': 'datos-mapa-script/1.0 (uso puntual)' };   // sin datos personales

const ctx = { URL, URLSearchParams, Intl, Math, Date, console, fetch: undefined };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/sol.js'), 'utf8'), ctx, { filename: 'sol.js' });
const S = ctx.Alba.sol;
const HZ = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/lugar-horizonte.json'), 'utf8'));
S.usar(HZ);
const LAT = HZ.lat, LON = HZ.lon, ALT_KM = (HZ.cota + HZ.alturaOjo) / 1000;

async function pide(url, fichero) {
  const f = path.join(CACHE, fichero);
  if (fs.existsSync(f) && fs.statSync(f).size > 200) return fs.readFileSync(f, 'utf8');
  for (let k = 0; k < 4; k++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
      const t = await r.text(); fs.writeFileSync(f, t); return t;
    } catch (e) { console.log('  falla', fichero, String(e).slice(0, 120)); await new Promise((z) => setTimeout(z, 3000 * (k + 1))); }
  }
  throw new Error('no se pudo pedir ' + fichero);
}

/* ---------- 1. JPL Horizons ---------- */
const instantes = [];
for (let m = 0; m < 12; m++) for (const h of [7, 10, 13, 16]) instantes.push(Date.UTC(2026, m, 21, h, 17));
const jd = (t) => (t / 86400000 + 2440587.5).toFixed(6);
function horizons(aparente) {
  const p = new URLSearchParams({
    format: 'json', COMMAND: "'10'", OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'OBSERVER', CENTER: "'coord@399'",
    COORD_TYPE: 'GEODETIC', SITE_COORD: `'${LON},${LAT},${ALT_KM}'`, TLIST: instantes.map(jd).join(' '), TLIST_TYPE: 'JD',
    TIME_TYPE: 'UT', QUANTITIES: "'4'", ANG_FORMAT: 'DEG', APPARENT: aparente, CSV_FORMAT: 'YES', EXTRA_PREC: 'YES',
  });
  return pide('https://ssd.jpl.nasa.gov/api/horizons.api?' + p, `lugar-horizons-${aparente.toLowerCase()}.json`).then((t) => {
    const res = JSON.parse(t).result;
    const filas = res.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');
    return filas.map((l) => { const c = l.split(',').map((x) => x.trim()); return { az: +c[c.length - 3] || +c[3], el: +c[c.length - 2] || +c[4], raw: c }; });
  });
}
function columnas(f) {   // CSV: fecha, (marcas), (marcas), az, el,
  const nums = f.raw.filter((x) => x !== '' && /^-?\d+(\.\d+)?$/.test(x)).map(Number);
  return { az: nums[nums.length - 2], el: nums[nums.length - 1] };
}

console.log('1. Posición del sol contra JPL Horizons (' + instantes.length + ' instantes de 2026, observador en la casa)');
let errAz = 0, errEl = 0, errElR = 0, n = 0, nR = 0;
try {
  const [geo, ref] = await Promise.all([horizons('AIRLESS'), horizons('REFRACTED')]);
  instantes.forEach((t, i) => {
    const p = S.posicion(new Date(t)), g = columnas(geo[i]), r = columnas(ref[i]);
    if (g.el > -1) {
      const dAz = Math.abs(((p.azimut - g.az + 540) % 360) - 180), dEl = Math.abs(p.alturaGeometrica - g.el);
      errAz = Math.max(errAz, dAz * Math.cos(g.el * Math.PI / 180)); errEl = Math.max(errEl, dEl); n++;
    }
    if (r.el > 2) { errElR = Math.max(errElR, Math.abs(p.altura - r.el)); nR++; }
  });
  console.log(`   acimut (en el cielo, × cos altura): error máx ${errAz.toFixed(4)}°; altura geométrica: ${errEl.toFixed(4)}° (${n} instantes con el sol fuera)`);
  console.log(`   altura con refracción (> 2°; Horizons usa 1010 hPa y 10 °C, Alba.sol ~903 hPa): ${errElR.toFixed(4)}° (${nR})`);
} catch (e) { console.log('   Horizons no responde: ' + e.message); errAz = errEl = NaN; }

/* ---------- 2. Open-Meteo: orto y ocaso de 2025 ---------- */
console.log('2. Orto y ocaso (horizonte plano) contra Open-Meteo, todo 2025');
let dMax = 0, dSum = 0, nd = 0, peor = '';
try {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=2025-01-01&end_date=2025-12-31&daily=sunrise,sunset&timezone=Europe%2FMadrid`;
  const om = JSON.parse(await pide(url, 'lugar-openmeteo-orto-2025.json'));
  // Ojo (comprobado): el archivo de Open-Meteo da todo el año con un desfase fijo (utc_offset_seconds = 3600, sin
  // horario de verano) y calcula en el centro de su celda (43,128, −6,304; a ~7 km). Se compara en esos términos:
  // su hora con su desfase, y Alba.sol puesto en su celda (otra copia de sol.js con horizonte plano).
  const off = om.utc_offset_seconds * 1000;
  const aMs = (s) => { const [d, h] = s.split('T'); const [y, mo, da] = d.split('-').map(Number); const [hh, mi] = h.split(':').map(Number); return Date.UTC(y, mo - 1, da, hh, mi) - off; };
  const c2 = { URL, URLSearchParams, Intl, Math, Date, console }; c2.window = c2; vm.createContext(c2);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/sol.js'), 'utf8'), c2, { filename: 'sol.js' });
  const S2 = c2.Alba.sol; S2.usar({ lat: om.latitude, lon: om.longitude, cota: om.elevation, alturaOjo: 0, horizonte: new Array(360).fill(0) });
  console.log(`   (celda de Open-Meteo ${om.latitude}, ${om.longitude}; desfase fijo ${om.utc_offset_seconds / 3600} h)`);
  om.daily.time.forEach((d, i) => {
    const [y, mo, da] = d.split('-').map(Number);
    const o = S2.oficial(new Date(Date.UTC(y, mo - 1, da, 12, 0)));
    for (const [nom, mio, suyo] of [['orto', o.orto, om.daily.sunrise[i]], ['ocaso', o.ocaso, om.daily.sunset[i]]]) {
      // Open-Meteo da la hora al minuto (truncada o redondeada): se compara con el minuto de Alba.sol
      const dif = Math.abs(+mio - aMs(suyo)) / 60000;
      dSum += dif; nd++;
      if (dif > dMax) { dMax = dif; peor = `${d} ${nom}: Alba ${S.hora(mio)}:${String(S.madrid(mio).s).padStart(2, '0')} · Open-Meteo ${suyo.slice(11)}`; }
    }
  });
  console.log(`   ${nd} horas: diferencia media ${dSum / nd < 1 ? (dSum / nd * 60).toFixed(0) + ' s' : (dSum / nd).toFixed(2) + ' min'}, máxima ${dMax.toFixed(2)} min (${peor})`);
} catch (e) { console.log('   Open-Meteo no responde: ' + e.message); }

/* ---------- 2 bis. El horizonte contra el de PVGIS (Comisión Europea, JRC; su propio MDT, ~90 m) ---------- */
console.log('2 bis. El horizonte contra PVGIS (JRC, «printhorizon», MDT propio de ~90 m, cada 7,5°)');
let hzMed = NaN;
try {
  const pv = JSON.parse(await pide(`https://re.jrc.ec.europa.eu/api/v5_2/printhorizon?lat=${LAT}&lon=${LON}&outputformat=json`, 'lugar-pvgis-horizonte.json'));
  // PVGIS: A = 0 al sur, −90 al este, +90 al oeste → rumbo = 180 + A
  const difs = pv.outputs.horizon_profile.filter((x) => x.A > -180).map((x) => ({ az: (180 + x.A + 360) % 360, pv: x.H_hor, alba: S.horizonte((180 + x.A + 360) % 360) }));
  const abs = difs.map((x) => Math.abs(x.alba - x.pv)).sort((a, b) => a - b);
  hzMed = abs[Math.floor(abs.length / 2)];
  const peor = difs.reduce((a, b) => (Math.abs(b.alba - b.pv) > Math.abs(a.alba - a.pv) ? b : a));
  const sal = difs.filter((x) => x.az >= 60 && x.az <= 150);
  console.log(`   ${difs.length} rumbos: diferencia mediana ${hzMed.toFixed(1)}°, máxima ${Math.abs(peor.alba - peor.pv).toFixed(1)}° a ${peor.az}° (Alba ${peor.alba.toFixed(1)}°, PVGIS ${peor.pv}°)`);
  console.log('   por donde sale el sol (60°–150°): ' + sal.map((x) => `${x.az}° ${x.alba.toFixed(1)}/${x.pv}`).join(' · '));
} catch (e) { console.log('   PVGIS no responde: ' + e.message); }

/* ---------- 3. La tabla ---------- */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dur = (ms) => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
const filas = [];
for (let m = 1; m <= 12; m++) {
  const dia = S.desdeMadrid(2026, m, 21, 12, 0);
  const o = S.oficial(dia), tr = S.tramos(dia), en = S.entrada(dia), sa = S.salida(dia);
  const total = tr.reduce((s, x) => s + (x.hasta - x.desde), 0);
  const pe = en ? S.posicion(en) : null;
  filas.push({
    mes: MESES[m - 1], orto: S.hora(o.orto), entrada: en ? S.hora(en) : '—', hacia: en ? S.haciaLas(en) : 'no entra',
    salida: sa ? S.hora(sa) : '—', ocaso: S.hora(o.ocaso), sol: dur(total), ratos: tr.length,
    por: pe ? `${pe.azimut.toFixed(0)}° · ${pe.altura.toFixed(1)}°` : '—',
    tarde: en ? Math.round((en - o.orto) / 60000) : null,
  });
}
console.log('3. El sol en la casa el día 21 de cada mes (2026, hora de Madrid)');
if (process.argv.includes('--md')) {
  console.log('\n| Día 21 de | Orto (plano) | **Entra en la casa** | Portada («hacia las») | Se esconde | Ocaso (plano) | Sol directo | Por dónde entra (rumbo · altura) |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const f of filas) console.log(`| ${f.mes} | ${f.orto} | **${f.entrada}** | ${f.hacia} | ${f.salida} | ${f.ocaso} | ${f.sol}${f.ratos > 1 ? ` (${f.ratos} ratos)` : ''} | ${f.por} |`);
  console.log('');
} else {
  for (const f of filas) console.log(`   ${f.mes.padEnd(11)} orto ${f.orto}  entra ${f.entrada} (${f.tarde ?? '—'} min tras el orto; ${f.hacia})  se esconde ${f.salida}  ocaso ${f.ocaso}  sol ${f.sol}${f.ratos > 1 ? ' en ' + f.ratos + ' ratos' : ''}  por ${f.por}`);
}

// días sin sol directo y el año entero
let sin = [], primero = null, maxRatos = 0;
const anio = [];
for (let t = +S.desdeMadrid(2026, 1, 1, 12, 0); t < +S.desdeMadrid(2027, 1, 1, 12, 0); t += 86400000) {
  const d = new Date(t), tr = S.tramos(d), p = S.madrid(d);
  const f = `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;
  maxRatos = Math.max(maxRatos, tr.length);
  if (!tr.length) sin.push(f);
  const en = S.entrada(d);
  anio.push({ f, en: en ? S.hora(en) : null, sa: tr.length ? S.hora(S.salida(d)) : null, min: Math.round(tr.reduce((s, x) => s + (x.hasta - x.desde), 0) / 60000) });
}
const corto = anio.reduce((a, b) => (b.min < a.min ? b : a)), largo = anio.reduce((a, b) => (b.min > a.min ? b : a));
const tardio = anio.filter((x) => x.en).reduce((a, b) => (b.en > a.en ? b : a)), temprano = anio.filter((x) => x.en).reduce((a, b) => (b.en < a.en ? b : a));
console.log(`   días de 2026 sin sol directo en la casa: ${sin.length}${sin.length ? ' (' + sin[0] + ' … ' + sin.at(-1) + ')' : ''}`);
console.log(`   menos sol: ${corto.f} (${corto.min} min, entra ${corto.en}); más: ${largo.f} (${dur(largo.min * 60000)})`);
console.log(`   entra más tarde: ${tardio.f} a las ${tardio.en}; más pronto: ${temprano.f} a las ${temprano.en}; hasta ${maxRatos} ratos de sol en un día`);
fs.writeFileSync(path.join(CACHE, 'lugar-sol-2026.json'), JSON.stringify({ tabla: filas, sinSol: sin, anio }, null, 1));
const bien = !(errAz > 0.1) && !(errEl > 0.1) && !(dMax > 1.5);
console.log(bien ? 'BIEN: posición ≤ 0,1° y orto/ocaso ≤ 1,5 min' : 'MAL: revisar arriba');
process.exitCode = bien ? 0 : 1;
