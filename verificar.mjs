/* Verificación de la web de Alba (Playwright, UN navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs            (puerto 8971; todo)
        node verificar.mjs 3 4        (solo esos bloques, para depurar)
   Sin capturas: lo que hay que mirar a ojo va en el README. El 3D NO se pinta: el navegador arranca con
   --disable-3d-apis, la página se abre con ?sin-webgl y js/lugar.js, css/lugar.css y vendor/ se sirven VACÍOS (del 3D solo
   se comprueba que existe su contenedor, que se ve el respaldo y que ningún antepasado rompe su sticky). Las letras, la
   visita virtual y Google Maps se sirven falsos: no se hace ninguna petición de verdad a terceros. Todo va con
   movimiento reducido salvo el bloque 13, una vez y al final. Mide comportamiento, no aspecto. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8971;
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };
const VACIOS = new Set(['/js/lugar.js', '/css/lugar.css']);
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (VACIOS.has(p) || p.startsWith('/vendor/')) { res.writeHead(200, { 'Content-Type': TIPOS[path.extname(p)] || 'text/plain' }); res.end(''); return; }
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-webgl';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle).slice(0, 700) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'alba-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const texto0 = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const D = JSON.parse(leer('data/alba.json'));
const DIST = JSON.parse(leer('data/distancias.json'));
const RUTAS = JSON.parse(leer('ref/raw/rutas.json'));
const tiempoTxt = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min');

// el sol de Lugar, en Node, para comprobar la frase de la portada con el mismo cálculo
const ctx = { console, Intl, URLSearchParams, Math, Date, Promise }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(leer('js/sol.js'), ctx);
const HZ = existe('data/lugar-horizonte.json') ? JSON.parse(leer('data/lugar-horizonte.json')) : JSON.parse(leer('data/horizonte-provisional.json'));
const S = ctx.Alba.sol; S.usar(HZ);
const DIA_PRUEBA = '2026-11-25';
const trPrueba = S.tramos(S.desdeMadrid(2026, 11, 25, 12, 0));

/* ================= 1. archivos (sin navegador) ================= */
if (toca(1)) {
  console.log('\n1. Archivos, textos y contrato');
  const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
  comprobar(['index.html', '404.html', 'aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html'].every((f) => htmls.includes(f)), 'están la página, el 404 y las cuatro legales');
  for (const f of htmls) {
    const s = leer(f);
    comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/.test(s), `${f}: charset lo primero, noindex, nofollow detrás y lang="es"`);
    const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
    comprobar(rep.length === 0 && !/<!--parte:/.test(s) && !/\{\{[A-Z]+\}\}/.test(s) && !/<!--(portada-svg|unidades|servicios|vistazo|visita|fotos-dentro|lugar-respaldo|distancias|resenas|reserva|contacto|creditos|dia-svg|dia-respaldo|datos|frase-respaldo)-->/.test(s), `${f}: sin ids repetidos y con todas las partes`, [...new Set(rep)]);
  }
  comprobar(['.nojekyll', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png', 'img/relieve/somiedo.webp', 'img/relieve/asturias.webp'].every(existe), 'están .nojekyll, manifest, og, favicons y el relieve del mapa');
  const html = leer('index.html');
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r) && !/^(css\/lugar\.css|js\/lugar\.js)$/.test(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza (lugar.css y lugar.js, de Lugar 3D, pueden faltar)`, faltan);
  if (!existe('js/lugar.js') || !existe('css/lugar.css')) nota('aún no están ' + ['css/lugar.css', 'js/lugar.js'].filter((f) => !existe(f)).join(' y ') + ' (Lugar 3D): la página usa el respaldo');
  // fotos: SOLO las publicables: EscapadaRural (provisionales, decisión de Álvaro del 2026-11-25), Sensación Rural y
  // Commons. Nunca de EuroWeb Media (ref/origen/album, galeria, marca), TusCasasRurales ni Turismo Asturias
  const fotosJson = JSON.parse(leer('img/fotos/fotos.json'));
  comprobar(!/ref\/origen|tcr-|ta-AR0291|marca\/(logo|portada|icono-1024)|eurowebmedia\.es\/[^"]*\.(jpe?g|png|webp)/.test(html), 'ninguna foto de EuroWeb Media, TusCasasRurales ni Turismo Asturias en la página');
  comprobar(fotosJson.every((f) => /^Sensación Rural|^Wikimedia Commons|^EscapadaRural/.test(f.origen)) && fotosJson.filter((f) => /^EscapadaRural/.test(f.origen)).every((f) => /^er-[0-9a-f]+\.webp$/.test(f.fuente) && fs.existsSync(path.join(RAIZ, 'ref/origen/portales', f.fuente))), 'img/fotos: solo EscapadaRural (er-*, de los dueños), Sensación Rural y Wikimedia Commons');
  const albumes = ['album', 'galeria', 'marca'].flatMap((d) => (fs.existsSync(path.join(RAIZ, 'ref/origen', d)) ? fs.readdirSync(path.join(RAIZ, 'ref/origen', d)) : []));
  comprobar(fotosJson.every((f) => !albumes.includes(f.fuente || '')), 'ninguna sale de las carpetas de EuroWeb Media');
  const er = fotosJson.filter((f) => /^EscapadaRural/.test(f.origen));
  comprobar(er.length >= 16 && er.length <= 24 && er.every((f) => f.tratamiento && Math.abs(f.tratamiento.giro) <= 3 && f.tratamiento.balance.every((g) => g >= 0.94 && g <= 1.06)), `EscapadaRural: ${er.length} elegidas (16-24), con el tratamiento suave (giro ≤ 3°, balance ±6 %)`);
  comprobar(/fotos provisionales de la ficha del alojamiento en EscapadaRural/i.test(texto0(html)) && /EscapadaRural/.test(html.match(/<div class="pie__creditos">[\s\S]*?<\/div>/)[0]), 'rótulo honesto junto a la galería y EscapadaRural en los créditos del pie');
  comprobar(fotosJson.every((f) => Math.max(...f.anchos) <= f.ancho), 'ninguna foto se sirve por encima de su tamaño original', fotosJson.filter((f) => Math.max(...f.anchos) > f.ancho).map((f) => f.nombre));
  const faltanF = []; for (const f of fotosJson) for (const w of f.anchos) for (const e of ['webp', 'jpg']) if (!existe(`img/fotos/${f.nombre}-${w}.${e}`)) faltanF.push(`${f.nombre}-${w}.${e}`);
  comprobar(faltanF.length === 0, 'cada foto existe en sus anchos, en WebP y JPG', faltanF.slice(0, 5));
  const C = JSON.parse(leer('scripts/commons.json'));
  comprobar(C.every((c) => c.autor && /^CC (BY|BY-SA) [0-9.]+$/.test(c.licencia) && c.pagina.startsWith('https://commons.wikimedia.org/wiki/File:') && html.includes(c.pagina.replace(/&/g, '&amp;'))), 'las fotos de Commons, cada una con autor, licencia libre y su enlace en los créditos del pie');
  // textos
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const alts = [...html.matchAll(/(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]).join(' ');
  comprobar(!/[—–]/.test(texto + alts) && !/[—–]/.test(leer('js/reserva.js') + leer('js/distancias.js') + leer('js/portada.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'ni una raya (— ni –) en el texto, los alt, las etiquetas ni los textos de los módulos');
  comprobar(!/TODO|\[PENDIENTE\]/.test(texto) && !/lorem ipsum/i.test(texto), 'sin TODO ni texto de relleno');
  comprobar(/984 281 837/.test(texto) && /637 544 757/.test(texto) && /apartamentosalba@hotmail\.com/.test(texto) && /33840 Somiedo/.test(texto) && /Vimay Alojamientos, S\. L\./.test(texto) && /AR-291-AS/.test(texto), 'contacto, titular y registro de DATOS');
  comprobar(/WhatsApp, por confirmar/.test(texto) && !/wa\.me|api\.whatsapp/.test(html), 'WhatsApp: «por confirmar», sin enlace');
  comprobar(!/el grande es|apartamento 1 es el|apartamento 4 es el/i.test(texto), 'no se dice cuál es el apartamento grande');
  comprobar(/>4,7</.test(html) && /<span class="cifra">39<\/span> reseñas/.test(html) && /por comprobar en su ficha de Google/.test(texto), 'reseñas: 4,7 con 39 y marcado «por comprobar» (no se pudo leer la ficha de Google)');
  comprobar(!/«[^»]{40,}»/.test(texto), 'sin citas de reseñas (nada entre comillas más largo que un nombre)');
  comprobar(!/<iframe/.test(html), 'ningún iframe en el HTML (la visita y el mapa se crean al pedirlos)');
  comprobar(/<script src="js\/sol\.js[^"]*" defer><\/script>[\s\S]*<script src="js\/main\.js[^"]*" defer><\/script>/.test(html) && /<script src="js\/lugar\.js[^"]*" defer>/.test(html) && /<link rel="stylesheet" href="css\/lugar\.css/.test(html), 'contrato: sol.js antes que main.js, lugar.js con defer y lugar.css en el head');
  comprobar(!/three(\.module)?(\.min)?\.js/.test(html), 'la Web no carga Three.js (lo carga Lugar)');
  comprobar(/<section class="lugar" id="lugar"[\s\S]*?<div data-modulo="lugar">/.test(html), 'el hueco del 3D: <section id="lugar"> con <div data-modulo="lugar"> y su respaldo');
  const base = leer('css/base.css');
  comprobar(['--fondo', '--superficie', '--texto', '--texto-suave', '--marca', '--acento', '--linea', '--letra-titular', '--letra-texto', '--letra-cifras'].every((v) => base.includes(v + ':')) && /#lugar \{[^}]*--fondo:[^}]*--texto:/.test(base), 'variables comunes en base.css y redefinidas para fondo oscuro dentro de #lugar');
  // las distancias de la tabla son las de OSRM (ref/raw/rutas.json), ninguna a ojo
  const tabla = html.match(/<table class="dist__tabla">[\s\S]*?<\/table>/)[0];
  const okD = RUTAS.orden.every((id) => { const s = RUTAS.sitios[id]; if (!s.coche && !s.pie) return true; const t = s.coche ? tiempoTxt(s.coche.minutos) : tiempoTxt(s.pie.minutos); return new RegExp(`data-sitio="${id}"[^\\n]*${t}`).test(tabla); });
  comprobar(okD && (tabla.match(/data-sitio=/g) || []).length === RUTAS.orden.length, `A cuánto queda (sin JS): los ${RUTAS.orden.length} sitios con los minutos de OSRM`);
  comprobar(RUTAS.orden.every((id) => DIST.sitios[id] && (DIST.sitios[id].coche || DIST.sitios[id].pie) && (!DIST.sitios[id].coche || DIST.sitios[id].coche.perfil.m.length > 5)), 'cada sitio tiene su ruta dibujable y su perfil de altura (MDT del IGN)');
  // fuentes: ninguna de la cartera
  const otras = fs.readdirSync(path.join(RAIZ, '..')).filter((d) => d.endsWith('-web') && d !== path.basename(RAIZ));
  const usadas = otras.filter((d) => { const f = path.join(RAIZ, '..', d, 'index.html'); return fs.existsSync(f) && /Darker\+Grotesque|Pathway\+Extreme|Ubuntu\+Sans\+Mono/.test(fs.readFileSync(f, 'utf8')); });
  comprobar(usadas.length === 0, `las tres letras (Darker Grotesque, Pathway Extreme, Ubuntu Sans Mono) no las usa ninguna otra web de la cartera (${otras.length} miradas)`, usadas);
  // la receta de borrado del mando, sobre copias en memoria
  const quitar = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); return i < 0 || j < 0 ? null : s.slice(0, i) + s.slice(j + b.length); };
  const cab = quitar(leer('partes/cabeza.html'), '// MANDO DE MAQUETA', "h.classList.add('densidad-sobria');\n    }");
  const pie = quitar(leer('partes/pie.html'), '<!-- MANDO DE MAQUETA', '<!-- fin del MANDO DE MAQUETA -->');
  const mj = quitar(leer('js/main.js'), '/* ============ 12. MANDO DE MAQUETA', '/* fin del MANDO DE MAQUETA */');
  const css = quitar(leer('css/estilos.css'), '/* MANDO DE MAQUETA', '/* fin del MANDO DE MAQUETA */');
  const restos = Object.entries({ cab, pie, mj, css }).filter(([, s]) => !s || /revision|data-densidad|\.mando\b|id="mando"/.test(s)).map(([k, s]) => k + ': ' + (s ? s.match(/.{0,50}(revision|data-densidad|\.mando\b|id="mando").{0,30}/)[0] : 'sin sus marcas'));
  comprobar(restos.length === 0, 'receta de borrado del mando (README): tras quitar los cuatro bloques no queda rastro', restos);
  let sint = true; try { new vm.Script(mj); } catch (e) { sint = false; }
  comprobar(sint, 'main.js sigue siendo JS válido sin el bloque del mando');
  // las legales: el titular
  for (const f of ['aviso-legal.html', 'privacidad.html']) comprobar(/Vimay Alojamientos, S\. L\./.test(leer(f)) && /B74046673/.test(leer(f)), `${f}: titular y NIF`);
  comprobar(/alba-cookies/.test(leer('cookies.html')) && /EuroWeb Media/.test(leer('cookies.html')) && /Google Maps/.test(leer('cookies.html')), 'cookies.html: la clave local, la visita (EuroWeb Media, Google Analytics) y Google Maps');
}

/* ================= navegador ================= */
const necesitaNav = !SOLO.length || SOLO.some((n) => n > 1);
let browser = null;
const externas = [];
async function nueva(op = {}) {
  const ctxN = await browser.newContext({ viewport: op.viewport || { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: op.movimiento ? 'no-preference' : 'reduce', hasTouch: !!op.touch, isMobile: !!op.movil, locale: 'es-ES', timezoneId: op.zona || 'Europe/Madrid' });
  if (!op.cookies) await ctxN.addInitScript(sinCookies);
  await ctxN.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (u.hostname === 'cdn.eurowebmedia.es') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>visita falsa</title><p>visita falsa</p>' });
    if (u.hostname === 'www.google.com') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>mapa falso</title><p>mapa falso</p>' });
    externas.push(u.href);
    return route.abort();
  });
  const page = await ctxN.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.errores = errores;
  return { ctx: ctxN, page };
}
const ir = async (page, url) => { await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.Alba && window.Alba.web); };
const esperarPortada = (page) => page.waitForFunction(() => document.querySelector('#portada.es-viva'), null, { timeout: 8000 });

if (necesitaNav) {
  browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-gpu', '--disable-webgl'] });
  try {

/* ================= 2. portada a cinco tamaños ================= */
if (toca(2)) {
  console.log('\n2. Portada «Amanece en Alba» (cinco tamaños)');
  for (const [w, hh] of [[360, 640], [375, 667], [390, 844], [768, 1024], [1280, 800]]) {
    const { ctx: c, page } = await nueva({ viewport: { width: w, height: hh }, movil: w < 700, touch: w < 700 });
    await ir(page, PAG + `&fecha=${DIA_PRUEBA}&hora=08:00`);
    await esperarPortada(page);
    const m = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height }; };
      const pe = document.querySelector('.pano__palabra'), pb = pe.getBoundingClientRect(), base = +pe.getAttribute('y') + document.querySelector('#portada').getBoundingClientRect().top;
      const pal = { t: base - 0.74 * +pe.getAttribute('font-size'), b: base, l: pb.left, r: pb.right };
      return { cab: r('#cab'), texto: r('.portada__texto .env'), frase: document.querySelector('#frase-sol').textContent, btn: r('.portada__acc .btn'), pal, portada: r('#portada'), sw: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight, est: window.Alba.web.montados.size };
    });
    const entra = S.haciaLas(trPrueba[0].desde);
    comprobar(m.frase.includes('Hoy el sol entra en la casa hacia las ' + entra), `${w}×${hh}: la frase con la hora real (${entra}, js/sol.js + relieve)`, m.frase);
    comprobar(m.btn && m.btn.b <= m.ih + 1, `${w}×${hh}: «Ver fechas» a la vista sin bajar`, m.btn);
    comprobar(m.pal.t >= m.cab.b - 2 && m.pal.b <= m.texto.t, `${w}×${hh}: «Alba» entre la cabecera y el texto (su línea de base), sin pisarlos`, { pal: m.pal, cab: m.cab.b, texto: m.texto.t });
    comprobar(m.sw <= m.iw, `${w}×${hh}: sin scroll horizontal`, [m.sw, m.iw]);
    comprobar(page.errores.length === 0, `${w}×${hh}: sin errores en la consola`, page.errores);
    await c.close();
  }
  // la frase en cada momento del día de prueba (25-11-2026: dos ratos de sol)
  const { ctx: c, page } = await nueva();
  const casos = [['12:00', /Ahora da el sol en la casa\. Entró hacia las \d\d:\d\d y se va tras las peñas hacia las \d\d:\d\d/], ['13:40', /Ahora lo tapa una peña: vuelve hacia las \d\d:\d\d/], ['21:00', /Mañana el sol entra en la casa hacia las \d\d:\d\d/]];
  if (trPrueba.length < 2) casos.splice(1, 1);
  for (const [h, re] of casos) {
    await ir(page, PAG + `&fecha=${DIA_PRUEBA}&hora=${h}`);
    await esperarPortada(page);
    const f = await page.textContent('#frase-sol');
    comprobar(re.test(f), `frase a las ${h}: ${f}`);
  }
  // sin js/sol.js: el respaldo (la frase del año) y ningún error
  await c.route('**/js/sol.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ir(page, PAG);
  await page.waitForTimeout(300);
  const sinSol = await page.evaluate(() => ({ viva: document.querySelector('#portada.es-viva') !== null, frase: document.querySelector('#frase-sol').textContent, palabra: !!document.querySelector('.pano__palabra') }));
  comprobar(!sinSol.viva && /Según la época del año, el sol entra en la casa entre las \d\d:\d\d y las \d\d:\d\d/.test(sinSol.frase) && sinSol.palabra, 'sin js/sol.js: se queda el dibujo de respaldo y la frase del año (sin inventar la de hoy)', sinSol);
  await c.close();
}

/* ================= 3. la luz: cuatro estados, mando y contraste ================= */
if (toca(3)) {
  console.log('\n3. La luz de la web (alba, día, atardecer, noche) y su contraste');
  const { ctx: c, page } = await nueva();
  const horas = { noche: '03:00', alba: '08:10', dia: '12:00', atardecer: '17:40' };
  for (const [estado, h] of Object.entries(horas)) {
    await ir(page, PAG + `&fecha=${DIA_PRUEBA}&hora=${h}`);
    const luz = await page.getAttribute('html', 'data-luz');
    comprobar(luz === estado, `a las ${h} del ${DIA_PRUEBA} la web está en «${estado}»`, luz);
    // contraste real: cada texto contra el fondo pintado de su caja (sin opacidades)
    const malos = await page.evaluate(() => {
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const v = m.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const fondo = (el) => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; const a = b.match(/[\d.]+/g); if (a && (a.length < 4 || +a[3] > 0.95)) return b; } return getComputedStyle(document.body).backgroundColor; };
      const out = [];
      document.querySelectorAll('main p, main h2, main h3, main dt, main dd, main li, main a, main button, main th, main td, .pie p, .pie a, .pie h2').forEach((el) => {
        if (el.closest('#portada, #lugar, .visita__marco, svg')) return;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const cs = getComputedStyle(el); if (cs.display === 'none') return;
        const a = lum(cs.color), b = lum(fondo(el)); const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
        if (k < (grande ? 3 : 4.5)) out.push(`${el.tagName}.${el.className}: ${k.toFixed(2)} «${el.textContent.trim().slice(0, 30)}»`);
      });
      return out;
    });
    comprobar(malos.length === 0, `«${estado}»: todos los textos llegan a AA contra su fondo (medido en el navegador)`, malos.slice(0, 8));
    const portada = await page.evaluate(() => {
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const v = m.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const k = (a, b) => { a = lum(a); b = lum(b); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      const sonda = (v) => { const i = document.createElement('i'); i.style.color = `var(${v})`; document.querySelector('#portada').append(i); const c = getComputedStyle(i).color; i.remove(); return c; };
      const suelo = sonda('--suelo'), ladera = sonda('--capa-4');
      const fr = getComputedStyle(document.querySelector('.portada__frase')).color, no = getComputedStyle(document.querySelector('.portada__nota')).color;
      return { frase: Math.min(k(fr, suelo), k(fr, ladera)), nota: Math.min(k(no, suelo), k(no, ladera)) };
    });
    comprobar(portada.frase >= 4.5 && portada.nota >= 4.5, `«${estado}»: el texto de la portada sobre el suelo del valle (${portada.frase.toFixed(1)} y ${portada.nota.toFixed(1)})`);
  }
  // el mando de la cabecera
  await ir(page, PAG + `&fecha=${DIA_PRUEBA}&hora=12:00`);
  for (const e of ['noche', 'alba', 'atardecer', 'dia']) {
    await page.click(`#luz button[data-luz="${e}"]`);
    const r = await page.evaluate((e2) => ({ luz: document.documentElement.dataset.luz, pul: document.querySelector(`#luz button[data-luz="${e2}"]`).getAttribute('aria-pressed') }), e);
    comprobar(r.luz === e && r.pul === 'true', `mando de luz: «${e}» cambia la web y queda pulsado`);
  }
  await page.click('#luz button[data-luz="noche"]');
  await page.click('#luz button[data-luz="ahora"]');
  comprobar(await page.getAttribute('html', 'data-luz') === 'dia', '«Ahora» vuelve a la luz real (día a las 12:00)');
  const lugar = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('#lugar')); return cs.backgroundColor; });
  await page.click('#luz button[data-luz="noche"]');
  const lugar2 = await page.evaluate(() => getComputedStyle(document.querySelector('#lugar')).backgroundColor);
  comprobar(lugar === lugar2 && /rgb\(14, 19, 22\)/.test(lugar), '#lugar es oscura y la misma en todos los estados', [lugar, lugar2]);
  // el foco: contorno + medio sol, con contraste contra su fondo
  await page.click('#luz button[data-luz="ahora"]');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await page.waitForTimeout(60);
  const foco = await page.evaluate(() => { const m = document.querySelector('#foco-alba'); return { vis: m.classList.contains('es-visible'), d: m.querySelector('.foco-alba__sol').getAttribute('d'), marco: m.querySelector('.foco-alba__marco').getAttribute('d'), act: document.activeElement.className || document.activeElement.tagName }; });
  comprobar(foco.vis && /A/.test(foco.d || '') && /A/.test(foco.marco || ''), `foco del teclado con forma propia (contorno redondeado y medio sol) en ${foco.act}`, foco);
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 4. la casa ================= */
if (toca(4)) {
  console.log('\n4. La casa: fichas, precios y servicios');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  const r = await page.evaluate(() => ({
    fichas: [...document.querySelectorAll('.unidad')].map((u) => u.querySelector('.unidad__precios').textContent.replace(/\s+/g, ' ').trim()),
    serv: document.querySelectorAll('.servicios__lista li').length,
    iconos: [...document.querySelectorAll('.servicios__lista use')].every((u) => document.querySelector(u.getAttribute('href'))),
    fachada: !!document.querySelector('.casa__dibujo svg.fachada title'),
    cota: document.querySelector('.casa__cifras').textContent.replace(/\s+/g, ' '),
  }));
  comprobar(/60 €.*70 €/.test(r.fichas[0]) && /100 €.*120 €/.test(r.fichas[1]), 'fichas con su tarifa oficial: 60/70 € (para 2 a 4) y 100/120 € (para 4 a 5)', r.fichas);
  comprobar(r.serv === D.servicios.length && r.iconos, `servicios: ${r.serv}, cada uno con su icono propio`);
  comprobar(r.fachada, 'la fachada dibujada, con su descripción');
  const lj = JSON.parse(leer('data/lugar.json'));
  comprobar(r.cota.includes(String(Math.round(lj.cotaCasa))), `la cota de la casa es la de data/lugar.json (${Math.round(lj.cotaCasa)} m)`);
  // «Ver fechas» de la ficha grande elige el grande en el simulador
  await page.click('.unidad--grande [data-reservar]');
  await page.waitForFunction(() => document.querySelector('.sim.es-montado'), null, { timeout: 5000 });
  const pul = await page.getAttribute('.sim__tipo[data-unidad="grande"]', 'aria-pressed');
  comprobar(pul === 'true', '«Ver fechas» del apartamento para 4 a 5 lo deja elegido en el simulador');
  await c.close();
}

