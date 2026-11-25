/* Genera las páginas a partir de sus fuentes *.src.html (arquitectura de ../apartamentos-montemar-navia-web/construir.mjs):
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo (si falta, un comentario y la web sigue).
   2. Una sola fuente de datos del negocio: data/alba.json (de ref/DATOS-ALBA.md). Fichas, servicios, la tabla de la
      sobria, la visita, reseñas, el respaldo del simulador, contacto y los datos que lee js/reserva.js.
   3. El relieve: data/portada.json (scripts/relieve.py) y el horizonte de Lugar 3D (data/lugar-horizonte.json; sin él,
      data/horizonte-provisional.json) → el dibujo de la portada y el del pie, que son el respaldo sin JS.
   4. El sol: js/sol.js (de Lugar 3D) se ejecuta aquí, en Node, para los textos de respaldo (la frase de la portada sin JS,
      el sol del día 21 de cada mes en #lugar). Con JS, los pone al día el navegador.
   5. <!--distancias--> y <!--contacto-->: rutas de ref/raw/rutas.json y data/distancias.json (OSRM + MDT). Sin ellas,
      «por confirmar».
   6. {{COTA}}: la cota de la casa de data/lugar.json (Lugar 3D, MDT05); sin él, 959 (Open-Meteo, ref/DATOS-ALBA.md).
   7. <img data-foto="nombre" ...> → <picture> WebP + JPG en los anchos de img/fotos/fotos.json (nunca se amplía).
   8. Los <link>/<script> propios que no existen se quitan con un aviso, SALVO los de Lugar 3D (css/lugar.css,
      js/lugar.js, js/sol.js): se dejan siempre, para que en cuanto existan se carguen sin reconstruir.
   9. Ejecuta versionar.mjs (?v=<huella> en CSS y JS).
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
const leerSi = (f) => (existe(f) ? leerJson(f) : null);
const D = leerJson('data/alba.json');
const FOTOS = new Map(leerJson('img/fotos/fotos.json').map((f) => [f.nombre, f]));
const COMMONS = leerJson('scripts/commons.json');
const LUGAR = leerSi('data/lugar.json');
const HZ = leerSi('data/lugar-horizonte.json') || leerSi('data/horizonte-provisional.json');
const PORTADA = leerJson('data/portada.json');
const DIST = leerSi('data/distancias.json');
const RUTAS = leerSi('ref/raw/rutas.json');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const num = (n) => String(n).replace('.', ',');
const COTA = LUGAR && Number.isFinite(LUGAR.cotaCasa) ? Math.round(LUGAR.cotaCasa) : 959;
const ico = (n, t = 24) => `<svg class="ico" width="${t}" height="${t}" aria-hidden="true"><use href="#i-${n}" width="24" height="24"/></svg>`;

/* ---------- el sol y la geometría del panorama, los mismos ficheros que usa el navegador ---------- */
const ctx = { console, Intl, URLSearchParams, Math, Date, Promise };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
let SOL = null;
if (existe('js/sol.js')) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/sol.js'), 'utf8'), ctx, { filename: 'sol.js' });
  SOL = ctx.Alba && ctx.Alba.sol;
  if (SOL && HZ) SOL.usar(HZ); else SOL = null;
} else console.warn('  (aún no está js/sol.js, de Lugar 3D: los textos del sol van sin hora)');
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/portada.js'), 'utf8'), ctx, { filename: 'portada.js' });
const PAN = ctx.Alba.panorama;

