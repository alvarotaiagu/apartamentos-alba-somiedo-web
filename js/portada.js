/* ------------------------------------------------------------------
   Alba · «Amanece en Alba» · la portada y el día del pie
   - Alba.portada.montar(el, { movimiento, densidad }) → { destruir(), listo }: el panorama REAL desde la casa
     (data/portada.json: capas del MDT25 del IGN por distancia; el filo de arriba lo pone el horizonte de Lugar 3D,
     data/lugar-horizonte.json, el mismo con el que js/sol.js calcula cuándo entra el sol), «Alba» detrás de las peñas,
     el cielo de ahora (lo pinta la luz de la página) y el sol en su sitio real con su camino de hoy.
     Gesto: arrastrar en horizontal (dedo o ratón) mueve la HORA: el sol recorre su camino de hoy y la luz de toda la
     web le sigue; al soltar, vuelve a la hora de ahora. Con el teclado es un deslizador (flechas, RePág/AvPág, Inicio).
   - Alba.dia.montar(el, { movimiento }): el pie. El mismo perfil y el camino entero del sol de hoy, que se dibuja al
     llegar y deja el sol escondido tras las peñas por donde se va de verdad.
   - Alba.panorama: la geometría (sin DOM). La usa también construir.mjs (Node) para el respaldo sin JS.
   Necesita js/sol.js (Alba.sol, de Lugar 3D). Sin él, se queda el respaldo (el dibujo quieto).
   ------------------------------------------------------------------ */