/* ================= 5. por dentro: la visita ================= */
if (toca(5)) {
  console.log('\n5. Por dentro: la visita virtual a petición y la galería por estancias');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  const antes = await page.evaluate(() => ({ ifr: document.querySelectorAll('iframe').length, aviso: document.querySelector('.visita__aviso').textContent, guia: document.querySelectorAll('.visita__lista li').length }));
  comprobar(antes.ifr === 0 && /contenido externo/.test(antes.aviso) && /cookies/.test(antes.aviso), 'sin iframe hasta pedirlo, con el aviso de contenido externo y cookies junto al botón');
  comprobar(antes.guia === 4, 'la guía de las nueve vistas por apartamento');
  await page.click('#visita-btn');
  const src = await page.getAttribute('#visita-marco iframe', 'src');
  comprobar(/cdn\.eurowebmedia\.es\/docs\/visitas-virtuales\/0000141572\/index\.html/.test(src || ''), 'al pulsar se crea el iframe de su visita (Pano2VR de EuroWeb Media)', src);
  // la galería por estancias
  const G = JSON.parse(leer('data/fotos.json'));
  const nombres = G.estancias.flatMap((e) => e.fotos.map((x) => x.n));
  const gal = await page.evaluate(() => ({ n: document.querySelectorAll('.estancias .foto-btn').length, est: [...document.querySelectorAll('.estancias__indice a')].map((a) => a.dataset.est), cur: document.querySelector('.estancias__indice a[aria-current="true"]').dataset.est, aviso: document.querySelector('.galeria__aviso').textContent, marcos: [...document.querySelectorAll('.foto-btn')].some((b) => parseFloat(getComputedStyle(b).borderTopWidth) > 0) }));
  comprobar(gal.n === nombres.length && gal.est.length === G.estancias.length && !gal.marcos, `galería: ${gal.n} fotos en ${gal.est.length} estancias (${gal.est.join(', ')}), sin marcos`);
  comprobar(/provisionales/.test(gal.aviso) && /EscapadaRural/.test(gal.aviso), 'el rótulo de fotos provisionales junto a la galería');
  // alturas igualadas por fila: las fotos de una misma fila miden lo mismo de alto
  const filas = await page.evaluate(() => [...document.querySelectorAll('.filas')].map((f) => { const por = {}; [...f.children].forEach((x) => { const r = x.getBoundingClientRect(); const k = Math.round(r.top); (por[k] = por[k] || []).push(Math.round(r.height)); }); return Object.values(por).filter((v) => v.length > 1).map((v) => Math.max(...v) - Math.min(...v)); }).flat());
  comprobar(filas.every((d) => d <= 2), 'en cada fila, todas las fotos con la misma altura', filas);
  // el índice marca la estancia que se ve
  await page.click('.estancias__indice a[data-est="banos"]');
  await page.waitForFunction(() => document.querySelector('.estancias__indice a[aria-current="true"]').dataset.est === 'banos', null, { timeout: 4000 }).catch(() => {});
  const cur2 = await page.evaluate(() => ({ cur: document.querySelector('.estancias__indice a[aria-current="true"]').dataset.est, tit: document.querySelector('#t-est-banos').getBoundingClientRect().top, ind: document.querySelector('.estancias__indice').getBoundingClientRect().bottom, cab: document.querySelector('#cab').getBoundingClientRect().bottom }));
  comprobar(cur2.cur === 'banos' && cur2.tit >= cur2.cab, 'el índice lleva a «Baños», lo marca y el título queda a la vista bajo la cabecera', cur2);
  // pulsar CADA miniatura: el visor lleva su MISMO nombre (y la grande llega después)
  const malos = [];
  for (const n of nombres) {
    await page.click(`.foto-btn[data-visor="${n}"]`);
    const v = await page.evaluate(() => ({ open: document.querySelector('#visor').open, n: document.querySelector('#visor-img').dataset.nombre, src: document.querySelector('#visor-img').getAttribute('src') }));
    if (!v.open || v.n !== n || !v.src.includes('/' + n + '-')) malos.push({ n, v });
    await page.keyboard.press('Escape');
  }
  comprobar(malos.length === 0, `escritorio: cada una de las ${nombres.length} miniaturas abre el visor con su misma foto`, malos.slice(0, 4));
  await page.click(`.foto-btn[data-visor="cocina-buhardilla"]`);
  await page.waitForFunction(() => /-1600\.webp$/.test(document.querySelector('#visor-img').getAttribute('src')), null, { timeout: 5000 }).catch(() => {});
  const vis = await page.evaluate(() => { const i = document.querySelector('#visor-img'); return { src: i.getAttribute('src'), w: i.getBoundingClientRect().width, max: parseFloat(i.style.maxWidth) }; });
  comprobar(/cocina-buhardilla-1600\.webp$/.test(vis.src) && vis.w <= vis.max + 1, 'el visor pone la grande al cargar y nunca la enseña por encima de su tamaño real', vis);
  await page.keyboard.press('ArrowRight');
  const sig = await page.evaluate(() => document.querySelector('#visor-img').dataset.nombre);
  comprobar(sig === nombres[nombres.indexOf('cocina-buhardilla') + 1], `flecha derecha: la siguiente de la serie (${sig})`);
  await page.keyboard.press('Escape');
  // ninguna miniatura se ve más grande que su tamaño real ni se sirve con un archivo más ancho que el original
  const tam = await page.evaluate(() => [...document.querySelectorAll('.estancias img')].map((i) => ({ n: i.alt.slice(0, 20), w: i.getBoundingClientRect().width, nat: +i.getAttribute('width'), cur: i.currentSrc })));
  comprobar(tam.every((t) => t.w <= t.nat + 1) && tam.every((t) => !/-1600\./.test(t.cur)), 'miniaturas: nunca por encima de su tamaño real y sin pedir la de 1600 (esa es solo del visor)', tam.filter((t) => t.w > t.nat + 1 || /-1600\./.test(t.cur)).slice(0, 3));
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
  // móvil: tap en CADA miniatura, y nada encima de los botones ‹ › (abajo, en toda su altura)
  const { ctx: c2, page: p2 } = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true });
  await ir(p2, PAG);
  const malosM = [];
  for (const n of nombres) {
    await p2.locator(`.foto-btn[data-visor="${n}"]`).scrollIntoViewIfNeeded();
    await p2.tap(`.foto-btn[data-visor="${n}"]`);
    const v = await p2.evaluate(() => ({ open: document.querySelector('#visor').open, n: document.querySelector('#visor-img').dataset.nombre }));
    if (!v.open || v.n !== n) malosM.push({ n, v });
    await p2.tap('#visor-cerrar');
  }
  comprobar(malosM.length === 0, `móvil: cada una de las ${nombres.length} miniaturas, con el dedo, abre su misma foto`, malosM.slice(0, 4));
  await p2.tap(`.foto-btn[data-visor="dormitorio-blanco"]`);
  const enc = await p2.evaluate(() => ['#visor-ant', '#visor-sig'].map((s) => { const b = document.querySelector(s), r = b.getBoundingClientRect(); return [0.25, 0.5, 0.75, 0.9].every((k) => { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * k); return e && b.contains(e); }); }));
  comprobar(enc.every(Boolean), 'móvil: nada pisa los botones ‹ › del visor (a 25, 50, 75 y 90 % de su alto)', enc);
  const bAnt = await p2.locator('#visor-ant').boundingBox();
  await p2.touchscreen.tap(bAnt.x + bAnt.width / 2, bAnt.y + bAnt.height * 0.88);
  const ant = await p2.evaluate(() => document.querySelector('#visor-img').dataset.nombre);
  comprobar(ant === nombres[nombres.indexOf('dormitorio-blanco') - 1], `móvil: tocar ‹ por abajo pasa a la anterior (${ant})`);
  comprobar(p2.errores.length === 0, 'móvil: sin errores en la consola', p2.errores);
  await c2.close();
  // sin JS: la galería es una rejilla simple de fotos que enlazan a la grande
  const c3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: false, reducedMotion: 'reduce' });
  await c3.route('**/*', (r) => (new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort()));
  const p3 = await c3.newPage();
  await p3.goto(PAG);
  const sinJs = await p3.evaluate(() => { const a = [...document.querySelectorAll('.estancias .foto-btn')]; return { n: a.length, ok: a.every((x) => /^img\/fotos\/.+\.jpg$/.test(x.getAttribute('href'))), vis: a.filter((x) => x.getBoundingClientRect().height > 40).length }; });
  comprobar(sinJs.n === nombres.length && sinJs.ok && sinJs.vis === nombres.length, 'sin JS: las fotos se ven en su rejilla y cada una enlaza a su versión grande', sinJs);
  await c3.close();
}

