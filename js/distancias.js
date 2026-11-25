/* ------------------------------------------------------------------
   Alba · «A cuánto queda» (Alba.distancias.montar(el, { movimiento, densidad }) → { destruir() })
   Mapa propio sobre el relieve REAL (sombreado del MDT del IGN, img/relieve/) con la casa en el centro. Al elegir un
   sitio, la ruta REAL de OSRM se dibuja desde la casa (en coche, línea; a pie, puntos) y la ficha da minutos,
   kilómetros, carreteras y el perfil de altura medido sobre el MDT. Mandos: en coche / a pie (desde la puerta) y
   «tengo 20 min / 1 hora / medio día», que enciende lo que queda dentro (solo ida).
   Datos: data/distancias.json (scripts/relieve.py, de ref/raw/rutas.json). Nada a ojo.
   Teclado: la lista es el mando (flechas arriba y abajo para moverse). Táctil: tocar un sitio del mapa o de la lista.
   Sin JS, o si falla, se queda la tabla (que también va dentro, en «Ver todo en una tabla»).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const A = (window.Alba = window.Alba || {});
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, atrs, padre) => { const e = document.createElementNS(NS, tag); for (const k in atrs) e.setAttribute(k, atrs[k]); if (padre) padre.appendChild(e); return e; };
  const h = (tag, atrs, html) => { const e = document.createElement(tag); for (const k in atrs || {}) e.setAttribute(k, atrs[k]); if (html !== undefined) e.innerHTML = html; return e; };
  const num = (v) => String(v).replace('.', ',');
  const tiempo = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m}`);
  const tiempoTxt = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`);
  const kmTxt = (v) => (v < 10 ? num(Math.round(v * 10) / 10) : String(Math.round(v))) + ' km';
  const miles = (n) => (n >= 1000 ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(Math.round(n)));
  const LIMITES = { 20: 20, 60: 60, 90: 90 };
  const NOMBRE_LIMITE = { 20: '20 minutos', 60: '1 hora', 90: 'medio día (1 h 30 de ida)' };
  const GRUPOS = [['cerca', 'Cerca de casa'], ['valle', 'Por el valle'], ['fuera', 'Para llegar y salir']];
  let datos = null;
  const cargar = () => (datos = datos || fetch('data/distancias.json').then((r) => { if (!r.ok) throw new Error('distancias ' + r.status); return r.json(); }));

  // minutos de ida según el modo; null = no se puede así
  function ida(s, modo) {
    if (modo === 'pie') return s.pie && s.pie.desde === 'casa' ? s.pie.minutos : null;
    if (!s.coche) return null;
    return s.coche.minutos + (s.partida && s.pie ? s.pie.minutos : 0);
  }

  function montar(el, op) {
    const movimiento = !!op.movimiento;
    let fotos = {};
    try { fotos = JSON.parse(el.dataset.fotos || '{}'); } catch (e) { /* sin fotos */ }
    const tablaHtml = el.querySelector('.dist__tabla-caja') ? el.querySelector('.dist__tabla-caja').outerHTML : '';
    let vivo = true, sel = null, modo = 'coche', limite = 0, vb = null, anim = 0, D = null;
    const cleanup = [];
    const on = (t, n, f, o) => { t.addEventListener(n, f, o); cleanup.push(() => t.removeEventListener(n, f, o)); };

    const listo = cargar().then((datosJson) => {
      if (!vivo) return;
      D = datosJson;
      const ids = D.orden.filter((id) => D.sitios[id]);
      const casa = D.casa;
      const KX = 111320 * Math.cos(casa.lat * Math.PI / 180), KY = 110574;
      const geo = (xy) => ({ lat: casa.lat - xy[1] / KY, lon: casa.lon + xy[0] / KX });

      /* ---------- el esqueleto ---------- */
      el.innerHTML = '';
      el.classList.add('es-montado');
      const mandos = h('div', { class: 'dist__mandos' });
      const segModo = h('div', { class: 'seg', role: 'group', 'aria-label': 'Cómo vas' },
        '<button type="button" data-modo="coche" aria-pressed="true"><svg class="ico" width="20" height="20" aria-hidden="true"><use href="#i-coche" width="24" height="24"/></svg>En coche</button>' +
        '<button type="button" data-modo="pie" aria-pressed="false"><svg class="ico" width="20" height="20" aria-hidden="true"><use href="#i-pie" width="24" height="24"/></svg>A pie</button>');
      const segTiempo = h('div', { class: 'seg', role: 'group', 'aria-label': 'Cuánto tiempo tienes' },
        '<span class="seg__eti" aria-hidden="true">Tengo</span>' +
        '<button type="button" data-lim="20" aria-pressed="false"><span class="vh">Tengo </span>20 min</button>' +
        '<button type="button" data-lim="60" aria-pressed="false"><span class="vh">Tengo </span>1 hora</button>' +
        '<button type="button" data-lim="90" aria-pressed="false"><span class="vh">Tengo </span>medio día</button>' +
        '<button type="button" data-lim="0" aria-pressed="true">todo el tiempo</button>');
      const cuenta = h('p', { class: 'dist__cuenta', 'aria-live': 'polite' });
      mandos.append(segModo, segTiempo, cuenta);

      const mapaCaja = h('div', { class: 'dist__mapa' });
      const svg = mk('svg', { role: 'img', 'aria-label': 'Mapa del relieve alrededor de la casa con los sitios y la ruta elegida' });
      mapaCaja.appendChild(svg);
      const zoom = h('div', { class: 'dist__zoom' }, '<button type="button" data-z="1" aria-label="Acercar el mapa">+</button><button type="button" data-z="-1" aria-label="Alejar el mapa">−</button>');
      const escala = h('p', { class: 'dist__escala', 'aria-hidden': 'true' });
      mapaCaja.append(zoom, escala);
      const ficha = h('div', { class: 'dist__ficha', 'aria-live': 'polite' });
      const lista = h('div', { class: 'dist__lista' });
      const detalles = h('details', { class: 'dist__detalles' }, '<summary>Ver todo en una tabla</summary>' + tablaHtml);
      el.append(mandos, mapaCaja, ficha, lista, detalles);

      /* ---------- el mapa ---------- */
      const defs = mk('defs', {}, svg);
      const R = D.relieve;
      [R.lejos, R.cerca].forEach((r) => mk('image', { class: 'mapa__relieve', href: r.src, x: r.x, y: r.y, width: r.w, height: r.h, preserveAspectRatio: 'none' }, svg));
      const red = mk('g', { class: 'mapa__red-g' }, svg);
      ids.forEach((id) => { const s = D.sitios[id]; ['coche', 'pie'].forEach((k) => { if (s[k]) mk('path', { class: 'mapa__red', d: s[k].d }, red); }); });
      const rutaG = mk('g', { class: 'mapa__ruta-g' }, svg);
      const partidaG = mk('g', { class: 'mapa__partida' }, svg);
      const sitiosG = mk('g', {}, svg);
      const casaG = mk('g', { class: 'mapa__casa' }, svg);
      const casaIco = mk('path', {}, casaG);
      const casaTxt = mk('text', {}, casaG); casaTxt.textContent = 'Alba';
      const marcas = {};
      ids.forEach((id) => {
        const s = D.sitios[id];
        const g = mk('g', { class: 'mapa__sitio', 'data-sitio': id }, sitiosG);
        mk('circle', { cx: s.xy[0], cy: s.xy[1] }, g);
        const t = mk('text', {}, g); t.textContent = s.nombre;
        marcas[id] = g;
        g.addEventListener('click', () => elegir(id, true));
      });

      // el tamaño de las cosas no cambia con el zoom: radios, letra y la casa se recalculan con la escala
      function caja() { const r = mapaCaja.getBoundingClientRect(); return { w: Math.max(200, r.width), h: Math.max(200, r.height) }; }
      function ajustarA(b) {               // b: {x, y, w, h} en metros → viewBox con la proporción de la caja
        const c = caja(), ar = c.w / c.h;
        let w = b.w, hh = b.h;
        if (w / hh > ar) hh = w / ar; else w = hh * ar;
        return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - hh / 2, w, h: hh };
      }
      function ponerVB(v) {
        vb = v;
        svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
        const u = v.w / caja().w;               // metros por píxel
        ids.forEach((id) => {
          const s = D.sitios[id], g = marcas[id];
          const c = g.firstChild, t = g.lastChild;
          c.setAttribute('r', (6 * u).toFixed(1));
          const derecha = s.xy[0] < v.x + v.w * 0.68;
          t.setAttribute('x', (s.xy[0] + (derecha ? 11 : -11) * u).toFixed(1));
          t.setAttribute('y', (s.xy[1] + 4.5 * u).toFixed(1));
          t.setAttribute('text-anchor', derecha ? 'start' : 'end');
          t.setAttribute('font-size', (13 * u).toFixed(1));
          t.setAttribute('stroke-width', (4 * u).toFixed(1));
          const dentro = s.xy[0] > v.x && s.xy[0] < v.x + v.w && s.xy[1] > v.y && s.xy[1] < v.y + v.h;
          g.style.display = dentro ? '' : 'none';
        });
        const k = 9 * u;
        casaIco.setAttribute('d', `M${-k} ${k * 0.2}L0 ${-k}L${k} ${k * 0.2}V${k}H${-k}Z`);
        casaTxt.setAttribute('x', (-1.4 * k).toFixed(1)); casaTxt.setAttribute('y', (-1.5 * k).toFixed(1));
        casaTxt.setAttribute('text-anchor', 'end'); casaTxt.setAttribute('font-size', (20 * u).toFixed(1)); casaTxt.setAttribute('stroke-width', (4 * u).toFixed(1));
        [...partidaG.children].forEach((c) => c.setAttribute('r', (5 * u).toFixed(1)));
        // escala: un número redondo de km que ocupe ~90 px
        const m = 90 * u, pasos = [0.2, 0.5, 1, 2, 5, 10, 20, 50];
        const km = pasos.find((p) => p * 1000 >= m) || 50;
        escala.innerHTML = `<i style="width:${Math.round(km * 1000 / u)}px"></i>${num(km)} km`;
      }
      function volarA(destino) {
        cancelAnimationFrame(anim);
        const v0 = vb, v1 = ajustarA(destino);
        if (!v0 || !movimiento) { ponerVB(v1); return; }
        const t0 = performance.now(), dur = 750;
        const paso = (n) => {
          const k = Math.min(1, (n - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          ponerVB({ x: v0.x + (v1.x - v0.x) * e, y: v0.y + (v1.y - v0.y) * e, w: v0.w + (v1.w - v0.w) * e, h: v0.h + (v1.h - v0.h) * e });
          if (k < 1) anim = requestAnimationFrame(paso);
        };
        anim = requestAnimationFrame(paso);
      }
      // la vista de partida: la casa y lo de cerca y del valle
      function cajaDe(lista) {
        let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
        lista.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
        const px = (x1 - x0) * 0.16 + 600, py = (y1 - y0) * 0.16 + 600;
        return { x: x0 - px, y: y0 - py, w: x1 - x0 + 2 * px, h: y1 - y0 + 2 * py };
      }
      const VALLE = cajaDe(ids.filter((id) => D.sitios[id].grupo !== 'fuera').map((id) => D.sitios[id].xy));
      ponerVB(ajustarA(VALLE));

      /* ---------- la lista ---------- */
      const botones = {};
      GRUPOS.forEach(([g, titulo]) => {
        const del = ids.filter((id) => D.sitios[id].grupo === g);
        if (!del.length) return;
        const sec = h('div', { class: 'dist__grupo' }, `<h3>${titulo}</h3>`);
        const ul = h('ul');
        del.forEach((id) => {
          const li = h('li');
          const b = h('button', { type: 'button', class: 'dist__item', 'data-sitio': id, 'aria-pressed': 'false' });
          li.appendChild(b); ul.appendChild(li); botones[id] = b;
          b.addEventListener('click', () => elegir(id, false));
        });
        sec.appendChild(ul);
        lista.appendChild(sec);
      });
      on(lista, 'keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const todos = ids.map((id) => botones[id]);
        const i = todos.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        todos[(i + (e.key === 'ArrowDown' ? 1 : -1) + todos.length) % todos.length].focus();
      });

      /* ---------- pintar el estado: modo, tiempo y la selección ---------- */
      function pintarLista() {
        let dentro = 0;
        ids.forEach((id) => {
          const s = D.sitios[id], m = ida(s, modo);
          const ok = m !== null && (!limite || m <= limite);
          if (ok) dentro++;
          const b = botones[id];
          b.classList.toggle('es-fuera', !ok);
          b.classList.toggle('es-dentro', !!limite && ok);
          const etiqueta = m === null ? (modo === 'pie' ? 'en coche' : 'por confirmar') : (m >= 60 ? tiempoTxt(m) : `${m} min`);
          b.innerHTML = `<b>${s.nombre}</b><span class="cifra">${etiqueta}</span>`;
          b.setAttribute('aria-label', `${s.nombre}: ${m === null ? (modo === 'pie' ? 'desde la puerta no se va a pie: hace falta el coche' : 'por confirmar') : tiempoTxt(m) + (modo === 'pie' ? ' a pie' : ' de ida')}${limite && !ok ? ', no te da tiempo' : ''}`);
          marcas[id].classList.toggle('es-fuera', !ok);
          marcas[id].classList.toggle('es-dentro', !!limite && ok);
        });
        const total = ids.length;
        cuenta.textContent = limite
          ? `Con ${NOMBRE_LIMITE[limite]} ${modo === 'pie' ? 'a pie' : 'en coche'} llegas a ${dentro} de ${total} sitios (solo ida).`
          : (modo === 'pie' ? `Desde la puerta, a pie: ${dentro} de ${total} sitios.` : `${total} sitios, del más cerca al más lejos.`);
      }
      function perfilSvg(p) {
        const W = 320, H = 110, km = p.km, m = p.m, kmax = km[km.length - 1] || 1;
        const lo = Math.min(...m), hi = Math.max(...m), rango = Math.max(80, hi - lo);
        const base = lo - rango * 0.08;
        const X = (v) => (v / kmax) * W, Y = (v) => H - ((v - base) / (rango * 1.16)) * H;
        let lin = '';
        km.forEach((k, i) => { lin += (i ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(m[i]).toFixed(1); });
        const area = lin + `L${W} ${H}L0 ${H}Z`;
        return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="perfil__area" d="${area}"/><path class="perfil__linea" d="${lin}"/><line class="perfil__base" x1="0" x2="${W}" y1="${H}" y2="${H}"/></svg>`;
      }
      function tramo(icono, titulo, t, extra) {
        return `<div class="ficha__tramo"><svg class="ico" width="28" height="28" aria-hidden="true"><use href="#i-${icono}" width="24" height="24"/></svg><span class="ficha__min">${tiempo(t.minutos)}<small>min</small></span><span class="ficha__det">${titulo} · <span class="cifra">${kmTxt(t.km)}</span>${extra ? ' · ' + extra : ''}</span></div>`;
      }
      function pintarFicha() {
        if (!sel) {
          ficha.innerHTML = `<p class="ficha__tipo">${ids.length} sitios con su ruta real</p><h3 class="ficha__nombre">Elige un sitio</h3><p>En la lista o en el mapa. La casa está en el centro, a <span class="cifra">${miles(casa.cota)}</span> m.</p>`;
          return;
        }
        const s = D.sitios[sel];
        const piezas = [];
        const viaCoche = s.coche && (modo === 'coche' || !(s.pie && s.pie.desde === 'casa'));
        if (s.coche && viaCoche) piezas.push(tramo('coche', s.partida ? `en coche hasta ${s.partida.nombre}` : 'en coche', s.coche, s.coche.carreteras.length ? s.coche.carreteras.slice(0, 4).join(', ') : ''));
        if (s.pie && (s.partida || modo === 'pie' || !s.coche)) piezas.push(tramo('pie', s.pie.desde === 'partida' ? `a pie desde ${s.partida.nombre}` : 'a pie desde la puerta', s.pie, `sube <span class="cifra">${miles(s.pie.perfil.sube)}</span> m`));
        if (modo === 'pie' && !(s.pie && s.pie.desde === 'casa')) piezas.unshift('<p class="ficha__det">Desde la puerta no se llega a pie: hace falta el coche.</p>');
        const pr = (modo === 'pie' && s.pie) || (s.partida && s.pie) ? s.pie : (s.coche || s.pie);
        const perfil = pr ? `<figure class="ficha__perfil">${perfilSvg(pr.perfil)}<figcaption>Perfil del camino${pr === s.pie && s.partida ? ' a pie' : ''}: de <span class="cifra">${miles(pr.perfil.m[0])}</span> a <span class="cifra">${miles(pr.perfil.fin)}</span> m, sube <span class="cifra">${miles(pr.perfil.sube)}</span> m y baja <span class="cifra">${miles(pr.perfil.baja)}</span> m en <span class="cifra">${kmTxt(pr.km)}</span>.</figcaption></figure>` : '';
        const f = fotos[sel];
        const foto = f ? `<figure class="ficha__foto"><picture><source type="image/webp" srcset="${f.anchos.map((w) => `img/fotos/${f.n}-${w}.webp ${w}w`).join(', ')}" sizes="132px"><img src="img/fotos/${f.n}-${f.anchos[0]}.jpg" width="${f.ancho}" height="${f.alto}" alt="${f.alt}" loading="lazy" decoding="async"></picture><figcaption>${f.pie ? f.pie + '. ' : ''}Foto: <a href="${f.pagina}" target="_blank" rel="noopener">${f.autor}</a>, <a href="${f.licenciaUrl}" target="_blank" rel="noopener">${f.licencia}</a> (Wikimedia Commons).</figcaption></figure>` : '';
        const g = geo(s.xy), c = { lat: casa.lat, lon: casa.lon };
        const ir = `https://www.google.com/maps/dir/?api=1&origin=${c.lat.toFixed(6)},${c.lon.toFixed(6)}&destination=${g.lat.toFixed(5)},${g.lon.toFixed(5)}&travelmode=${modo === 'pie' && s.pie && s.pie.desde === 'casa' ? 'walking' : 'driving'}`;
        ficha.innerHTML = `<p class="ficha__tipo">${s.tipo} · <span class="cifra">${miles(s.cota)}</span> m · en línea recta, <span class="cifra">${kmTxt(s.rectaKm)}</span></p><h3 class="ficha__nombre">${s.nombre}</h3><div class="ficha__tramos">${piezas.join('')}</div>${perfil}<a class="ficha__ir" href="${ir}" target="_blank" rel="noopener">Cómo ir, en Google Maps<span class="vh"> (se abre en otra pestaña)</span> <svg class="ico" width="18" height="18" aria-hidden="true"><use href="#i-flecha" width="24" height="24"/></svg></a>${foto}`;
      }
      // dibujar la ruta: el tramo en coche y luego el de a pie, cada uno con su máscara que avanza
      let nMask = 0;
      function dibujarRuta() {
        while (rutaG.firstChild) rutaG.removeChild(rutaG.firstChild);
        while (partidaG.firstChild) partidaG.removeChild(partidaG.firstChild);
        [...defs.querySelectorAll('mask')].forEach((m) => m.remove());
        if (!sel) return null;
        const s = D.sitios[sel];
        const tramos = [];
        const pieCasa = s.pie && s.pie.desde === 'casa';
        if (s.coche && (modo === 'coche' || !pieCasa)) tramos.push(['coche', s.coche]);
        if (s.pie && (s.partida || (modo === 'pie' && pieCasa) || !s.coche)) tramos.push(['pie', s.pie]);
        let retraso = 0;
        const cajas = [];
        tramos.forEach(([tipo, t]) => {
          const id = 'm-ruta-' + (++nMask);
          const m = mk('mask', { id, maskUnits: 'userSpaceOnUse', x: -300000, y: -300000, width: 600000, height: 600000 }, defs);
          const mp = mk('path', { d: t.d, fill: 'none', stroke: '#fff', 'stroke-width': 16, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1 }, m);
          const p = mk('path', { class: 'mapa__ruta' + (tipo === 'pie' ? ' mapa__ruta--pie' : ''), d: t.d, mask: `url(#${id})` }, rutaG);
          const dur = Math.max(500, Math.min(1400, t.km * (tipo === 'pie' ? 160 : 22)));
          if (movimiento) {
            mp.style.strokeDasharray = '1 1'; mp.style.strokeDashoffset = '1';
            mp.getBoundingClientRect();
            mp.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.45,0,.2,1) ${retraso}ms`;
            requestAnimationFrame(() => { mp.style.strokeDashoffset = '0'; });
            retraso += dur;
          }
          try { cajas.push(p.getBBox()); } catch (e) { /* sin caja */ }
        });
        if (s.partida) mk('circle', { cx: s.partida.xy[0], cy: s.partida.xy[1], r: 5 }, partidaG);
        if (!cajas.length) return null;
        const x0 = Math.min(0, ...cajas.map((b) => b.x)), y0 = Math.min(0, ...cajas.map((b) => b.y));
        const x1 = Math.max(0, ...cajas.map((b) => b.x + b.width)), y1 = Math.max(0, ...cajas.map((b) => b.y + b.height));
        const pad = Math.max(500, (x1 - x0 + y1 - y0) * 0.12);
        return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
      }
      function elegir(id, desdeMapa) {
        sel = id;
        ids.forEach((x) => { botones[x].setAttribute('aria-pressed', String(x === id)); marcas[x].classList.toggle('es-activo', x === id); });
        pintarFicha();
        const b = dibujarRuta();
        if (b) volarA(b);
        if (desdeMapa && botones[id]) botones[id].focus({ preventScroll: true });
      }
      const pintarTodo = () => { pintarLista(); pintarFicha(); if (sel) { const b = dibujarRuta(); if (b) volarA(b); } };
      [...segModo.querySelectorAll('button')].forEach((b) => b.addEventListener('click', () => {
        modo = b.dataset.modo;
        segModo.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        pintarTodo();
        if (!sel) volarA(VALLE);
      }));
      [...segTiempo.querySelectorAll('button')].forEach((b) => b.addEventListener('click', () => {
        limite = LIMITES[b.dataset.lim] || 0;
        segTiempo.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        pintarLista();
        // se enseña todo lo que queda dentro
        const dentro = ids.filter((id) => { const m = ida(D.sitios[id], modo); return m !== null && (!limite || m <= limite); });
        if (!sel && dentro.length) volarA(cajaDe(dentro.map((id) => D.sitios[id].xy)));
      }));
      zoom.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.z === '1' ? 0.6 : 1.6, c = vb;
        const w = Math.max(3000, Math.min(260000, c.w * k)), hh = w * c.h / c.w;
        volarA({ x: c.x + c.w / 2 - w / 2, y: c.y + c.h / 2 - hh / 2, w, h: hh });
      }));
      const alResize = () => { if (vb) ponerVB(ajustarA(vb)); };
      on(document, 'alba:resize', alResize);
      pintarLista();
      pintarFicha();
      // si viene de un enlace con #distancias-<sitio>, ese
      el.setAttribute('data-montado', '');
      A.distancias._elegir = elegir;
    });

    return {
      listo,
      elegir: (id) => A.distancias._elegir && A.distancias._elegir(id),
      estado: () => ({ sel, modo, limite, vb }),
      destruir() { vivo = false; cancelAnimationFrame(anim); cleanup.forEach((f) => f()); el.classList.remove('es-montado'); el.removeAttribute('data-montado'); },
    };
  }
  A.distancias = { montar };
})();