/* ---------- fotos ---------- */
function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="img/fotos/${nombre}-${f.anchos[0]}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}" style="--max:${f.ancho}px"${resto}></picture>`;
}

/* ---------- portada: el panorama de respaldo (SVG fijo, 1600×1000, del sureste al suroeste) ---------- */
function portadaSvg() {
  const W = 1600, H = 1000, y0 = 640, a0 = 95, a1 = 265, kx = W / (a1 - a0), ky = kx;
  const hor = HZ ? (az) => PAN.valor(HZ.horizonteFino || HZ.horizonte, az * ((HZ.horizonteFino || HZ.horizonte).length / 360)) : null;
  // horizonte de Lugar con su paso (horizonteFino cada «paso» grados, o cada 1°)
  const H_ = HZ ? (HZ.horizonteFino || HZ.horizonte) : null;
  const pasoH = HZ ? (HZ.horizonteFino ? (HZ.paso || 360 / H_.length) : 1) : 1;
  const horizonte = H_ ? (az) => { const x = PAN.norm(az) / pasoH, i = Math.floor(x), f = x - i, n = H_.length; return H_[i % n] * (1 - f) + H_[(i + 1) % n] * f; } : null;
  void hor;
  const perf = PAN.ajustar(PORTADA.capas, horizonte);
  const env = PAN.envolvente(perf);
  const X = (az) => (az - a0) * kx, Y = (v) => y0 - v * ky;
  const capas = perf.map((p, i) => `      <path class="pano__capa pano__capa--${i + 1}" d="${PAN.camino(p, a0 - 4, a1 + 4, X, Y, true, H + 2)}"/>`).join('\n');
  const crestas = perf.map((p, i) => `      <path class="pano__cresta pano__cresta--${i + 1}" d="${PAN.camino(p, a0 - 4, a1 + 4, X, Y, false)}"/>`).join('\n');
  let ultX = -1e9;
  const cimas = PORTADA.cimas.filter((c) => c.tipo === 'peak' && c.azimut > a0 + 6 && c.azimut < a1 - 6).filter((c) => { const x = X(c.azimut); if (x - ultX < 170) return false; ultX = x; return true; }).map((c) => {
    const x = X(c.azimut), y = Y(PAN.valor(env, c.azimut));
    return `        <g class="pano__cima"><path d="M${x.toFixed(1)} ${(y - 6).toFixed(1)}V${(y - 26).toFixed(1)}"/><text x="${x.toFixed(1)}" y="${(y - 32).toFixed(1)}" text-anchor="middle">${esc(c.nombre)}</text><text class="pano__cota" x="${x.toFixed(1)}" y="${(y - 47).toFixed(1)}" text-anchor="middle">${PAN.miles(c.cota)} m</text></g>`;
  }).join('\n');
  // «Alba»: la misma regla que js/portada.js: base un cuarto por debajo del punto más alto del filo que tiene debajo,
  // en el sitio de la vista donde cabe más grande, empezando bajo la cabecera
  const arriba = 96, margen = 96;
  const filo = (x0, ancho) => { let y = 1e9; for (let x = x0; x <= x0 + ancho; x += 6) y = Math.min(y, Y(PAN.valor(env, a0 + x / kx))); return y; };
  let mejor = null;
  for (let x = margen; x < W - margen - 300; x += 12) for (let f = 680; f > 200; f *= 0.94) {
    const ancho = 1.76 * f; if (x + ancho > W - margen) continue;
    const y = filo(x, ancho), alto = 0.74 * f;
    if (y + alto * 0.25 - alto >= arriba) { if (!mejor || f > mejor.f + 0.5) mejor = { x, f, base: y + alto * 0.25 }; break; }
  }
  mejor = mejor || { x: margen, f: 300, base: arriba + 222 };
  const fs_ = Math.round(mejor.f), izq = mejor.x, base = mejor.base;
  const NOM = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const rumbos = [135, 180, 225].map((a) => `<path d="M${X(a).toFixed(1)} ${y0 + 18}v8"/><text x="${X(a).toFixed(1)}" y="${y0 + 40}" text-anchor="middle">${NOM[a / 45]}</text>`).join('');
  return `      <svg class="pano" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="pano-cielo-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${y0}"><stop offset="0" style="stop-color:var(--cielo-alto)"/><stop offset=".55" style="stop-color:var(--cielo-medio)"/><stop offset="1" style="stop-color:var(--cielo-bajo)"/></linearGradient>
          <linearGradient id="pano-suelo-g" gradientUnits="userSpaceOnUse" x1="0" y1="${y0}" x2="0" y2="${y0 + 150}"><stop offset="0" style="stop-color:var(--capa-4)"/><stop offset="1" style="stop-color:var(--suelo)"/></linearGradient>
          <radialGradient id="pano-halo-g"><stop offset="0" style="stop-color:var(--sol-halo)"/><stop offset="1" style="stop-color:var(--sol-halo);stop-opacity:0"/></radialGradient>
        </defs>
        <rect class="pano__cielo" width="${W}" height="${H}" fill="url(#pano-cielo-g)"/>
        <g class="pano__estrellas"></g>
        <text class="pano__palabra" x="${izq}" y="${base.toFixed(1)}" font-size="${fs_}">Alba</text>
        <g class="pano__mov">