/* ================= 6. el hueco del 3D ================= */
if (toca(6)) {
  console.log('\n6. «El alba, hoy»: contenedor y respaldo (sin pintar WebGL)');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  await page.evaluate(() => document.querySelector('#lugar').scrollIntoView());
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const el = document.querySelector('#lugar [data-modulo="lugar"]');
    const malos = [];
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowY) || cs.transform !== 'none' || cs.filter !== 'none') malos.push(e.tagName + '.' + e.className); }
    const filas = el.querySelectorAll('.lugar__tabla tbody tr').length;
    const vis = el.getBoundingClientRect().height > 100;
    return { malos, filas, vis, canvas: !!el.querySelector('canvas') };
  });
  comprobar(r.vis && r.filas === 12, 'el respaldo se ve: el sol en la casa el día 21 de cada mes (12 filas)');
  comprobar(r.malos.length === 0, 'ningún antepasado del 3D lleva overflow, transform ni filter (su sticky)', r.malos);
  comprobar(!r.canvas, 'no se ha pintado nada de WebGL');
  await c.close();
}

/* ================= 7. a cuánto queda ================= */
if (toca(7)) {
  console.log('\n7. A cuánto queda: el mapa, las rutas reales, los mandos, teclado y táctil');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG);
  await page.evaluate(() => document.querySelector('#distancias').scrollIntoView());
  await page.waitForFunction(() => document.querySelector('.dist__app[data-montado]'), null, { timeout: 6000 });
  const n = await page.locator('.dist__item').count();
  comprobar(n === RUTAS.orden.length, `la lista: ${n} sitios`);
  await page.click('.dist__item[data-sitio="lagovalle"]');
  const lv = DIST.sitios.lagovalle;
  const f1 = await page.evaluate(() => ({ ficha: document.querySelector('.dist__ficha').textContent.replace(/\s+/g, ' '), rutas: [...document.querySelectorAll('.mapa__ruta')].map((p) => p.getAttribute('class')), perfil: !!document.querySelector('.ficha__perfil svg path.perfil__linea'), foto: document.querySelector('.ficha__foto img') && document.querySelector('.ficha__foto img').alt, vb: document.querySelector('.dist__mapa svg').getAttribute('viewBox') }));
  comprobar(f1.rutas.length === 2 && f1.rutas[1].includes('mapa__ruta--pie'), 'Lago del Valle: se dibuja en coche hasta Valle de Lago y luego a pie', f1.rutas);
  comprobar(f1.ficha.includes(`${lv.coche.minutos}min`) && f1.ficha.includes('1 h ' + String(lv.pie.minutos % 60).padStart(2, '0')) && f1.perfil, `la ficha: ${lv.coche.minutos} min en coche, ${lv.pie.minutos} min a pie (OSRM) y el perfil de altura`, f1.ficha.slice(0, 220));
  comprobar(/lago del Valle/i.test(f1.foto || ''), 'con su foto de Commons y su crédito');
  await page.click('.dist__item[data-sitio="oviedo"]');
  const vb2 = await page.getAttribute('.dist__mapa svg', 'viewBox');
  comprobar(+vb2.split(' ')[2] > +f1.vb.split(' ')[2] * 2, 'al elegir Oviedo el mapa se aleja para que quepa la carretera', [f1.vb, vb2]);
  // el tiempo: «1 hora» en coche enciende lo que queda a 60 min o menos (ida)
  await page.click('.seg button[data-lim="60"]');
  const ida = (s, modo) => (modo === 'pie' ? (s.pie && s.pie.desde === 'casa' ? s.pie.minutos : null) : (s.coche ? s.coche.minutos + (s.partida && s.pie ? s.pie.minutos : 0) : null));
  const esperados = RUTAS.orden.filter((id) => { const m = ida(DIST.sitios[id], 'coche'); return m !== null && m <= 60; });
  const dentro = await page.evaluate(() => [...document.querySelectorAll('.dist__item:not(.es-fuera)')].map((b) => b.dataset.sitio));
  comprobar(JSON.stringify(dentro.sort()) === JSON.stringify(esperados.sort()), `«Tengo 1 hora» en coche: ${esperados.length} sitios encendidos (los de ≤ 60 min de ida)`, { dentro, esperados });
  await page.click('.seg button[data-modo="pie"]');
  await page.click('.seg button[data-lim="0"]');
  const aPie = await page.evaluate(() => [...document.querySelectorAll('.dist__item:not(.es-fuera)')].map((b) => b.dataset.sitio));
  const espPie = RUTAS.orden.filter((id) => ida(DIST.sitios[id], 'pie') !== null);
  comprobar(JSON.stringify(aPie.sort()) === JSON.stringify(espPie.sort()), `a pie, desde la puerta: ${espPie.join(', ')}`, aPie);
  // teclado: flechas por la lista y Enter elige
  await page.focus('.dist__item[data-sitio="mumian"]');
  await page.keyboard.press('ArrowDown');
  const foco = await page.evaluate(() => document.activeElement.dataset.sitio);
  await page.keyboard.press('Enter');
  const sel = await page.evaluate(() => document.querySelector('.dist__item[aria-pressed="true"]').dataset.sitio);
  comprobar(foco === RUTAS.orden[1] && sel === foco, `teclado: flecha abajo pasa a «${foco}» y Enter lo elige`);
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
  // táctil: tocar un sitio del mapa
  const { ctx: c2, page: p2 } = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true });
  await ir(p2, PAG);
  await p2.evaluate(() => document.querySelector('#distancias').scrollIntoView());
  await p2.waitForFunction(() => document.querySelector('.dist__app[data-montado]'), null, { timeout: 6000 });
  await p2.locator('.mapa__sitio[data-sitio="pola"] circle').scrollIntoViewIfNeeded();
  await p2.locator('.mapa__sitio[data-sitio="pola"] circle').tap({ force: true });
  const tocado = await p2.evaluate(() => document.querySelector('.dist__item[aria-pressed="true"]') && document.querySelector('.dist__item[aria-pressed="true"]').dataset.sitio);
  comprobar(tocado === 'pola', 'táctil: tocar Pola de Somiedo en el mapa lo elige', tocado);
  const sw = await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  comprobar(sw, 'móvil: sin scroll horizontal con el mapa');
  await c2.close();
  // si fallan los datos, se queda la tabla
  const { ctx: c3, page: p3 } = await nueva();
  await c3.route('**/data/distancias.json', (r) => r.abort());
  await ir(p3, PAG);
  await p3.evaluate(() => document.querySelector('#distancias').scrollIntoView());
  await p3.waitForTimeout(600);
  const t = await p3.evaluate(() => ({ filas: document.querySelectorAll('#distancias .dist__tabla tbody tr').length, montado: !!document.querySelector('.dist__app.es-montado') }));
  comprobar(t.filas === RUTAS.orden.length && !t.montado, 'si no llegan los datos del mapa, se queda la tabla entera', t);
  await c3.close();
}

