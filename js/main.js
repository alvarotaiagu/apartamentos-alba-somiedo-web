/* ------------------------------------------------------------------
   Alba · «Amanece en Alba» · lo común de la página (receta de ../apartamentos-montemar-navia-web/js/main.js)
   - La LUZ de la web: cuatro estados (alba, día, atardecer, noche) por la altura del sol en Caunedo AHORA (js/sol.js,
     ?hora= y ?fecha=), revisada cada minuto; el mando de la cabecera los enseña a mano y «Ahora» vuelve al real.
     Alba.luz.previa(estado) la cambia mientras se arrastra el sol de la portada.
   - Monta los módulos con su respaldo: la portada al cargar; el 3D (Alba.lugar, de Lugar 3D), las distancias, el
     simulador y el día del pie al acercarse (IntersectionObserver, 900 px). Contrato: Alba.<mod>.montar(el,
     { movimiento, densidad, webgl }) → { destruir() }. Si un módulo falla, vuelve su respaldo.
   - Cabecera, menú móvil, la visita virtual a petición, el mapa a petición, cookies, el foco con el medio sol y el
     mando de maqueta (bloque 12; no viaja al cliente).
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !quieto;
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const A = (window.Alba = window.Alba || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA (checklist punto 10)
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. la luz ============ */
  const ESTADOS = ['alba', 'dia', 'atardecer', 'noche'];
  const portada = $('#portada');
  const temaMeta = $('meta[name="theme-color"]');
  const inicial = A.luzInicial || { luz: raiz.getAttribute('data-luz') || 'dia', fija: false };
  let elegida = inicial.fija ? inicial.luz : 'ahora';
  let real = inicial.luz, previa = null;
  function luzReal() {
    const S = A.sol;
    if (!S || !S.posicion) return real;
    try { const p = S.posicion(S.ahora()); return A.luzDe(p.altura, p.azimut < 180); } catch (e) { return real; }
  }
  function aplicarLuz() {
    const pagina = previa || (elegida !== 'ahora' ? elegida : (sobria() ? 'dia' : real));
    if (raiz.getAttribute('data-luz') !== pagina) raiz.setAttribute('data-luz', pagina);
    // en la sobria la portada lleva su luz (la de ahora o la elegida) aunque la página se quede de día
    if (portada) {
      if (sobria() && !previa && elegida === 'ahora') portada.setAttribute('data-luz', real);
      else portada.removeAttribute('data-luz');
    }
    $$('#luz button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.luz === elegida)));
    if (temaMeta) requestAnimationFrame(() => { temaMeta.content = getComputedStyle(document.body).backgroundColor; });
  }
  A.luz = {
    get actual() { return raiz.getAttribute('data-luz'); },
    get real() { return real; },
    get elegida() { return elegida; },
    elegir(e) { elegida = ESTADOS.includes(e) ? e : 'ahora'; if (elegida === 'ahora') real = luzReal(); aplicarLuz(); },
    previa(e) { previa = ESTADOS.includes(e) ? e : null; aplicarLuz(); },
    revisar() { real = luzReal(); aplicarLuz(); },
  };
  $$('#luz button').forEach((b) => b.addEventListener('click', () => A.luz.elegir(b.dataset.luz)));
  real = luzReal();
  aplicarLuz();
  // las transiciones de color, solo después de pintar la primera vez (si no, la página «amanece» al cargar)
  requestAnimationFrame(() => requestAnimationFrame(() => raiz.classList.add('con-luz')));
  setInterval(() => A.luz.revisar(), 60000);

  /* ============ 2. ir a un sitio ============ */
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cabecera')) || 68;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    scrollTo({ top: Math.max(0, y), behavior: quieto || sobria() ? 'auto' : 'smooth' });
  };

  /* ============ 3. cabecera: fondo al bajar y el enlace de la sección que se ve ============ */
  const cab = $('#cab');
  const enlaces = $$('.cab__nav a');
  const secciones = enlaces.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let actual = null;
  function pintarCabecera() {
    cab.classList.toggle('sc', scrollY > 24);
    raiz.classList.toggle('portada-arriba', !!portada && portada.getBoundingClientRect().bottom > cabAlto());
    const y = cabAlto() + altoVista * 0.25;
    let sec = null;
    for (const s of secciones) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) sec = s; }
    if (sec !== actual) {
      actual = sec;
      enlaces.forEach((a) => { if (sec && a.getAttribute('href') === '#' + sec.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    }
  }

  /* ============ 4. módulos ============ */
  const montados = new Map();
  const esperando = new Set();
  const modulo = (el) => { const m = A[el.dataset.modulo]; return m && typeof m.montar === 'function' ? m : null; };
  const opciones = () => ({ movimiento: motion && !sobria(), densidad: sobria() ? 'sobria' : 'amanece', webgl: !raiz.classList.contains('sin-webgl') });
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el);
    if (!mod) { esperando.add(el); if (document.readyState === 'complete') el.classList.add('sin-modulo'); return; }
    esperando.delete(el);
    el.classList.remove('sin-modulo');
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones());
      montados.set(el, { inst, respaldo });
      if (inst && inst.listo && typeof inst.listo.catch === 'function') inst.listo.catch((er) => { console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er); try { inst.destruir && inst.destruir(); } catch (e) { /* nada */ } el.innerHTML = respaldo; delete el.dataset.montado; el.classList.add('sin-modulo'); });
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      el.innerHTML = respaldo;
      el.classList.add('sin-modulo');
      montados.set(el, { inst: null, respaldo });
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); esperando.forEach((el) => el.classList.add('sin-modulo')); };
  addEventListener('load', reintentar);
  function remontarTodos() {
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      el.classList.remove('sin-modulo', 'es-montado');
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
  }
  const portadaMod = $('#portada [data-modulo="portada"]');
  if (portadaMod) montarModulo(portadaMod);
  const resto = $$('[data-modulo]').filter((el) => el !== portadaMod);
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    resto.forEach((el) => ioMod.observe(el));
  } else resto.forEach(montarModulo);
  // los clics dentro del 3D montado son del módulo
  const deModulo = (t) => !!t.closest('[data-modulo="lugar"][data-montado]');

  /* ============ 5. menú ============ */
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 6. enlaces internos y «Ver fechas» de cada ficha ============ */
  A.reservar = function (unidad) {
    if (unidad && A.reserva && A.reserva.unidad) A.reserva.unidad(unidad);
    else if (unidad) A.reservaPendiente = unidad;
    cerrarMenu();
    irA('#reservar');
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || deModulo(e.target)) return;
    const r = e.target.closest('[data-reservar]');
    if (r) { e.preventDefault(); A.reservar(r.getAttribute('data-reservar')); return; }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, quieto ? 50 : 900);
  });

  /* ============ 7. la visita virtual: el iframe no existe hasta que se pide ============ */
  const visitaBtn = $('#visita-btn');
  if (visitaBtn) visitaBtn.addEventListener('click', () => {
    const marco = $('#visita-marco');
    const f = document.createElement('iframe');
    f.src = marco.dataset.src;
    f.title = 'Visita virtual de los cuatro apartamentos (EuroWeb Media)';
    f.allow = 'fullscreen; xr-spatial-tracking; gyroscope; accelerometer';
    f.allowFullscreen = true;
    f.referrerPolicy = 'no-referrer';
    marco.replaceChildren(f);
    f.focus();
  });

  /* ============ 8. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'alba-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) { /* sin almacenamiento */ } };
  let verMando = () => {};          // el mando de maqueta (bloque 12) la cambia para apartarse del aviso
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });
  if (!leer()) ck.hidden = false;

  /* ============ 9. mapa de Google solo al pedirlo (sin clave de API) ============ */
  const mapaBtn = $('#mapa-btn');
  if (mapaBtn) mapaBtn.addEventListener('click', () => {
    const marco = document.createElement('iframe');
    const q = $('#mapa').dataset.q;
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=13&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con Caunedo (Somiedo) y los apartamentos';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    mapaBtn.remove();
  });

  /* ============ 10. el foco del teclado: contorno redondeado + el medio sol del alba en la esquina ============ */
  const marco = $('#foco-alba');
  const marcoPath = marco && marco.querySelector('.foco-alba__marco');
  const solPath = marco && marco.querySelector('.foco-alba__sol');
  if (marco) raiz.classList.add('foco-propio');
  let enfocado = null;
  function ponerMarco() {
    if (!marco) return;
    const el = enfocado;
    if (!el || !document.contains(el)) { marco.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { marco.classList.remove('es-visible'); return; }
    let fijo = false;                       // dentro de algo fijo (cabecera, menú, aviso de cookies…)
    for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') { fijo = true; break; }
    const m = 5, w = Math.round(r.width + 2 * m), h = Math.round(r.height + 2 * m);
    const rad = Math.min(14, h / 2);
    marco.classList.toggle('es-fijo', fijo);
    marco.style.left = (r.left - m + (fijo ? 0 : scrollX)) + 'px';
    marco.style.top = (r.top - m + (fijo ? 0 : scrollY)) + 'px';
    marco.style.width = w + 'px'; marco.style.height = h + 'px';
    marco.setAttribute('viewBox', `0 0 ${w} ${h}`);
    marcoPath.setAttribute('d', `M${rad} 1H${w - rad}A${rad - 1} ${rad - 1} 0 0 1 ${w - 1} ${rad}V${h - rad}A${rad - 1} ${rad - 1} 0 0 1 ${w - rad} ${h - 1}H${rad}A${rad - 1} ${rad - 1} 0 0 1 1 ${h - rad}V${rad}A${rad - 1} ${rad - 1} 0 0 1 ${rad} 1Z`);
    // el medio sol, asomando sobre el filo de arriba a la derecha (como el sol sobre las peñas)
    const cx = w - Math.max(18, rad + 6), R = 7;
    solPath.setAttribute('d', `M${cx - R} 1A${R} ${R} 0 0 1 ${cx + R} 1Z`);
    const enLugar = el.closest('#lugar');
    const portadaFoco = el.closest('#portada');
    marco.style.color = enLugar ? '#F2916B' : portadaFoco ? 'var(--sol)' : '';
    marco.style.setProperty('--foco-fondo', enLugar ? '#0E1316' : portadaFoco ? 'var(--suelo)' : 'var(--fondo)');
    marco.classList.add('es-visible');
  }
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible') && !el.closest('dialog'); } catch (er) { /* navegador viejo */ }
      enfocado = visible ? el : null;
      ponerMarco();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ 11. con el scroll (un rAF por fotograma, pasivo) ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    pintarCabecera();
    reintentar();
    if (enfocado && marco && marco.classList.contains('es-fijo')) ponerMarco();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  pintarCabecera();

  /* ============ 12. MANDO DE MAQUETA (no viaja al cliente) ============ */
  const mando = $('#mando');
  if (mando && raiz.classList.contains('revision')) {
    verMando = () => { mando.hidden = !ck.hidden; };
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      aplicarLuz();
      remontarTodos();
      document.dispatchEvent(new CustomEvent('alba:densidad', { detail: sobria() ? 'sobria' : 'amanece' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 13. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('alba:resize'));
      alScroll();
      ponerMarco();
    }, 200);
  });

  // recargar a media página: se entra arriba (checklist 12)
  addEventListener('pageshow', () => { if (!location.hash && scrollY > 0) scrollTo(0, 0); });

  // lo que pueden usar los módulos y las pruebas
  A.web = { motion, quieto, sobria, irA, montados, get altoVista() { return altoVista; } };
  document.dispatchEvent(new CustomEvent('alba:web'));
})();