${capas}
${crestas}
        <g class="pano__cimas">
${cimas}
        </g>
        </g>
        <rect class="pano__suelo" x="0" y="${y0 - 1}" width="${W}" height="${H - y0 + 1}" fill="url(#pano-suelo-g)"/>
        <g class="pano__rumbos">${rumbos}</g>
      </svg>`;
}

/* ---------- textos del sol (respaldo sin JS) ---------- */
const DIA = 86400000;
function anioDeSol() {
  if (!SOL) return null;
  const anio = new Date().getFullYear(), filas = [];
  let pronto = null, tarde = null;
  for (let t = Date.UTC(anio, 0, 1, 12); t < Date.UTC(anio + 1, 0, 1); t += DIA) {
    const tr = SOL.tramos(new Date(t));
    if (!tr || !tr.length) continue;
    const e = tr[0].desde, m = SOL.madrid(e), min = m.h * 60 + m.min;
    if (!pronto || min < pronto.min) pronto = { min, f: e };
    if (!tarde || min > tarde.min) tarde = { min, f: e };
  }
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  for (let m = 1; m <= 12; m++) {
    const t = SOL.desdeMadrid(anio, m, 21, 12, 0), tr = SOL.tramos(t) || [];
    filas.push({ mes: MESES[m - 1], entra: tr.length ? SOL.haciaLas(tr[0].desde) : null, sale: tr.length ? SOL.haciaLas(tr[tr.length - 1].hasta) : null, horas: tr.length ? PAN.duracion(PAN.horasSol(tr)) : '0 min', ratos: tr.length });
  }
  return { anio, pronto: SOL.haciaLas(pronto.f), tarde: SOL.haciaLas(tarde.f), filas };
}
const AÑO = anioDeSol();
const fraseRespaldo = () => (AÑO ? `Según la época del año, el sol entra en la casa entre las <b class="cifra">${AÑO.pronto}</b> y las <b class="cifra">${AÑO.tarde}</b>.` : 'Cada mañana, el sol tarda en asomar por encima de las peñas.');
function lugarRespaldo() {
  if (!AÑO) return '      <div class="lugar__respaldo env"><p>El valle de Somiedo alrededor de Caunedo, en 3D, se carga aquí.</p></div>';
  return `      <div class="lugar__respaldo env">
        <h3 class="lugar__sub">El sol en la casa, el día 21 de cada mes</h3>
        <div class="lugar__tabla-caja" role="group" aria-label="Tabla: el sol en la casa cada mes">
          <table class="lugar__tabla">
            <caption class="vh">Hora a la que el sol entra en la casa, hora a la que se esconde tras las peñas y horas de sol directo, el día 21 de cada mes de ${AÑO.anio}</caption>
            <thead><tr><th scope="col">Mes</th><th scope="col">Entra</th><th scope="col">Se va</th><th scope="col">Sol en la casa</th></tr></thead>
            <tbody>