/* ================= 8. el simulador ================= */
if (toca(8)) {
  console.log('\n8. Reservar: el simulador (precios reales, disponibilidad simulada y marcada)');
  const { ctx: c, page } = await nueva();
  await ir(page, PAG + `&fecha=${DIA_PRUEBA}&hora=12:00`);
  await page.evaluate(() => document.querySelector('#reservar').scrollIntoView());
  await page.waitForFunction(() => document.querySelector('.sim.es-montado'), null, { timeout: 5000 });
  const aviso = await page.evaluate(() => { const a = document.querySelector('.sim__aviso'); const r = a.getBoundingClientRect(); return { t: a.textContent, vis: r.height > 20 }; });
  comprobar(aviso.vis && /Simulación/.test(aviso.t) && /de ejemplo/.test(aviso.t), 'el aviso «Simulación… días ocupados de ejemplo» se ve encima del calendario');
  const ocup = await page.locator('.cal__dia.es-ocupado').count();
  comprobar(ocup > 0, `hay días ocupados de ejemplo en el calendario (${ocup} a la vista)`);
  // elegir dos días libres seguidos de cuatro noches en diciembre (o los primeros que se puedan)
  await page.click('.sim__tipo[data-unidad="pequeno"]');
  const par = await page.evaluate(() => {
    const libres = [...document.querySelectorAll('.cal__dia:not([aria-disabled])')].map((b) => +b.dataset.t);
    const ocup = new Set([...document.querySelectorAll('.cal__dia.es-ocupado')].map((b) => +b.dataset.t));
    for (const a of libres) { let ok = true; for (let k = 0; k < 4; k++) if (ocup.has(a + k * 864e5) || !libres.includes(a + k * 864e5)) ok = false; if (ok) return [a, a + 4 * 864e5]; }
    return null;
  });
  comprobar(!!par, 'hay cuatro noches libres seguidas en los dos meses a la vista');
  if (par) {
    await page.click(`.cal__dia[data-t="${par[0]}"]`);
    await page.click(`.cal__dia[data-t="${par[1]}"]`);
    const res = await page.evaluate((p) => {
      const A = window.Alba.reserva;
      let alta = 0; for (let t = p[0]; t < p[1]; t += 864e5) if (A._alta(t)) alta++;
      return { alta, total: document.querySelector('.res__total b').textContent, cancel: document.querySelectorAll('.res__cancel li').length, mail: document.querySelector('.res__acc a[href^="mailto:"]').getAttribute('href'), wa: document.querySelector('.res__wa').textContent };
    }, par);
    const u = D.unidades[0], total = res.alta * u.precios.alta + (4 - res.alta) * u.precios.baja;
    comprobar(res.total.replace(/\D/g, '') === String(total), `4 noches (${res.alta} de alta): ${total} € con su tarifa oficial`, res.total);
    comprobar(res.cancel >= 2, 'la política de cancelación, con fechas para esa llegada');
    comprobar(/^mailto:apartamentosalba@hotmail\.com\?subject=Solicitud/.test(res.mail) && /de%20ejemplo/.test(res.mail), 'prepara el correo de solicitud (con el aviso de que la disponibilidad es de ejemplo)');
    comprobar(/WhatsApp: por confirmar/.test(res.wa), 'WhatsApp: por confirmar');
  }
  // un día ocupado no se puede elegir de llegada
  await page.click('.sim__tipo[data-unidad="pequeno"]');
  const oc = await page.$('.cal__dia.es-ocupado[aria-disabled="true"]');
  if (oc) { await oc.click({ force: true }); const msg = await page.textContent('.cal__msg'); comprobar(/ocupado/.test(msg), 'un día ocupado avisa y no se elige', msg); }
  // temporada alta: julio y agosto, y Semana Santa de 2027 (Domingo de Ramos, 21 de marzo)
  const alta = await page.evaluate(() => { const A = window.Alba.reserva, f = A._f; return [A._alta(f(2027, 6, 15)), A._alta(f(2027, 7, 1)), A._alta(f(2027, 2, 21)), A._alta(f(2027, 2, 28)), A._alta(f(2027, 2, 29)), A._alta(f(2027, 1, 10)), A._alta(f(2026, 11, 24)), A._alta(f(2027, 0, 6))]; });
  comprobar(JSON.stringify(alta) === JSON.stringify([true, true, true, true, false, false, true, true]), 'temporada alta: julio, agosto, Semana Santa (Ramos a Pascua) y Navidades; el resto, baja', alta);
  // teclado en el calendario: una parada y flechas
  const nTab = await page.locator('.cal__dia[tabindex="0"]').count();
  await page.focus('.cal__dia[tabindex="0"]');
  const t0 = await page.evaluate(() => +document.activeElement.dataset.t);
  await page.keyboard.press('ArrowRight');
  const t1 = await page.evaluate(() => +document.activeElement.dataset.t);
  comprobar(nTab === 1 && t1 - t0 === 864e5, 'calendario: una sola parada de tabulación y las flechas mueven el día');
  comprobar(externas.length === 0, 'no ha salido ninguna petición a terceros', externas.slice(0, 5));
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 9. cookies, mapa y mando ================= */
if (toca(9)) {
  console.log('\n9. Cookies, el mapa a petición y el mando de densidades');
  const { ctx: c, page } = await nueva({ cookies: true });
  await ir(page, PAG);
  const v1 = await page.evaluate(() => { const k = document.querySelector('#cookies'); return !k.hidden && getComputedStyle(k).display === 'flex'; });
  comprobar(v1, 'visita nueva: el aviso de cookies se ve');
  await page.click('#ck-si');
  const v2 = await page.evaluate((L) => ({ oculto: document.querySelector('#cookies').hidden && getComputedStyle(document.querySelector('#cookies')).display === 'none', clave: localStorage.getItem(L) }), LLAVE);
  comprobar(v2.oculto && v2.clave === 'si', '«Entendido» lo cierra de verdad y guarda alba-cookies');
  await page.reload(); await page.waitForFunction(() => window.Alba && window.Alba.web);
  comprobar(await page.evaluate(() => document.querySelector('#cookies').hidden), 'al recargar ya no sale');
  comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'el mapa de Google no existe hasta pulsar');
  await page.click('#mapa-btn');
  const msrc = await page.getAttribute('#mapa iframe', 'src');
  comprobar(/google\.com\/maps\?q=.*output=embed/.test(msrc || ''), 'al pulsar: Google Maps sin clave (output=embed)');
  const sinRev = await page.evaluate(() => { const m = document.querySelector('#mando'); return m.hidden && getComputedStyle(m).display === 'none'; });
  comprobar(sinRev, 'sin ?revision, el mando no existe a la vista');
  await c.close();
  const { ctx: c2, page: p2 } = await nueva({ cookies: true });
  await ir(p2, PAG + `&revision&fecha=${DIA_PRUEBA}&hora=21:00`);
  comprobar(await p2.evaluate(() => document.querySelector('#mando').hidden), '?revision: el mando se aparta mientras está el aviso de cookies');
  await p2.click('#ck-si');
  comprobar(await p2.evaluate(() => !document.querySelector('#mando').hidden), '…y aparece al cerrarlo');
  await esperarPortada(p2);
  await p2.click('#mando button[data-densidad="sobria"]');
  await p2.waitForFunction(() => document.querySelector('#portada.es-viva'), null, { timeout: 6000 });
  const sob = await p2.evaluate(() => ({ cls: document.documentElement.classList.contains('densidad-sobria'), luz: document.documentElement.dataset.luz, luzPortada: document.querySelector('#portada').dataset.luz, cifras: getComputedStyle(document.querySelector('.portada__cifras')).display, entra: document.querySelector('[data-hoy="entra"]').textContent, vistazo: getComputedStyle(document.querySelector('#vistazo')).display, slider: document.querySelector('.portada__lienzo').getAttribute('role'), sw: document.documentElement.scrollWidth <= innerWidth }));
  comprobar(sob.cls && sob.luz === 'dia' && sob.luzPortada === 'noche', 'Sobria: la página se queda de día y la portada lleva la luz de ahora (noche a las 21:00)', sob);
  comprobar(sob.cifras === 'grid' && /\d\d:\d\d/.test(sob.entra) && sob.vistazo === 'block', 'Sobria AÑADE el día de hoy en cifras y la tabla «De un vistazo»', sob);
  comprobar(sob.slider === null && sob.sw, 'Sobria: sin gesto en la portada y sin scroll horizontal');
  await p2.click('#mando button[data-densidad="amanece"]');
  await p2.waitForFunction(() => document.querySelector('#portada.es-viva'), null, { timeout: 6000 });
  const vuelta = await p2.evaluate(() => ({ cls: document.documentElement.classList.contains('densidad-sobria'), luz: document.documentElement.dataset.luz, vistazo: getComputedStyle(document.querySelector('#vistazo')).display }));
  comprobar(!vuelta.cls && vuelta.luz === 'noche' && vuelta.vistazo === 'none', '«Amanece» vuelve: toda la web de noche y sin la tabla', vuelta);
  await c2.close();
}

