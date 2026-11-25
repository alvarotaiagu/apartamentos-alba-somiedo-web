/* Comprobación del sol y del módulo lugar de Alba (agente Lugar 3D). NO pinta el 3D.
   1. Node: js/sol.js (contrato, ?hora/?fecha, días sin sol) y las funciones puras de js/lugar.js.
   2. Datos: data/lugar*.json, img/lugar/, pesos, la casa sobre el Catastro, el recorrido.
   3. Plan B en Chromium sin WebGL (--disable-3d-apis + navigator.webdriver): monta, marcas, la sombra de las peñas
      en el plano, el mando de hora, la frase del día; y la COHERENCIA de la sombra de la escena con Alba.sol:
      la misma marcha por el relieve que hace la GPU, sobre los PNG de alturas, en la casa, contra Alba.sol.entrada.
   4. La escena 3D con Three.js de verdad y un WebGLRenderer FALSO que no pinta: monta, sin NaN, rótulos y paradas
      por tramos, la luz de la casa = Alba.sol, pausa fuera de pantalla, «Ver en plano», destruir(), el móvil.
   Uso: node scripts/lugar-prueba.mjs                 (puerto 8972; un solo Chromium, 1280×800 y 390×844, escala 1)
        node scripts/lugar-prueba.mjs --sin-navegador (solo 1 y 2)
   Antes de lanzarlo, mirar que no haya otra prueba en marcha (CLAUDE.md de WEBS NEGOCIOS). */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8972;
let fallos = 0, bien = 0;
const ok = (c, txt) => { if (c) { bien++; console.log('  ok  ', txt); } else { fallos++; console.log('  MAL ', txt); } };
const lee = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const json = (f) => JSON.parse(lee(f));