(function (w) {
  'use strict';
  var A = w.Alba = w.Alba || {};
  var NS = 'http://www.w3.org/2000/svg';

  /* ============ geometría común (sin DOM) ============ */
  var P = {};
  function norm(a) { a %= 360; return a < 0 ? a + 360 : a; }
  P.norm = norm;
  // diferencia de rumbos en (−180, 180]
  P.dif = function (a, b) { var x = norm(a - b); return x > 180 ? x - 360 : x; };
  // valor de un perfil (cada 360/n grados) en un rumbo cualquiera, interpolado
  P.valor = function (perfil, az) {
    var n = perfil.length, x = norm(az) / (360 / n), i = Math.floor(x), f = x - i;
    return perfil[i % n] * (1 - f) + perfil[(i + 1) % n] * f;
  };
  // las capas con el filo de arriba del horizonte de Lugar: la que forma el horizonte se sube o baja hasta él; las
  // demás no pueden pasarlo
  P.ajustar = function (capas, horizonte) {
    var n = capas[0].perfil.length, paso = 360 / n, env = [];
    for (var i = 0; i < n; i++) { var m = -90; for (var k = 0; k < capas.length; k++) m = Math.max(m, capas[k].perfil[i]); env.push(m); }
    return capas.map(function (c) {
      return c.perfil.map(function (v, i) {
        var H = horizonte ? horizonte(i * paso) : undefined;
        if (typeof H !== 'number' || !isFinite(H)) return v;
        return env[i] - v < 0.3 ? v + (H - env[i]) : Math.min(v, H);
      });
    });
  };
  P.envolvente = function (perfiles) {
    return perfiles[0].map(function (_, i) { var m = -90; perfiles.forEach(function (p) { m = Math.max(m, p[i]); }); return m; });
  };
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  // camino SVG de un perfil entre los rumbos a0 y a1 (pueden pasar de 0 o de 360), cada 0,5°
  //   X(az) e Y(grados) → px; cerrar: baja hasta «fondo» y cierra (relleno); si no, solo la línea
  P.camino = function (perfil, a0, a1, X, Y, cerrar, fondo) {
    var s = '', paso = 0.5;
    for (var a = a0; a <= a1 + 1e-6; a += paso) s += (s ? 'L' : 'M') + r1(X(a)) + ' ' + r1(Y(P.valor(perfil, a)));
    if (cerrar) s += 'L' + r1(X(a1)) + ' ' + r1(fondo) + 'L' + r1(X(a0)) + ' ' + r1(fondo) + 'Z';
    return s;
  };
  P.miles = function (n) { n = Math.round(n); return n >= 1000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(n); };
  P.duracion = function (ms) {
    var m = Math.round(ms / 60000), h = Math.floor(m / 60);
    return h ? h + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min';
  };
  // la frase del sol para el instante t, con los tramos de sol en la casa de hoy y de mañana
  P.frase = function (S, t) {
    var tr = S.tramos(t);
    if (tr === undefined) return null;
    var b = function (f) { return '<b class="cifra">' + S.haciaLas(f) + '</b>'; };
    if (!tr.length) return 'Hoy el sol no llega a la casa: las peñas lo tapan todo el día.';
    var x = +t, ult = tr[tr.length - 1];
    if (x < +tr[0].desde) return 'Hoy el sol entra en la casa hacia las ' + b(tr[0].desde) + '.';
    if (x >= +ult.hasta) {
      var man = S.tramos(new Date(x + 86400000));
      if (man && man.length) return 'Mañana el sol entra en la casa hacia las ' + b(man[0].desde) + '.';
      return 'Hoy el sol se fue de la casa hacia las ' + b(ult.hasta) + '.';
    }
    for (var i = 0; i < tr.length; i++) {
      if (x >= +tr[i].desde && x < +tr[i].hasta) return 'Ahora da el sol en la casa. Entró hacia las ' + b(tr[0].desde) + ' y se va tras las peñas hacia las ' + b(ult.hasta) + '.';
      if (i + 1 < tr.length && x >= +tr[i].hasta && x < +tr[i + 1].desde) return 'Hoy el sol entró en la casa hacia las ' + b(tr[0].desde) + '. Ahora lo tapa una peña: vuelve hacia las ' + b(tr[i + 1].desde) + '.';
    }
    return null;
  };
  P.horasSol = function (tr) { return tr.reduce(function (s, x) { return s + (x.hasta - x.desde); }, 0); };
  A.panorama = P;

  if (!w.document) return;   // en Node (construir.mjs) solo hace falta la geometría
  var d = w.document;
  var el$ = function (tag, atrs, padre) { var e = d.createElementNS(NS, tag); for (var k in atrs) e.setAttribute(k, atrs[k]); if (padre) padre.appendChild(e); return e; };
  var datos = null;
  function cargarDatos() {
    if (!datos) datos = fetch('data/portada.json').then(function (r) { if (!r.ok) throw new Error('portada.json ' + r.status); return r.json(); });
    return datos;
  }
  function inicioDia(S, t) { var p = S.madrid(t); return S.desdeMadrid(p.anio, p.mes, p.dia, 0, 0); }
  // las fuentes: medir «Alba» con la letra de verdad (si no ha llegado, con las métricas de Darker Grotesque 800)
  function medirPalabra(fs) {
    try {
      var c = d.createElement('canvas').getContext('2d');
      c.font = '800 ' + fs + 'px "Darker Grotesque"';
      var m = c.measureText('Alba');
      if (m.width > 0 && d.fonts && d.fonts.check('800 20px "Darker Grotesque"')) return { ancho: m.width, alto: m.actualBoundingBoxAscent || 0.74 * fs };
    } catch (e) { /* sin canvas */ }
    return { ancho: 1.76 * fs, alto: 0.74 * fs };
  }

  /* ============ la portada ============ */
  function montarPortada(el, op) {
    var S = A.sol;
    if (!S || typeof S.cargar !== 'function') throw new Error('falta js/sol.js');
    var svg = el.querySelector('svg.pano');
    if (!svg) throw new Error('sin el dibujo de la portada');
    var sec = el.closest('.portada') || el.parentNode;
    var texto = sec.querySelector('.portada__texto');
    var lectura = sec.querySelector('#portada-hora');
    var fraseEl = d.getElementById('frase-sol');
    var movimiento = !!op.movimiento;
    var g = {
      cielo: svg.querySelector('#pano-cielo-g'), fondo: svg.querySelector('.pano__cielo'), estrellas: svg.querySelector('.pano__estrellas'),
      palabra: svg.querySelector('.pano__palabra'), mov: svg.querySelector('.pano__mov'), rumbos: svg.querySelector('.pano__rumbos'),
      capas: [].slice.call(svg.querySelectorAll('.pano__capa')), crestas: [].slice.call(svg.querySelectorAll('.pano__cresta')),
      cimas: svg.querySelector('.pano__cimas'), suelo: svg.querySelector('.pano__suelo'),
    };
    var camino = el$('path', { class: 'pano__camino' }), solG = el$('g', { class: 'pano__sol' });
    var halo = el$('circle', { class: 'pano__halo', r: 80 }, solG), disco = el$('circle', { class: 'pano__disco', r: 14 }, solG);
    g.mov.insertBefore(solG, g.mov.firstChild);
    g.mov.insertBefore(camino, g.mov.firstChild);
    var marcas = el$('g', { class: 'pano__marcas' }, g.mov);

    var perfiles = null, env = null, cimas = [], L = null, centro0 = 180;
    var tVista = +S.ahora(), arrastre = null, tween = 0, raf = 0, tVuelta = 0, tMin = 0, vivo = true, visible = true;
    var dia0 = 0, caminoDia = null;

    function layout() {
      var r = sec.getBoundingClientRect();
      var W = Math.max(320, Math.round(r.width)), H = Math.max(520, Math.round(r.height));
      var movil = W < 760;
      var span = Math.max(70, Math.min(175, W / (movil ? 4.9 : 8.4)));
      var kx = W / span;
      var cab = parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--cabecera')) || 68;
      var tAlto = texto ? texto.offsetHeight : 300;
      var y0 = Math.max(H * 0.48, Math.min(H * 0.74, H - tAlto - 8));
      // la escala vertical: la peña más alta, a media altura del cielo (casi a escala real en el escritorio; en el
      // móvil, algo exagerada para que se lea)
      var maxAlt = Math.max.apply(null, env);
      var ky = Math.max(kx * 0.85, Math.min(kx * 1.6, (y0 - cab) * 0.5 / maxAlt));
      L = { W: W, H: H, kx: kx, ky: ky, y0: y0, span: span, movil: movil, cab: cab, exag: ky / kx };
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('preserveAspectRatio', 'none');
      g.fondo.setAttribute('width', W); g.fondo.setAttribute('height', H);
      g.cielo.setAttribute('y2', y0);
      g.suelo.setAttribute('y', y0 - 1); g.suelo.setAttribute('width', W); g.suelo.setAttribute('height', Math.max(0, H - y0 + 1));
      var sg = svg.querySelector('#pano-suelo-g');
      if (sg) { sg.setAttribute('y1', y0); sg.setAttribute('y2', y0 + Math.min(160, (H - y0) * 0.5)); }
      el.style.setProperty('--y0', (y0 / H * 100).toFixed(2) + '%');
      dibujarRelieve();
      colocarPalabra();
      estrellas();
    }
    // las capas, las crestas, las cimas y los rumbos para ±200° alrededor de centro0 (al moverse, se traslada el grupo)
    function X0(az) { return L.W / 2 + (az - centro0) * L.kx; }
    function Y(v) { return L.y0 - v * L.ky; }
    function dibujarRelieve() {
      var a0 = centro0 - 200, a1 = centro0 + 200;
      perfiles.forEach(function (p, i) {
        if (g.capas[i]) g.capas[i].setAttribute('d', P.camino(p, a0, a1, X0, Y, true, L.H + 2));
        if (g.crestas[i]) g.crestas[i].setAttribute('d', P.camino(p, a0, a1, X0, Y, false));
      });
      // cimas con nombre (OSM) que asoman en el horizonte, con su cota del MDT
      while (g.cimas.firstChild) g.cimas.removeChild(g.cimas.firstChild);
      cimas.forEach(function (c) {
        var az = centro0 + P.dif(c.azimut, centro0), x = X0(az), y = Y(P.valor(env, c.azimut));
        var gr = el$('g', { class: 'pano__cima', 'data-az': az.toFixed(1) }, g.cimas);
        el$('path', { d: 'M' + r1(x) + ' ' + r1(y - 6) + 'V' + r1(y - 26) }, gr);
        var t = el$('text', { x: r1(x), y: r1(y - 32), 'text-anchor': 'middle' }, gr);
        t.textContent = c.nombre;
        var t2 = el$('text', { x: r1(x), y: r1(y - 32 - 15), 'text-anchor': 'middle', class: 'pano__cota' }, gr);
        t2.textContent = P.miles(c.cota) + ' m';
      });
      // los rumbos, en el suelo
      while (g.rumbos.firstChild) g.rumbos.removeChild(g.rumbos.firstChild);
      var NOM = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
      for (var a = Math.ceil(a0 / 45) * 45; a <= a1; a += 45) {
        var x = X0(a), t = el$('text', { x: r1(x), y: r1(L.y0 + 40), 'text-anchor': 'middle' }, g.rumbos);
        t.textContent = NOM[norm(a) / 45];
        el$('path', { d: 'M' + r1(x) + ' ' + r1(L.y0 + 18) + 'v8' }, g.rumbos);
      }
    }
    // «Alba» va DETRÁS de las peñas: su base, un cuarto por debajo del punto más alto del filo que tiene debajo, así
    // las cumbres le muerden las letras y la palabra se sigue leyendo. Se busca el sitio de la vista donde cabe más
    // grande (el filo más bajo) y se encoge hasta que empieza bajo la cabecera.
    var palabraPos = null;
    function colocarPalabra() {
      var margen = Math.max(16, L.W * (L.movil ? 0.05 : 0.06));
      var arriba = L.cab + (L.movil ? 14 : 22);
      var fs0 = Math.min((L.W - 2 * margen) / 1.76, L.W * (L.movil ? 1 : 0.42));
      var m0 = medirPalabra(fs0), k0 = m0.ancho / fs0, a0 = m0.alto / fs0;
      var dx = (centro0 - centroVista) * L.kx;
      var filo = function (x0, ancho) { var y = 1e9; for (var x = x0; x <= x0 + ancho; x += 6) y = Math.min(y, Y(P.valor(env, centro0 + (x - dx - L.W / 2) / L.kx))); return y; };
      var mejor = null;
      for (var x = margen; x <= L.W - margen - k0 * fs0 * 0.5; x += 12) {
        // la letra más grande que cabe aquí (ancho y alto), probando de mayor a menor
        for (var fs = fs0; fs > fs0 * 0.3; fs *= 0.94) {
          var ancho = k0 * fs; if (x + ancho > L.W - margen) continue;
          var y = filo(x, ancho), alto = a0 * fs;
          if (y + alto * 0.25 - alto >= arriba) { if (!mejor || fs > mejor.fs + 0.5) mejor = { x: x, fs: fs, base: y + alto * 0.25 }; break; }
        }
      }
      if (!mejor) { var fsM = fs0 * 0.5; mejor = { x: margen, fs: fsM, base: arriba + a0 * fsM }; }
      palabraPos = mejor;
      g.palabra.setAttribute('x', r1(mejor.x));
      g.palabra.setAttribute('y', r1(mejor.base));
      g.palabra.setAttribute('font-size', r1(mejor.fs));
    }
    function estrellas() {
      while (g.estrellas.firstChild) g.estrellas.removeChild(g.estrellas.firstChild);
      var semilla = 7, rnd = function () { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
      var n = Math.round(L.W * L.y0 / 9000);
      for (var i = 0; i < n; i++) el$('circle', { cx: r1(rnd() * L.W), cy: r1(rnd() * L.y0 * 0.9), r: (0.5 + rnd() * 1.1).toFixed(2), opacity: (0.35 + rnd() * 0.65).toFixed(2) }, g.estrellas);
    }
    // el camino del sol del día de t (cada 4 min mientras está sobre −4°), en coordenadas de centro0
    function caminoDelDia(t) {
      var t0 = +inicioDia(S, t);
      if (t0 === dia0 && caminoDia) return caminoDia;
      dia0 = t0;
      var pts = [];
      for (var x = t0; x < t0 + 86400000; x += 240000) { var p = S.posicion(new Date(x)); if (p.altura > -4) pts.push(p); }
      var tr = S.tramos(new Date(t0 + 43200000)) || [];
      caminoDia = { pts: pts, tr: tr, t0: t0 };
      return caminoDia;
    }
    function dibujarCamino(t) {
      var c = caminoDelDia(t);
      var s = '';
      c.pts.forEach(function (p, i) { var az = centro0 + P.dif(p.azimut, centro0); s += (i ? 'L' : 'M') + r1(X0(az)) + ' ' + r1(Y(p.altura)); });
      camino.setAttribute('d', s);
      while (marcas.firstChild) marcas.removeChild(marcas.firstChild);
      if (!c.tr.length) return;
      var poner = function (f, txt, cls) {
        var p = S.posicion(f), az = centro0 + P.dif(p.azimut, centro0), x = X0(az), y = Y(p.altura);
        var gr = el$('g', { class: 'pano__marca ' + cls }, marcas);
        el$('circle', { cx: r1(x), cy: r1(y), r: 4 }, gr);
        var tx = el$('text', { x: r1(x), y: r1(y - 14), 'text-anchor': 'middle' }, gr);
        tx.textContent = txt + ' ' + S.haciaLas(f);
      };
      poner(c.tr[0].desde, 'entra', 'pano__marca--entra');
      poner(c.tr[c.tr.length - 1].hasta, 'se va', 'pano__marca--sale');
    }
    // el sol en t; en el móvil la vista sigue al sol
    var centroVista = 180;
    function aplicar(t) {
      var p = S.posicion(t);
      if (L.movil && p.altura > -3) centroVista = centro0 + P.dif(p.azimut, centro0);
      var dx = (centro0 - centroVista) * L.kx;
      g.mov.setAttribute('transform', 'translate(' + r1(dx) + ' 0)');
      g.rumbos.setAttribute('transform', 'translate(' + r1(dx) + ' 0)');
      var az = centro0 + P.dif(p.azimut, centro0), x = X0(az), y = Y(p.altura);
      var r = Math.max(9, Math.min(17, L.kx * 1.5));
      disco.setAttribute('r', r1(r)); halo.setAttribute('r', r1(r * 6));
      solG.setAttribute('transform', 'translate(' + r1(x) + ' ' + r1(y) + ')');
      solG.classList.toggle('es-bajo', p.altura < -1);
      // las cimas que caen fuera de la vista o se pisan, ocultas
      var ult = -1e9;
      [].forEach.call(g.cimas.children, function (c) {
        var cx = X0(+c.getAttribute('data-az')) + dx, dentro = cx > 70 && cx < L.W - 70 && cx - ult > 150;
        c.style.display = dentro ? '' : 'none';
        if (dentro) ult = cx;
      });
      return p;
    }
    function ponerLectura(t, p) {
      if (!lectura) return;
      var v = S.visible(t);
      lectura.textContent = S.hora(t) + ' · ' + (p.altura < -0.8 ? 'el sol, bajo el horizonte' : 'el sol a ' + Math.round(p.altura) + '° · ' + (v ? 'da en la casa' : 'tapado por las peñas'));
      el.setAttribute('aria-valuenow', String(Math.round((t - inicioDia(S, t)) / 60000)));
      el.setAttribute('aria-valuetext', S.hora(t) + (v ? ', da el sol en la casa' : ', la casa a la sombra'));
    }
    function luzPrevia(p) { if (A.luz && A.luz.previa) A.luz.previa(p ? A.luzDe(p.altura, p.azimut < 180) : null); }
    function frase() {
      var ahora = S.ahora();
      var f = P.frase(S, ahora);
      if (f && fraseEl) fraseEl.innerHTML = f;
      var tr = S.tramos(ahora) || [], o = S.oficial(ahora);
      var put = function (k, v) { var x = sec.querySelector('[data-hoy="' + k + '"]'); if (x) x.textContent = v; };
      put('orto', o.orto ? S.hora(o.orto) : 'no amanece');
      put('ocaso', o.ocaso ? S.hora(o.ocaso) : 'no anochece');
      put('entra', tr.length ? S.haciaLas(tr[0].desde) : 'no entra');
      put('sale', tr.length ? S.haciaLas(tr[tr.length - 1].hasta) : '·');
      put('horas', tr.length ? P.duracion(P.horasSol(tr)) + (tr.length > 1 ? ' en ' + tr.length + ' ratos' : '') : '0 min');
    }
    function pintar() {
      raf = 0;
      var p = aplicar(new Date(tVista));
      if (arrastre || tween) { ponerLectura(new Date(tVista), p); luzPrevia(p); }
    }
    var pedir = function () { if (!raf) raf = requestAnimationFrame(pintar); };

    // vuelta a la hora de ahora (con movimiento, en 900 ms; si no, de golpe)
    function volver() {
      clearTimeout(tVuelta);
      var desde = tVista, hasta = +S.ahora();
      var fin = function () { tween = 0; tVista = hasta; sec.classList.remove('es-arrastre'); luzPrevia(null); pedir(); };
      if (!movimiento || Math.abs(hasta - desde) < 60000) { fin(); return; }
      var t0 = performance.now();
      tween = 1;
      (function paso(ahora) {
        if (!tween) return;
        var k = Math.min(1, (ahora - t0) / 900), e = 1 - Math.pow(1 - k, 3);
        tVista = desde + (hasta - desde) * e;
        pintar();
        if (k < 1) requestAnimationFrame(paso); else fin();
      })(t0);
    }
    function minPorPx() { return 4 / L.kx; }        // el sol anda ~15° por hora: arrastrar el sol con el dedo
    function limites(t) { var a = +inicioDia(S, new Date(t)); return [a, a + 86399000]; }
    var alBajar = function (e) {
      if (e.target.closest('a, button')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      tween = 0; clearTimeout(tVuelta);
      arrastre = { x: e.clientX, t: tVista, id: e.pointerId, movido: false };
    };
    var alMover = function (e) {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      var dx = e.clientX - arrastre.x;
      if (!arrastre.movido) {
        if (Math.abs(dx) < 6) return;
        arrastre.movido = true;
        sec.classList.add('es-arrastre');
        try { el.setPointerCapture(e.pointerId); } catch (er) { /* sin captura */ }
      }
      var lim = limites(arrastre.t);
      tVista = Math.max(lim[0], Math.min(lim[1], arrastre.t + dx * minPorPx() * 60000));
      pedir();
    };
    var alSoltar = function (e) {
      if (!arrastre || (e && e.pointerId !== arrastre.id)) return;
      var movido = arrastre.movido;
      arrastre = null;
      if (movido) tVuelta = setTimeout(volver, 1400);
    };
    var alTeclado = function (e) {
      var m = { ArrowLeft: -10, ArrowDown: -10, ArrowRight: 10, ArrowUp: 10, PageDown: -60, PageUp: 60 }[e.key];
      if (m) {
        e.preventDefault(); tween = 0; clearTimeout(tVuelta);
        var lim = limites(tVista);
        tVista = Math.max(lim[0], Math.min(lim[1], tVista + m * 60000));
        sec.classList.add('es-arrastre');
        arrastre = null; pintar();
        ponerLectura(new Date(tVista), S.posicion(new Date(tVista))); luzPrevia(S.posicion(new Date(tVista)));
      } else if (e.key === 'Home' || e.key === 'Escape') { if (sec.classList.contains('es-arrastre')) { e.preventDefault(); volver(); } }
    };
    var alPerderFoco = function () { if (sec.classList.contains('es-arrastre') && !arrastre) volver(); };

    // cada minuto, el sol de ahora (y la frase) si no se está moviendo; nada si la portada no se ve
    function cadaMinuto() {
      if (!vivo) return;
      if (visible && !arrastre && !tween && !sec.classList.contains('es-arrastre')) {
        tVista = +S.ahora(); dibujarCamino(new Date(tVista)); pedir();
      }
      frase();
    }
    var io = 'IntersectionObserver' in w ? new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }) : null;
    var alResize = function () { if (!perfiles) return; layout(); dibujarCamino(new Date(tVista)); pedir(); };

    var listo = Promise.all([cargarDatos(), S.cargar()]).then(function (res) {
      if (!vivo) return;
      var D = res[0];
      perfiles = P.ajustar(D.capas, S.horizonte);
      env = P.envolvente(perfiles);
      cimas = (D.cimas || []).filter(function (c) { return c.tipo === 'peak'; });
      // la vista de reposo: el sur en el escritorio; en el móvil, el sol (o por donde entra hoy)
      var p = S.posicion(new Date(tVista)), tr = S.tramos(new Date(tVista)) || [];
      centro0 = 180;
      layout();
      if (L.movil) centroVista = centro0 + P.dif(p.altura > -3 ? p.azimut : (tr.length ? S.posicion(tr[0].desde).azimut : 140), centro0);
      else centroVista = 180 + Math.max(-40, Math.min(40, P.dif(p.azimut, 180) * (p.altura > -3 ? 0.35 : 0)));
      colocarPalabra();
      dibujarCamino(new Date(tVista));
      aplicar(new Date(tVista));
      frase();
      sec.classList.add('es-viva');
      el.setAttribute('data-montado', '');
      if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { if (vivo) colocarPalabra(); });
      if (op.densidad !== 'sobria') {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'slider');
        el.setAttribute('aria-label', 'Hora del sol en la portada: flechas para moverla, Inicio para volver a ahora');
        el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '1439');
        ponerLectura(new Date(tVista), p);
        el.addEventListener('pointerdown', alBajar);
        el.addEventListener('pointermove', alMover);
        el.addEventListener('pointerup', alSoltar);
        el.addEventListener('pointercancel', alSoltar);
        el.addEventListener('keydown', alTeclado);
        el.addEventListener('blur', alPerderFoco);
      }
      d.addEventListener('alba:resize', alResize);
      if (io) io.observe(sec);
      tMin = setInterval(cadaMinuto, 60000);
    });

    return {
      listo: listo,
      // para las pruebas: mover la hora como lo haría el dedo
      hora: function (t) { tVista = +t; pintar(); return S.hora(new Date(tVista)); },
      estado: function () { return { L: L, centro: centroVista, tVista: tVista, arrastre: !!arrastre, tween: !!tween, palabra: palabraPos }; },
      destruir: function () {
        vivo = false; clearInterval(tMin); clearTimeout(tVuelta); cancelAnimationFrame(raf); tween = 0;
        if (io) io.disconnect();
        d.removeEventListener('alba:resize', alResize);
        ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(function (n, i) { el.removeEventListener(n, [alBajar, alMover, alSoltar, alSoltar][i]); });
        el.removeEventListener('keydown', alTeclado); el.removeEventListener('blur', alPerderFoco);
        ['tabindex', 'role', 'aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'data-montado'].forEach(function (a) { el.removeAttribute(a); });
        sec.classList.remove('es-viva', 'es-arrastre');
        luzPrevia(null);
      },
    };
  }
  A.portada = { montar: montarPortada };

  /* ============ el pie: el día entero, que se completa ============ */
  function montarDia(el, op) {
    var S = A.sol;
    if (!S || typeof S.cargar !== 'function') throw new Error('falta js/sol.js');
    var svg = el.querySelector('svg.dia');
    var txt = el.querySelector('#dia-txt');
    if (!svg) throw new Error('sin el dibujo del pie');
    var vb = svg.viewBox.baseVal, W = vb.width, Hh = vb.height;
    var a0 = +svg.getAttribute('data-a0'), a1 = +svg.getAttribute('data-a1'), y0 = +svg.getAttribute('data-y0'), k = +svg.getAttribute('data-k');
    var X = function (az) { return (az - a0) * (W / (a1 - a0)); };
    var Y = function (v) { return y0 - v * k; };
    var grupo = svg.querySelector('.dia__sol');
    var vivo = true, io = null, hecho = false;
    var listo = S.cargar().then(function () {
      if (!vivo) return;
      var ahora = S.ahora(), p0 = S.madrid(ahora), t0 = +S.desdeMadrid(p0.anio, p0.mes, p0.dia, 0, 0);
      var tr = S.tramos(ahora) || [];
      var todo = '', luz = '';
      var pos = function (t) { var p = S.posicion(new Date(t)); return [X(norm(p.azimut)), Y(p.altura), p]; };
      for (var t = t0; t < t0 + 86400000; t += 300000) { var q = pos(t); if (q[2].altura > -2) todo += (todo ? 'L' : 'M') + r1(q[0]) + ' ' + r1(q[1]); }
      tr.forEach(function (x) { var s = ''; for (var t = +x.desde; t <= +x.hasta; t += 120000) { var q = pos(t); s += (s ? 'L' : 'M') + r1(q[0]) + ' ' + r1(q[1]); } luz += s; });
      while (grupo.firstChild) grupo.removeChild(grupo.firstChild);
      var cTodo = el$('path', { class: 'dia__camino', d: todo, pathLength: 1 }, grupo);
      var cLuz = el$('path', { class: 'dia__luz', d: luz, pathLength: 1 }, grupo);
      var sol = el$('circle', { class: 'dia__disco', r: 7 }, grupo);
      var final = tr.length ? +tr[tr.length - 1].hasta : null;
      // las horas van delante de las peñas (en su grupo, al final del dibujo)
      var marcas = svg.querySelector('.dia__marcas') || svg;
      while (marcas !== svg && marcas.firstChild) marcas.removeChild(marcas.firstChild);
      var marca = function (f, t) { var q = pos(f); var gt = el$('text', { x: r1(q[0]), y: r1(q[1] - 12), 'text-anchor': 'middle', class: 'dia__hora' }, marcas); gt.textContent = t + ' ' + S.haciaLas(new Date(f)); };
      if (tr.length) { marca(+tr[0].desde, 'entra'); marca(final, 'se va'); }
      // el sol, primero donde entra; al completarse, donde se va (detrás de las peñas: la cresta va por encima)
      var ponerSol = function (f) { var q = pos(f); sol.setAttribute('cx', r1(q[0])); sol.setAttribute('cy', r1(q[1])); };
      if (txt) {
        var man = S.tramos(new Date(t0 + 86400000 + 43200000)) || [];
        txt.innerHTML = tr.length
          ? 'Hoy, <b class="cifra">' + P.duracion(P.horasSol(tr)) + '</b> de sol en la casa' + (tr.length > 1 ? ', en ' + tr.length + ' ratos' : '') + ': entra hacia las <b class="cifra">' + S.haciaLas(tr[0].desde) + '</b> y se va tras las peñas hacia las <b class="cifra">' + S.haciaLas(new Date(final)) + '</b>.' + (man.length ? ' Mañana entra hacia las <b class="cifra">' + S.haciaLas(man[0].desde) + '</b>.' : '')
          : 'Hoy el sol no llega a la casa: las peñas lo tapan todo el día.';
      }
      if (!tr.length) { el.classList.add('es-completo'); return; }
      var completar = function () {
        if (hecho) return; hecho = true;
        el.classList.add('es-completo');
        if (!op.movimiento) { ponerSol(final); return; }
        var ini = +tr[0].desde, t1 = performance.now(), dur = 2600;
        (function paso(n) {
          if (!vivo) return;
          var e = Math.min(1, (n - t1) / dur), f = e < .5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
          ponerSol(ini + (final - ini) * f);
          if (e < 1) requestAnimationFrame(paso);
        })(t1);
      };
      ponerSol(op.movimiento ? +tr[0].desde : final);
      if (!op.movimiento) { completar(); return; }
      el.classList.add('es-preparado');
      if ('IntersectionObserver' in w) {
        io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { completar(); io.disconnect(); } }, { threshold: 0.35 });
        io.observe(el);
      } else completar();
      void cTodo; void cLuz;
    });
    return {
      listo: listo,
      completar: function () { el.classList.add('es-completo'); },
      destruir: function () { vivo = false; if (io) io.disconnect(); el.classList.remove('es-completo', 'es-preparado'); },
    };
  }
  A.dia = { montar: montarDia };
})(typeof window !== 'undefined' ? window : globalThis);