/* ================= 10. móvil ================= */
if (toca(10)) {
  console.log('\n10. Móvil: menú, barra del navegador y anchos');
  const { ctx: c, page } = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true });
  await ir(page, PAG);
  await esperarPortada(page);
  await page.evaluate(() => scrollTo(0, 600));
  await page.waitForTimeout(100);
  await page.tap('#menu-btn');
  const m = await page.evaluate(() => { const e = document.querySelector('#menu-movil'); const r = e.getBoundingClientRect(); return { exp: document.querySelector('#menu-btn').getAttribute('aria-expanded'), h: r.height, ih: innerHeight, vis: getComputedStyle(e).visibility }; });
  comprobar(m.exp === 'true' && Math.abs(m.h - m.ih) < 2 && m.vis === 'visible', 'el menú se abre a toda la altura (100dvh) con la cabecera ya fija', m);
  await page.tap('#menu-btn');
  comprobar(await page.getAttribute('#menu-btn', 'aria-expanded') === 'false', 'y se cierra con el mismo botón');
  // la barra del navegador: cambiar solo el alto no rehace nada
  await page.addStyleTag({ content: '.portada{min-height:844px!important}' });
  await page.evaluate(() => { window.__res = 0; document.addEventListener('alba:resize', () => window.__res++); scrollTo(0, 1400); });
  const top0 = await page.evaluate(() => document.querySelector('#dentro').getBoundingClientRect().top);
  for (const hh of [900, 844, 900, 844]) { await page.setViewportSize({ width: 390, height: hh }); await page.waitForTimeout(260); }
  const r = await page.evaluate(() => ({ res: window.__res, top: document.querySelector('#dentro').getBoundingClientRect().top }));
  comprobar(r.res === 0 && Math.abs(r.top - top0) < 1, 'la barra del móvil (solo cambia el alto) no rehace nada ni mueve la página', { ...r, top0 });
  for (const w of [360, 412]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(300);
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    comprobar(sw[0] <= sw[1], `${w} px: sin scroll horizontal`, sw);
  }
  const botones = await page.evaluate(() => [...document.querySelectorAll('main a.btn, main button, .cab button, .cab a.btn')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && r.height && getComputedStyle(b).visibility !== 'hidden'; }).filter((b) => b.getBoundingClientRect().height < 32).map((b) => b.textContent.trim().slice(0, 20) || b.getAttribute('aria-label')));
  comprobar(botones.length === 0, 'móvil: ningún botón de menos de 32 px de alto', botones);
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 11. legales y 404 en el navegador ================= */
if (toca(11)) {
  console.log('\n11. Legales y 404');
  const { ctx: c, page } = await nueva();
  for (const f of ['aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html', '404.html']) {
    await page.goto(BASE + f);
    const r = await page.evaluate(() => ({ h1: document.querySelector('h1') && document.querySelector('h1').textContent, sw: document.documentElement.scrollWidth <= innerWidth }));
    comprobar(!!r.h1 && r.sw, `${f}: se abre con su título («${r.h1}»)`);
  }
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

/* ================= 12. rendimiento (móvil de gama media emulado, escala 1) ================= */
if (toca(12)) {
  console.log('\n12. Rendimiento: LCP y tareas largas (CPU ×4, red 4G lenta)');
  const { ctx: c, page } = await nueva({ viewport: { width: 412, height: 915 }, movil: true, touch: true });
  const cdp = await c.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await page.addInitScript(() => {
    window.__lcp = 0; window.__lcpEl = ''; window.__largas = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lcp = e.startTime; window.__lcpEl = (e.element && (e.element.className && e.element.className.baseVal !== undefined ? e.element.className.baseVal : e.element.className)) || (e.element && e.element.tagName) || ''; } }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__largas.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(PAG, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), el: window.__lcpEl, largas: window.__largas }));
  nota(`LCP ${r.lcp} ms (${r.el}); tareas largas: ${JSON.stringify(r.largas)}`);
  comprobar(r.lcp > 0 && r.lcp <= 2500, `LCP ≤ 2,5 s en móvil de gama media emulado (${r.lcp} ms)`);
  await c.close();
}