/* ---------- 1. funciones puras ---------- */
console.log('1. js/sol.js y funciones puras de js/lugar.js');
function cargaSol(search) {
  const c = { URL, URLSearchParams, Intl, Math, Date, console, location: { search: search || '' } };
  c.window = c; vm.createContext(c);
  vm.runInContext(lee('js/sol.js'), c, { filename: 'sol.js' });
  return c.Alba.sol;
}
const HZ = json('data/lugar-horizonte.json');
const S = cargaSol('');
ok(['ahora', 'posicion', 'entrada', 'salida', 'oficial', 'cargar'].every((k) => typeof S[k] === 'function'), 'Alba.sol expone ahora, posicion, entrada, salida, oficial y cargar');
ok(S.entrada(new Date()) === undefined, 'sin cargar() el horizonte, entrada() da undefined (no inventa un horizonte plano)');
S.usar(HZ);
const tam = fs.statSync(path.join(RAIZ, 'js/sol.js')).size;
ok(tam < 12000, `sol.js pequeño y sin dependencias: ${(tam / 1024).toFixed(1)} KB`);
const S2 = cargaSol('?hora=09:20&fecha=2026-06-21');
const a2 = S2.ahora();
ok(S2.hora(a2) === '09:20' && a2.toISOString() === '2026-06-21T07:20:00.000Z', `?hora=09:20&fecha=2026-06-21 → ${a2.toISOString()} (hora de Madrid, verano)`);
const S3 = cargaSol('?hora=10:00&fecha=2026-12-21');
ok(S3.ahora().toISOString() === '2026-12-21T09:00:00.000Z', '?fecha en invierno → UTC+1');
const p = S.posicion(new Date('2026-06-21T12:25:00Z'));
ok(p.altura > 69 && p.altura < 70.6 && p.azimut > 170 && p.azimut < 190, `sol el 21-jun a mediodía: ${p.altura.toFixed(2)}° al ${p.azimut.toFixed(0)}°`);
const dJun = S.desdeMadrid(2026, 6, 21, 12, 0), en = S.entrada(dJun), sa = S.salida(dJun), of = S.oficial(dJun);
ok(en instanceof Date && sa instanceof Date && en > of.orto && sa < of.ocaso, `21-jun: orto ${S.hora(of.orto)} < entra ${S.hora(en)} < se esconde ${S.hora(sa)} < ocaso ${S.hora(of.ocaso)}`);
const pe = S.posicion(new Date(+en + 60000));
ok(S.visible(new Date(+en + 60000)) && !S.visible(new Date(+en - 60000)), `en la entrada el sol asoma justo: a ${pe.altura.toFixed(2)}° con la peña a ${S.horizonte(pe.azimut).toFixed(2)}°`);
// con un horizonte de 40° en todas direcciones, el 21 de diciembre (sol a 23,5° a mediodía) no hay sol: null
const S4 = cargaSol(''); S4.usar(Object.assign({}, HZ, { horizonteFino: null, horizonte: new Array(360).fill(40) }));
ok(S4.entrada(S4.desdeMadrid(2026, 12, 21, 12, 0)) === null && S4.salida(S4.desdeMadrid(2026, 12, 21, 12, 0)) === null, 'entrada() y salida() dan null cuando el relieve tapa el sol todo el día');
let sinSol = 0;
for (let d = 0; d < 365; d++) if (!S.tramos(new Date(Date.UTC(2026, 0, 1, 12) + d * 864e5)).length) sinSol++;
ok(sinSol === 0, `días de 2026 sin sol directo en la casa: ${sinSol}`);
// lugar.js
const ctx = { window: {}, document: { currentScript: null }, location: { href: 'http://localhost/', search: '' }, URL, URLSearchParams, Intl, Math, Date, console };
ctx.window = ctx; ctx.Alba = { sol: S }; vm.createContext(ctx);
vm.runInContext(lee('js/lugar.js'), ctx, { filename: 'lugar.js' });
const L = ctx.Alba.lugar;
ok(typeof L.montar === 'function', 'expone Alba.lugar.montar');
const r = L.resumenDia(dJun);
ok(/^Hoy|^El 21 de junio/.test(L.fraseDia(r, dJun, dJun)) && /hacia las 09:30/.test(L.fraseDia(r, dJun, dJun)), 'frase del día: ' + L.fraseDia(r, dJun, dJun));
ok(/sombra/.test(L.fraseInstante(S.desdeMadrid(2026, 6, 21, 9, 0), r)) && /da el sol/.test(L.fraseInstante(S.desdeMadrid(2026, 6, 21, 11, 0), r)), 'frase del instante: ' + L.fraseInstante(S.desdeMadrid(2026, 6, 21, 9, 0), r));
const meta = json('data/lugar-escena.json');
const ruta = L.camino(meta.recorrido);
let pasa = 0, salto = 0, prev = null;
for (let i = 0; i <= 4000; i++) {
  const q = ruta(i / 4000);
  for (let k = 0; k < 3; k++) { const vs = meta.recorrido.map((x) => x.pos[k]); if (q.pos[k] < Math.min(...vs) - 0.01 || q.pos[k] > Math.max(...vs) + 0.01) pasa++; }
  if (prev) salto = Math.max(salto, Math.hypot(q.pos[0] - prev[0], q.pos[1] - prev[1], q.pos[2] - prev[2]));
  prev = q.pos;
}
ok(pasa === 0, 'el recorrido no se sale del rango de sus puntos');
ok(salto < 15, `paso máximo entre 1/4000 de scroll: ${salto.toFixed(2)} m`);
const fin = ruta(1);
const dFin = Math.hypot(fin.pos[0], fin.pos[2]), azFin = (Math.atan2(fin.mira[0] - fin.pos[0], -(fin.mira[2] - fin.pos[2])) * 180 / Math.PI + 360) % 360;
ok(dFin > 15 && dFin < 30 && azFin > 30 && azFin < 80, `acaba a ${dFin.toFixed(0)} m de la casa mirando al ${azFin.toFixed(0)}° (desde el suroeste: hastial oeste y escalera)`);