${AÑO.filas.map((f) => `              <tr><th scope="row">${f.mes}</th><td class="cifra">${f.entra || 'no entra'}</td><td class="cifra">${f.sale || '·'}</td><td class="cifra">${f.horas}${f.ratos > 1 ? ` <small>(${f.ratos} ratos)</small>` : ''}</td></tr>`).join('\n')}
            </tbody>
          </table>
        </div>
        <p class="lugar__fino">Hora de Madrid, redondeada a 5 minutos. Calculado con el relieve del IGN (MDT) desde la casa: el sol «entra» cuando asoma sobre las peñas.</p>
      </div>`;
}

/* ---------- el pie: el día entero (respaldo: el perfil y el texto del año) ---------- */
function diaSvg() {
  const W = 1200, Hh = 420, y0 = 380, a0 = 50, a1 = 310, k = (W / (a1 - a0)) * 1.0;
  const H_ = HZ ? (HZ.horizonteFino || HZ.horizonte) : null;
  const pasoH = HZ ? (HZ.horizonteFino ? (HZ.paso || 360 / H_.length) : 1) : 1;
  const horizonte = H_ ? (az) => { const x = PAN.norm(az) / pasoH, i = Math.floor(x), f = x - i, n = H_.length; return H_[i % n] * (1 - f) + H_[(i + 1) % n] * f; } : null;
  const env = PAN.envolvente(PAN.ajustar(PORTADA.capas, horizonte));
  const X = (az) => (az - a0) * (W / (a1 - a0)), Y = (v) => y0 - v * k;
  const NOM = { 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O' };
  const rumbos = Object.entries(NOM).map(([a, n]) => `<text x="${X(+a).toFixed(1)}" y="${Hh - 8}" text-anchor="middle">${n}</text>`).join('');
  return `      <svg class="dia" viewBox="0 0 ${W} ${Hh}" data-a0="${a0}" data-a1="${a1}" data-y0="${y0}" data-k="${k.toFixed(4)}" aria-hidden="true" focusable="false">
        <g class="dia__sol"></g>
        <path class="dia__relieve" d="${PAN.camino(env, a0, a1, X, Y, true, Hh + 2)}"/>
        <path class="dia__cresta" d="${PAN.camino(env, a0, a1, X, Y, false)}"/>
        <g class="dia__rumbos">${rumbos}</g>
        <g class="dia__marcas"></g>
      </svg>`;
}
const diaRespaldo = () => (AÑO ? `Según la época del año, el sol entra en la casa entre las <b class="cifra">${AÑO.pronto}</b> y las <b class="cifra">${AÑO.tarde}</b>, y se va tras las peñas.` : 'El sol de cada día en la casa.');

/* ---------- la casa ---------- */
const euros = (n) => `${n}<small> €</small>`;
function unidades() {
  const u = D.unidades;
  const ficha = (x) => `      <article class="unidad unidad--${x.id}" aria-labelledby="t-u-${x.id}">
        <p class="unidad__cuantos cifra" aria-hidden="true">×${x.cuantos}</p>
        <h3 class="unidad__tit" id="t-u-${x.id}">${x.cuantos === 1 ? 'Uno' : 'Tres'} para <span class="cifra">${x.personas[0]}</span> a <span class="cifra">${x.personas[1]}</span> personas</h3>
        <dl class="unidad__precios">
          <div><dt>Temporada baja</dt><dd class="cifra">${euros(x.precios.baja)}</dd></div>
          <div><dt>Temporada alta</dt><dd class="cifra">${euros(x.precios.alta)}</dd></div>
        </dl>
        <p class="unidad__noche">por noche, el apartamento entero</p>
        <a class="btn btn--acento" href="#reservar" data-reservar="${x.id}">Ver fechas<span class="vh">: apartamento para ${x.personas[0]} a ${x.personas[1]}</span></a>
      </article>`;
  return `    <div class="env unidades">
${u.map(ficha).join('\n')}
      <p class="unidades__temporada"><b>Temporada alta:</b> ${esc(D.temporadas.alta.toLowerCase())}. <b>Baja:</b> ${esc(D.temporadas.baja.toLowerCase())}. Tarifa oficial de la casa.</p>
    </div>`;
}
function servicios() {
  return `    <div class="env servicios">
      <h3 class="servicios__tit">En cada apartamento</h3>
      <ul class="servicios__lista">
${D.servicios.map((s) => `        <li>${ico(s.icono, 28)}<b>${esc(s.nombre)}</b><span>${esc(s.detalle)}</span></li>`).join('\n')}
      </ul>
    </div>`;
}
function vistazo() {
  const [p, g] = D.unidades;
  const filas = [
    ['Cuántos hay', String(p.cuantos), String(g.cuantos)],
    ['Personas', `${p.personas[0]} a ${p.personas[1]}`, `${g.personas[0]} a ${g.personas[1]}`],
    ['Noche en temporada baja', `${p.precios.baja} €`, `${g.precios.baja} €`],
    ['Noche en temporada alta', `${p.precios.alta} €`, `${g.precios.alta} €`],
    ['Noche por persona, lleno y en baja', `${num((p.precios.baja / p.personas[1]).toFixed(2))} €`, `${num((g.precios.baja / g.personas[1]).toFixed(2))} €`],
    ['Entrada', 'Independiente', 'Independiente'],
  ];
  return `    <div class="env vistazo" id="vistazo">
      <h3 class="vistazo__tit">De un vistazo</h3>
      <div class="vistazo__caja" role="group" aria-label="Tabla comparativa de los dos tipos de apartamento">
        <table class="vistazo__tabla">
          <caption class="vh">Los dos tipos de apartamento comparados</caption>
          <thead><tr><th scope="col"><span class="vh">Dato</span></th><th scope="col">Para ${p.personas[0]} a ${p.personas[1]}</th><th scope="col">Para ${g.personas[0]} a ${g.personas[1]}</th></tr></thead>
          <tbody>