/* ================= 13. con movimiento (una vez, al final) ================= */
if (toca(13)) {
  console.log('\n13. Con movimiento: el gesto de la portada (táctil real por CDP), el pie que se completa y la recarga');
  const { ctx: c, page } = await nueva({ viewport: { width: 390, height: 844 }, movil: true, touch: true, movimiento: true });
  await ir(page, PAG + `&fecha=${DIA_PRUEBA}&hora=10:30`);
  await esperarPortada(page);
  const cdp = await c.newCDPSession(page);
  const t0 = await page.evaluate(() => window.Alba.web.montados.get(document.querySelector('[data-modulo="portada"]')).inst.estado().tVista);
  const ta = await page.evaluate(() => getComputedStyle(document.querySelector('.portada__lienzo')).touchAction);
  const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await toque('touchStart', 120, 300);
  for (let k = 1; k <= 8; k++) { await toque('touchMove', 120 + k * 20, 302); await page.waitForTimeout(16); }
  const medio = await page.evaluate(() => { const e = window.Alba.web.montados.get(document.querySelector('[data-modulo="portada"]')).inst.estado(); return { t: e.tVista, arr: document.querySelector('#portada').classList.contains('es-arrastre'), lectura: document.querySelector('#portada-hora').textContent }; });
  await toque('touchEnd');
  comprobar(ta === 'pan-y' && medio.t > t0 + 30 * 60000 && medio.arr && /\d\d:\d\d/.test(medio.lectura), `arrastrar a la derecha adelanta la hora del sol (${Math.round((medio.t - t0) / 60000)} min; «${medio.lectura}») sin robar el scroll vertical (touch-action: pan-y)`, { ta, medio });
  await page.waitForFunction(() => !document.querySelector('#portada').classList.contains('es-arrastre'), null, { timeout: 5000 }).catch(() => {});
  const t2 = await page.evaluate(() => window.Alba.web.montados.get(document.querySelector('[data-modulo="portada"]')).inst.estado().tVista);
  comprobar(Math.abs(t2 - t0) < 2 * 60000, 'al soltar, el sol vuelve solo a la hora de ahora');
  // vertical: el dedo hacia arriba baja la página
  await toque('touchStart', 200, 600);
  for (let k = 1; k <= 8; k++) { await toque('touchMove', 201, 600 - k * 40); await page.waitForTimeout(16); }
  await toque('touchEnd');
  await page.waitForTimeout(400);
  comprobar(await page.evaluate(() => scrollY > 50), 'el gesto vertical en la portada hace scroll de la página');
  // el pie: el día se completa al llegar (el trazo de sol se dibuja y el sol acaba donde se va)
  await page.evaluate(() => document.querySelector('#pie').scrollIntoView());
  await page.waitForFunction(() => document.querySelector('.pie__dia.es-completo'), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2900);
  const pie = await page.evaluate(() => { const l = document.querySelector('.dia__luz'); return { comp: document.querySelector('.pie__dia').classList.contains('es-completo'), off: l && getComputedStyle(l).strokeDashoffset, cx: document.querySelector('.dia__disco') && +document.querySelector('.dia__disco').getAttribute('cx'), txt: document.querySelector('#dia-txt').textContent }; });
  comprobar(pie.comp && parseFloat(pie.off) < 0.02 && /de sol en la casa/.test(pie.txt), `el pie se completa: el camino del sol de hoy dibujado y «${pie.txt.slice(0, 70)}…»`, pie);
  // recargar a media página: se entra arriba
  await page.evaluate(() => scrollTo(0, 2200));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  comprobar(await page.evaluate(() => scrollY === 0), 'recargar a media página entra arriba');
  comprobar(page.errores.length === 0, 'sin errores en la consola', page.errores);
  await c.close();
}

  } finally {
    await browser.close();
  }
}
servidor.close();
console.log(`\n${nOk} bien, ${fallos.length} mal`);
if (fallos.length) { console.log('Fallos:\n - ' + fallos.join('\n - ')); process.exitCode = 1; }