/* ---------- 2. datos ---------- */
console.log('2. datos');
const LJ = json('data/lugar.json');
ok(HZ.horizonte.length === 360 && HZ.distanciaKm.length === 360 && HZ.horizonte.every(Number.isFinite), 'lugar-horizonte.json: horizonte[360] y distanciaKm[360]');
ok(['lat', 'lon', 'cota', 'alturaOjo'].every((k) => typeof HZ[k] === 'number') && HZ.cimas.length >= 3 && HZ.cimas.every((c) => c.nombre && c.azimut >= 0 && c.azimut < 360), 'lat, lon, cota, alturaOjo y cimas: ' + HZ.cimas.map((c) => c.nombre).join(', '));
ok(HZ.cimas.every((c) => Math.abs(c.altura - HZ.horizonteFino[Math.round(c.azimut * 10) % 3600]) < 0.3), 'cada cima está en el perfil (su altura = la del horizonte en su rumbo)');
ok(LJ.cotaCasa === 960 && Math.abs(LJ.lat - 43.067663) < 0.0002 && Math.abs(LJ.lon + 6.256931) < 0.0002, `lugar.json: cota ${LJ.cotaCasa} m, ${LJ.lat}, ${LJ.lon} (Catastro ${LJ.catastro})`);
const alba = meta.edificios.filter((e) => e.tipo === 'alba');
ok(alba.length === 1 && alba[0].id.startsWith(LJ.catastro) && Math.hypot(alba[0].rect.cx, alba[0].rect.cz) < 2, `la casa (${alba[0] && alba[0].id}) en el centro de la escena, ${alba[0] && alba[0].rect.lu} × ${alba[0] && alba[0].rect.lv} m`);
const usados = new Set(['alturas-valle.png', 'alturas-cerca.png', 'alturas-lejos.png', 'alturas-plano.png']);
Object.values(meta.orto).forEach((o) => Object.values(o.archivos).forEach((f) => usados.add(f)));
const hay = fs.readdirSync(path.join(RAIZ, 'img/lugar'));
ok([...usados].every((f) => hay.includes(f)) && hay.every((f) => usados.has(f)), `img/lugar: están los ${usados.size} ficheros y no sobra ninguno`);
const peso = (fs_) => fs_.reduce((s, f) => s + fs.statSync(path.join(RAIZ, f)).size, 0) / 1048576;
const pAlta = peso(['vendor/three-0.160.0.module.min.js', 'data/lugar-escena.json', ...['valle', 'cerca', 'lejos'].map((k) => 'img/lugar/' + meta.rasters[k].archivo), ...['valle', 'cerca', 'lejos'].map((k) => 'img/lugar/' + meta.orto[k].archivos.alta)]);
const pBaja = peso(['vendor/three-0.160.0.module.min.js', 'data/lugar-escena.json', ...['valle', 'cerca', 'lejos'].map((k) => 'img/lugar/' + meta.rasters[k].archivo), ...['valle', 'cerca', 'lejos'].map((k) => 'img/lugar/' + meta.orto[k].archivos.baja)]);
const pB = peso(['data/lugar-escena.json', 'data/lugar-horizonte.json', 'img/lugar/alturas-plano.png', 'img/lugar/plano-720.webp']);
ok(pAlta < 4.5 && pBaja < 2.6 && pB < 0.6, `pesos: 3D escritorio ${pAlta.toFixed(2)} MB, 3D móvil ${pBaja.toFixed(2)} MB, plan B ${pB.toFixed(2)} MB`);

if (process.argv.includes('--sin-navegador')) { console.log(`\n${bien} bien, ${fallos} mal (sin navegador)`); process.exit(fallos ? 1 : 0); }