${filas.map(([h, a, b]) => `            <tr><th scope="row">${h}</th><td class="cifra">${a}</td><td class="cifra">${b}</td></tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ---------- por dentro ---------- */
function visita() {
  const V = D.visita;
  let n = 0;
  const guia = V.vistas.map((v) => { const ini = n + 1; n += v.vistas; return `          <li><b>Apartamento ${v.apartamento}</b><span class="cifra">${v.vistas} vistas</span><small>miniaturas ${ini} a ${n}</small></li>`; }).join('\n');
  return `      <div class="visita">
        <div class="visita__marco" id="visita-marco" data-src="${esc(V.url)}">
          <div class="visita__antes">
            ${ico('vista', 44)}
            <button class="btn btn--sol" type="button" id="visita-btn">Abrir la visita virtual</button>
            <p class="visita__aviso">Se carga desde la web de EuroWeb Media, que hizo la visita: es contenido externo y pone sus cookies (Google Analytics). <a href="cookies.html">Más información</a></p>
          </div>
        </div>
        <aside class="visita__guia" aria-labelledby="t-guia">
          <h3 id="t-guia">Las nueve vistas</h3>
          <ol class="visita__lista">
${guia}
          </ol>
          <p class="visita__nota">El visor no deja abrir un apartamento concreto desde fuera: se elige en su tira de miniaturas, que va en este orden.</p>
          <p><a class="visita__fuera" href="${esc(V.url)}" target="_blank" rel="noopener">Abrirla a pantalla completa<span class="vh"> (en otra pestaña)</span> ${ico('flecha', 18)}</a></p>
        </aside>
      </div>`;
}
function fotosDentro() {
  const F = leerJson('data/fotos.json').acento.map((x) => [x.n, x.alt]);
  return `      <ul class="fotos-acento" aria-label="Algunas fotos de la casa">
${F.map(([n, alt]) => `        <li><figure><img data-foto="${n}" alt="${esc(alt)}" sizes="(max-width: 699px) 44vw, 260px"><figcaption>${esc(alt.split(':')[0])}</figcaption></figure></li>`).join('\n')}
      </ul>
      <p class="fotos-acento__nota">Fotos de la casa en su ficha de Sensación Rural, a su tamaño: la casa tiene que mandar las suyas a buena resolución.</p>`;
}

/* ---------- a cuánto queda ---------- */
const tiempoTxt = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`);
const kmTxt = (v) => (v < 10 ? num(Math.round(v * 10) / 10) : String(Math.round(v))) + ' km';
function distancias() {
  if (!DIST || !RUTAS) { console.warn('  (sin data/distancias.json o ref/raw/rutas.json: «A cuánto queda» va sin cifras)'); return '      <p class="dist__fino">Las distancias están por confirmar.</p>'; }
  const fecha = new Date(RUTAS.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const GRUPOS = { cerca: 'Cerca de casa', valle: 'Por el valle', fuera: 'Para llegar y salir' };
  const filas = DIST.orden.map((id) => {
    const s = DIST.sitios[id];
    if (!s) return '';
    const coche = s.coche ? `${tiempoTxt(s.coche.minutos)} · ${kmTxt(s.coche.km)}${s.partida ? `<small>hasta ${esc(s.partida.nombre)}</small>` : ''}` : '·';
    const pie = s.pie ? `${tiempoTxt(s.pie.minutos)} · ${kmTxt(s.pie.km)}<small>${s.pie.desde === 'partida' ? 'desde ' + esc(s.partida.nombre) : 'desde la casa'}, sube ${PAN.miles(s.pie.perfil.sube)} m</small>` : '·';
    return `            <tr data-sitio="${id}" data-grupo="${s.grupo}"><th scope="row">${esc(s.nombre)}<small>${esc(s.tipo)} · ${PAN.miles(s.cota)} m</small></th><td class="cifra">${coche}</td><td class="cifra">${pie}</td></tr>`;
  }).join('\n');
  // las fotos de los sitios (Commons, licencia comprobada) para la ficha de js/distancias.js
  const fotos = {};
  for (const c of COMMONS) { const f = FOTOS.get(c.nombre); if (f && c.sitio) fotos[c.sitio] = { n: c.nombre, alt: c.alt, pie: c.pie || '', autor: c.autor, licencia: c.licencia, licenciaUrl: c.licenciaUrl, pagina: c.pagina, anchos: f.anchos, ancho: f.ancho, alto: f.alto }; }
  return `      <div class="dist__app" data-modulo="distancias" data-fotos="${esc(JSON.stringify(fotos))}">
        <div class="dist__tabla-caja" role="group" aria-label="Tabla: a cuánto queda cada sitio">
          <table class="dist__tabla">
            <caption class="vh">Tiempo y distancia desde la casa, en coche y a pie</caption>
            <thead><tr><th scope="col">Sitio</th><th scope="col">En coche</th><th scope="col">A pie</th></tr></thead>
            <tbody>
${filas}
            </tbody>
          </table>
        </div>
      </div>
      <p class="dist__fino">Rutas de OSRM sobre OpenStreetMap, calculadas el ${fecha}: tiempos sin tráfico ni paradas y, a pie, a paso de llano (no cuentan la cuesta). Alturas y relieve: MDT del IGN. A Mumián se va a pie por la carretera hasta el arranque de su senda: es lo que da el mapa de caminos.</p>`;
}

/* ---------- reseñas ---------- */
function resenas() {
  const R = D.resenas;
  return `    <div class="env resenas__in">
      <p class="resenas__nota" aria-hidden="true"><span class="cifra">${R.nota}</span><span class="resenas__de">de ${R.sobre}</span></p>
      <div class="resenas__txt">
        <h2 class="sec-tit" id="t-resenas">La nota de quienes han estado</h2>
        <p class="resenas__dato">${R.nota} de ${R.sobre} con <span class="cifra">${R.recuento}</span> reseñas en ${R.fuente}.${R.comprobada ? '' : ` <span class="es-pendiente">Dato de su ficha en Sensación Rural: por comprobar en su ficha de Google.</span>`}</p>
        <p><a class="btn btn--linea" href="${esc(R.enlace)}" target="_blank" rel="noopener">Leer las reseñas en Google<span class="vh"> (se abre en otra pestaña)</span></a></p>
      </div>
    </div>`;
}

/* ---------- reservar: el respaldo sin JS (el simulador lo monta js/reserva.js) ---------- */
function reserva() {
  const C = D.contacto;
  return `      <div class="sim" data-modulo="reserva">
        <div class="sim__respaldo">
          <p>Para reservar, llama al <a class="cifra" href="tel:${C.telefonos[0].tel}">${C.telefonos[0].texto}</a> o al <a class="cifra" href="tel:${C.telefonos[1].tel}">${C.telefonos[1].texto}</a>, o escribe a <a href="mailto:${C.correo}">${C.correo}</a>.</p>
          <ul class="sim__condiciones">
${D.cancelacion.general.map((c) => `            <li>${esc(c.texto)}</li>`).join('\n')}
            <li>${esc(D.cancelacion.alta)}</li>
          </ul>
        </div>
      </div>`;
}
function datosReserva() {
  const x = { unidades: D.unidades, temporadas: D.temporadas, cancelacion: D.cancelacion, contacto: D.contacto, nombre: D.nombre };
  return `<script type="application/json" id="datos-alba">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`;
}

/* ---------- contacto y cómo llegar ---------- */
function contacto() {
  const C = D.contacto, s = DIST ? DIST.sitios : {};
  const ruta = (id, desde, txt) => {
    const r = s[id] && s[id].coche;
    return `          <div><dt>${desde}</dt><dd>${r ? `<span class="cifra contacto__t">${tiempoTxt(r.minutos)}</span><span class="cifra contacto__km">${kmTxt(r.km)}${r.carreteras.length ? ' · ' + esc(r.carreteras.slice(0, 4).join(', ')) : ''}</span>` : '<span>Por confirmar</span>'}${txt ? `<p>${esc(txt)}</p>` : ''}</dd></div>`;
  };
  const q = `${D.nombre}, Caunedo, ${D.lugar.cp} Somiedo, Asturias`;
  return `    <div class="env contacto__in">
      <div class="contacto__txt">
        <h2 class="sec-tit" id="t-contacto">Cómo llegar</h2>
        <p class="contacto__dir">Caunedo (parroquia de Gúa)<br>${D.lugar.cp} Somiedo, Asturias</p>
        <dl class="contacto__rutas">
${ruta('oviedo', 'Desde Oviedo', D.llegar.oviedo)}
${ruta('leon', 'Desde León', D.llegar.leon)}
${ruta('aeropuerto', 'Desde el aeropuerto de Asturias', '')}
        </dl>
        <ul class="contacto__medios">
          <li>${ico('tel', 22)}<a class="cifra" href="tel:${C.telefonos[0].tel}">${C.telefonos[0].texto}</a><small>${C.telefonos[0].tipo}</small></li>
          <li>${ico('tel', 22)}<a class="cifra" href="tel:${C.telefonos[1].tel}">${C.telefonos[1].texto}</a><small>${C.telefonos[1].tipo}${C.whatsapp.confirmado ? ' y WhatsApp' : '. WhatsApp, por confirmar'}</small></li>
          <li>${ico('correo', 22)}<a href="mailto:${C.correo}">${C.correo}</a></li>
        </ul>
      </div>
      <div class="mapa" id="mapa" data-q="${esc(q)}">
        <button class="mapa__btn" type="button" id="mapa-btn">${ico('mapa', 32)}<b>Ver el mapa</b><small>Se carga Google Maps, que puede poner sus cookies.</small></button>
      </div>
    </div>`;
}

/* ---------- créditos del pie ---------- */
function creditos() {
  return `    <div class="pie__creditos">
      <h2 class="pie__h">Fotos y datos</h2>
      <p>Fotos del paisaje, de Wikimedia Commons: ${COMMONS.map((c) => `<a href="${esc(c.pagina)}">${esc(c.pie || c.alt.split(',')[0])}</a>, de ${esc(c.autor)} (<a href="${esc(c.licenciaUrl)}">${esc(c.licencia)}</a>)`).join('; ')}. Fotos de la casa: su ficha en Sensación Rural. Relieve y alturas: © Instituto Geográfico Nacional (MDT, CC BY 4.0). Caminos y sitios: © colaboradores de OpenStreetMap (ODbL), rutas con OSRM. El dibujo de la fachada está hecho a partir de una foto de la casa.</p>
    </div>`;
}

/* ---------- partes y ausentes ---------- */
const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + ruta + ')'); return `<!-- sin ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});
const DE_LUGAR = new Set(['css/lugar.css', 'js/lugar.js', 'js/sol.js']);
const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (DE_LUGAR.has(r) || existe(r) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script (?:type="module" )?src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (DE_LUGAR.has(r) || existe(r) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));
for (const r of DE_LUGAR) if (!existe(r)) console.warn(`  (aún no está ${r}, de Lugar 3D: la etiqueta se queda y la página usa el respaldo)`);

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  const rep = (marca, fn) => { if (html.includes(marca)) html = html.replace(marca, fn); };
  html = html.replace(/\{\{COTA\}\}/g, String(COTA));
  rep('<!--portada-svg-->', portadaSvg);
  rep('<!--frase-respaldo-->', fraseRespaldo);
  rep('<!--precarga-->', () => '');
  rep('<!--unidades-->', unidades);
  rep('<!--servicios-->', servicios);
  rep('<!--vistazo-->', vistazo);
  rep('<!--visita-->', visita);
  rep('<!--fotos-dentro-->', fotosDentro);
  rep('<!--lugar-respaldo-->', lugarRespaldo);
  rep('<!--distancias-->', distancias);
  rep('<!--resenas-->', resenas);
  rep('<!--reserva-->', reserva);
  rep('<!--contacto-->', contacto);
  rep('<!--creditos-->', creditos);
  rep('<!--dia-svg-->', diaSvg);
  rep('<!--dia-respaldo-->', diaRespaldo);
  rep('<!--datos-->', datosReserva);
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