/* ---------- 3. plan B en el navegador, sin WebGL ---------- */
console.log('3. plan B en Chromium sin WebGL');
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((z) => srv.listen(PUERTO, z));
const URLP = `http://localhost:${PUERTO}/ref/raw/lugar-prueba.html`;
const browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
const errDe = (page, lista) => {
  page.on('pageerror', (e) => lista.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Lugar/.test(m.text()))) lista.push(m.text()); });
  page.on('requestfailed', (q) => lista.push('falla ' + q.url()));
};
try {
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const ctxB = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctxB.newPage();
    const errores = []; errDe(page, errores);
    await page.goto(URLP + '?hora=10:30&fecha=2026-11-25');
    await page.waitForFunction(() => document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
    await page.locator('#lugar').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('.lugar__marcas .lugar__marca').length > 3 && document.querySelector('[data-l="dia"]').textContent.length > 10, null, { timeout: 8000 });
    await page.waitForFunction(() => { const c = document.querySelector('.lugar__sombra'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true; return false; }, null, { timeout: 8000 });
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-modulo="lugar"]');
      const c = el.querySelector('.lugar__sombra'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sombra = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 60) sombra++;
      const img = el.querySelector('.lugar__mapa img');
      return {
        modo: el.dataset.modo, pista: getComputedStyle(el.querySelector('.lugar__pista')).display !== 'none', lienzo: !!el.querySelector('canvas.lugar__lienzo'),
        img: img.complete && img.naturalWidth > 0, marcas: [...el.querySelectorAll('.lugar__marcas .lugar__marca')].map((m) => m.textContent),
        sombra: sombra / (c.width * c.height), dia: el.querySelector('.lugar__planob [data-l="dia"]').textContent,
        hora: el.querySelector('.lugar__planob [data-l="hora"]').textContent, inst: el.querySelector('.lugar__planob [data-l="instante"]').textContent,
        ratos: el.querySelectorAll('.lugar__planob .lugar__linea-sol rect').length, boton: !el.querySelector('[data-l="a3d"]').hidden,
        ver: !el.querySelector('.lugar__planob [data-l="ver"]').hidden, anchoDoc: document.documentElement.scrollWidth, anchoVista: innerWidth,
      };
    });
    console.log(`   ${w}×${h}`);
    ok(r.modo === 'plano' && !r.pista && !r.lienzo, 'plan B, sin pista y sin lienzo (no se pinta WebGL)');
    ok(r.img && r.marcas.some((m) => m.startsWith('Alba')) && r.marcas.some((m) => m.startsWith('Gúa')), 'el valle desde el aire y sus marcas: ' + r.marcas.join(' · '));
    ok(r.sombra > 0.08 && r.sombra < 0.9, `la sombra de las peñas a las 10:30 del 25-nov cubre el ${(r.sombra * 100).toFixed(0)} % del plano`);
    ok(r.hora === '10:30' && /hacia las 09:55/.test(r.dia) && r.ratos >= 1, `mando a las ${r.hora}; ${r.dia} (${r.ratos} ratos en la línea del día)`);
    ok(/da el sol en la casa/.test(r.inst), 'a las 10:30 del 25-nov: ' + r.inst);
    ok(!r.boton && !r.ver, 'sin botón 3D (no hay WebGL) ni animación (movimiento reducido)');
    ok(r.anchoDoc <= r.anchoVista, `sin scroll horizontal (${r.anchoDoc} ≤ ${r.anchoVista})`);
    // el deslizador: a las 08:45 la casa aún está a la sombra
    const r2 = await page.evaluate(() => {
      const rg = document.querySelector('.lugar__planob [data-l="rango"]');
      rg.value = String(8 * 60 + 45); rg.dispatchEvent(new Event('input', { bubbles: true }));
      return { hora: document.querySelector('.lugar__planob [data-l="hora"]').textContent, inst: document.querySelector('.lugar__planob [data-l="instante"]').textContent, sigue: window.__lugar.estado().sigue };
    });
    ok(r2.hora === '08:45' && /sombra hasta las 09:5/.test(r2.inst) && !r2.sigue, 'el mando a las 08:45: ' + r2.inst);
    if (w === 1280) {
      // COHERENCIA: la sombra de la escena (marcha por los PNG de alturas, como la GPU) contra Alba.sol en la casa
      const co = await page.evaluate(async () => {
        const m = await (await fetch('../../data/lugar-escena.json')).json();
        const dec = async (r) => {
          const b = await (await fetch('../../img/lugar/' + r.archivo)).blob();
          const bmp = await createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
          const W = c.width, H = c.height;
          const at = (x, z) => {
            const fx = Math.max(0, Math.min(W - 1.001, (x - r.x0) / (r.x1 - r.x0) * (W - 1))), fz = Math.max(0, Math.min(H - 1.001, (z - r.z0) / (r.z1 - r.z0) * (H - 1)));
            const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, Hh = (ii, jj) => { const k = (jj * W + ii) * 4; return (d[k] * 256 + d[k + 1]) / 10 - 100; };
            return (Hh(i, j) * (1 - u) + Hh(i + 1, j) * u) * (1 - v) + (Hh(i, j + 1) * (1 - u) + Hh(i + 1, j + 1) * u) * v;
          };
          return { at, W, H, r };
        };
        const v = await dec(m.rasters.valle), c = await dec(m.rasters.cerca);
        const dentro = (r, x, z, b) => x > r.x0 + b && x < r.x1 - b && z > r.z0 + b && z < r.z1 - b;
        const h = (x, z) => dentro(c.r, x, z, 2) ? c.at(x, z) : dentro(v.r, x, z, 0) ? v.at(x, z) : -1e4;
        const S = window.Alba.sol, L = window.Alba.lugar, out = [];
        for (let mes = 1; mes <= 12; mes++) {
          const dia = S.desdeMadrid(2026, mes, 21, 12, 0), of = S.oficial(dia), en = S.entrada(dia);
          let t = +of.orto, enEsc = null;
          for (; t < +of.ocaso; t += 60000) { const p = S.posicion(new Date(t)); if (L.luzEn(h, 0, 0, m.casa.y - h(0, 0) + 4, p.azimut, p.altura, L.RAYO.alta[0], L.RAYO.alta[1], L.RAYO.alta[2]) > 0.02) { enEsc = t; break; } }
          out.push({ mes, sol: en ? +en : null, esc: enEsc });
        }
        return { out, casaPNG: h(0, 0), dims: [v.W, v.H, m.rasters.valle.w, m.rasters.valle.h, c.W, c.H, m.rasters.cerca.w, m.rasters.cerca.h] };
      });
      ok(co.dims[0] === co.dims[2] && co.dims[1] === co.dims[3] && co.dims[4] === co.dims[6] && co.dims[5] === co.dims[7], 'tamaño de los PNG de alturas = el del JSON');
      ok(Math.abs(co.casaPNG - 960) < 1.5, `altura de la casa en el PNG: ${co.casaPNG.toFixed(1)} m`);
      const difs = co.out.map((x) => (x.esc - x.sol) / 60000);
      const peor = Math.max(...difs.map(Math.abs));
      console.log('       entrada en la escena − Alba.sol (min), de enero a diciembre: ' + difs.map((d) => (d > 0 ? '+' : '') + d.toFixed(0)).join(' '));
      ok(co.out.every((x) => x.sol && x.esc) && peor <= 6, `la sombra de la escena llega a la casa a la misma hora que Alba.sol (peor diferencia ${peor.toFixed(0)} min)`);
      const rep = await page.evaluate(() => { window.__lugar.destruir(); const el = document.querySelector('[data-modulo="lugar"]'); return { resp: !!el.querySelector('.respaldo'), clase: el.classList.contains('lugar-mod') }; });
      ok(rep.resp && !rep.clase, 'destruir() repone el HTML de respaldo');
    }
    ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await ctxB.close();
  }

  /* ---------- 4. la escena 3D se construye y se recorre, SIN WebGL ----------
     Three.js real, con un WebGLRenderer falso que no pinta (solo cuenta triángulos y mira que no haya NaN).
     Los shaders (GLSL) NO se compilan aquí: eso solo se ve en el Chrome de Álvaro. */
  console.log('4. escena 3D con renderizador falso (no pinta)');
  const ENVOLTORIO = `import * as T from '/vendor/three-0.160.0.module.min.js?real';
export * from '/vendor/three-0.160.0.module.min.js?real';
export class WebGLRenderer {
  constructor(o) { this.domElement = o.canvas; this.shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    this.capabilities = { getMaxAnisotropy: () => 8 }; this.info = { render: { triangles: 0, calls: 0 } }; this._pr = 1; this._rt = null; window.__pintadas = 0; window.__pases = 0; }
  setPixelRatio(v) { this._pr = v; } getPixelRatio() { return this._pr; } setSize() {} compile() {} setRenderTarget(rt) { this._rt = rt; }
  render(esc, cam) {
    if (this._rt) { window.__pases++; return; }
    window.__pintadas++; let tri = 0, calls = 0;
    esc.updateMatrixWorld();
    esc.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.visible && o.geometry) { calls++; const g = o.geometry; const n = g.index ? g.index.count : g.attributes.position.count; tri += n / 3 * (o.isInstancedMesh ? o.count : 1);
      const pa = g.attributes.position && g.attributes.position.array; if (pa && !window.__nan) { for (let i = 0; i < pa.length; i += 97) if (!Number.isFinite(pa[i])) { window.__nan = (o.name || o.type) + ' ' + i; break; } }
      if (o.isInstancedMesh && !window.__nan) { const a = o.instanceMatrix.array; for (let i = 0; i < o.count * 16; i += 13) if (!Number.isFinite(a[i])) { window.__nan = 'instancias ' + i; break; } } } });
    this.info.render.triangles = tri; this.info.render.calls = calls;
    if (![cam.position.x, cam.position.y, cam.position.z].every(Number.isFinite)) throw new Error('cámara con NaN');
    window.__cam = [cam.position.x, cam.position.y, cam.position.z, cam.near, cam.fov];
  }
  dispose() {} forceContextLoss() {}
}`;
  const fuerza3d = async (ctxB) => {
    await ctxB.route((u) => u.pathname.endsWith('/vendor/three-0.160.0.module.min.js') && !u.search.includes('real'),
      (q) => q.fulfill({ status: 200, contentType: 'text/javascript', body: ENVOLTORIO }));
  };
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await fuerza3d(ctx3);
  const page = await ctx3.newPage();
  const errores = []; errDe(page, errores);
  await page.goto(URLP + '?lugar=3d&hora=09:00&fecha=2026-06-21');
  await page.locator('#lugar').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__lugar && window.__lugar.estado().t3 && window.__pintadas > 0 && window.__lugar.estado().cargado, null, { timeout: 40000 });
  const e0 = await page.evaluate(() => ({ est: window.__lugar.estado(), modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, nan: window.__nan || null, pases: window.__pases,
    listo: document.querySelector('.lugar__escenario').classList.contains('lugar--listo'), hud: document.querySelector('[data-l="ahora3d"]').textContent,
    inst: document.querySelector('.lugar__escenario [data-l="instante"]').textContent }));
  ok(e0.modo === '3d' && e0.listo, 'modo 3D montado; se enseña cuando han llegado las texturas');
  ok(!e0.nan, 'ninguna geometría ni instancia con NaN' + (e0.nan ? ': ' + e0.nan : ''));
  console.log('       triángulos', Math.round(e0.est.t3.triangulos), '· objetos', e0.est.t3.llamadas, '· huecos de la casa', e0.est.t3.ventanas, '· balaustres', e0.est.t3.balaustres, '· edificios del pueblo', e0.est.t3.pueblo);
  ok(e0.est.t3.triangulos > 100000 && e0.est.t3.triangulos < 1500000, 'triángulos en un rango razonable');
  ok(e0.pases >= 2, `la sombra de las peñas se calcula en la GPU (${e0.pases} pases al montar)`);
  ok(/^09:00 en Caunedo/.test(e0.hud) && e0.est.t3.solCasa === 0 && /sombra/.test(e0.inst), `21-jun 09:00: la casa a la sombra en la escena (luz ${e0.est.t3.solCasa}) y en el texto: ${e0.inst}`);
  const e1 = await page.evaluate(() => { const S = window.Alba.sol; window.__lugar.hora(S.desdeMadrid(2026, 6, 21, 9, 40)); return { luz: window.__lugar.estado().t3.solCasa, vis: S.visible(S.desdeMadrid(2026, 6, 21, 9, 40)), pases: window.__pases }; });
  ok(e1.luz === 1 && e1.vis && e1.pases > e0.pases, `a las 09:40 la casa al sol en la escena y en Alba.sol (y se recalcula la sombra: ${e1.pases} pases)`);
  const tramos = [[0, ['Peña Salgada'], 'Desde las cumbres'], [0.5, ['Gúa'], 'El valle'], [0.999, ['Alba'], 'La casa']];
  for (const [pp, esperados, parada] of tramos) {
    await page.evaluate((pp) => { const pista = document.querySelector('.lugar__pista'); const e = document.querySelector('.lugar__escenario');
      const y0 = pista.getBoundingClientRect().top + scrollY; scrollTo(0, y0 + pp * (pista.offsetHeight - e.offsetHeight)); }, pp);
    await page.waitForFunction((pp) => { const t = window.__lugar.estado().t3; return t && Math.abs(t.pVis - pp) < 0.004; }, pp, { timeout: 15000 });
    await page.waitForTimeout(150);
    const q = await page.evaluate(() => ({ rot: [...document.querySelectorAll('.lugar__rotulo.es-visible b')].map((b) => b.textContent), par: (document.querySelector('.lugar__paradas li.es-actual b') || {}).textContent, cam: window.__cam }));
    const faltan = esperados.filter((x) => !q.rot.includes(x));
    ok(faltan.length === 0 && q.par === parada, `p=${pp}: parada «${q.par}», rótulos: ${q.rot.join(' · ') || '(ninguno)'} · cámara a ${q.cam[1].toFixed(0)} m, near ${q.cam[3].toFixed(2)}`);
  }
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  const fuera = await page.evaluate(() => { const a = window.__pintadas; return new Promise((z) => setTimeout(() => z(window.__pintadas - a), 700)); });
  ok(fuera === 0, `fuera de pantalla no pinta (${fuera} fotogramas en 0,7 s)`);
  await page.evaluate(() => document.querySelector('[data-l="aplano"]').click());
  const pl = await page.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden }));
  ok(pl.modo === 'plano' && pl.boton, '«Ver en plano» vuelve al plan B y ofrece volver al 3D');
  const rep = await page.evaluate(() => { window.__lugar.destruir(); return !!document.querySelector('[data-modulo="lugar"] .respaldo') && !document.querySelector('canvas.lugar__lienzo'); });
  ok(rep, 'destruir() con el 3D montado repone el respaldo y quita el lienzo');
  ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await ctx3.close();

  // el móvil: plan B con botón y sin Three.js; al pulsar, monta el 3D
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  await fuerza3d(ctxM);
  let pidioThree = false;
  const pm = await ctxM.newPage();
  pm.on('request', (q) => { if (/three-0\.160/.test(q.url())) pidioThree = true; });
  const erroresM = []; errDe(pm, erroresM);
  await pm.goto(URLP + '?lugar=3d');
  await pm.locator('#lugar').scrollIntoViewIfNeeded();
  await pm.waitForFunction(() => window.__lugar && document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
  await pm.waitForTimeout(300);
  const m0 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden, ver: !document.querySelector('.lugar__planob [data-l="ver"]').hidden, t3: !!window.__lugar.estado().t3 }));
  ok(m0.modo === 'plano' && m0.boton && m0.ver && !m0.t3 && !pidioThree, 'móvil: plan B con el botón «Ver el valle en 3D» y sin pedir Three.js');
  await pm.evaluate(() => document.querySelector('[data-l="a3d"]').click());
  await pm.waitForFunction(() => window.__lugar.estado().t3 && window.__pintadas > 0, null, { timeout: 40000 });
  const m1 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, est: window.__lugar.estado(), ancho: document.documentElement.scrollWidth }));
  ok(m1.modo === '3d' && m1.ancho <= 390, `al pulsar monta el 3D (móvil: ${Math.round(m1.est.t3.triangulos)} triángulos), sin scroll horizontal`);
  // «Ver cómo entra el sol»: anima la hora y acaba después de la entrada
  await pm.evaluate(() => document.querySelector('.lugar__escenario [data-l="ver"]').click());
  await pm.waitForFunction(() => !window.__lugar.estado().sigue && window.Alba.sol.visible(window.__lugar.estado().t), null, { timeout: 12000 });
  ok(true, '«Ver cómo entra el sol» lleva la hora hasta que el sol da en la casa');
  ok(erroresM.length === 0, 'móvil sin errores' + (erroresM.length ? ': ' + erroresM.join(' | ') : ''));
  await ctxM.close();
} finally {
  await browser.close();
  srv.close();
}
console.log(`\n${bien} bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);
