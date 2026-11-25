/* ------------------------------------------------------------------
   Alba · lugar.js · «El alba, hoy» (agente Lugar 3D)
   window.Alba.lugar.montar(el, { movimiento, densidad, webgl }) → { destruir(), estado(), ver3d(), verPlano(), hora(fecha|null) }

   El valle de Somiedo alrededor de Caunedo con el relieve (MDT05/MDT25/
   MDT200) y la ortofoto PNOA del IGN (CC BY 4.0) y la casa modelada sobre
   su planta del Catastro. Con el scroll la cámara baja de las cumbres al
   valle y llega a la casa. El sol es el de ahora (Alba.sol, js/sol.js) y
   las peñas echan su sombra sobre el valle: se calcula en la GPU marchando
   por el relieve hacia el sol, solo cuando el sol cambia. Un mando de hora
   enseña cómo la línea de sol baja por la ladera hasta tocar la casa; la
   luz de la casa sale de Alba.sol (el mismo horizonte que la portada), así
   que la hora en la que se enciende la casa en la escena es la de la web.
   - Three.js 0.160.0, copia propia en vendor/, pedido con import() solo
     cuando hace falta (nunca en el móvil antes de pulsar el botón).
   - Plan B en el mismo hueco (sin WebGL, movimiento reducido, «sobria»,
     ahorro de datos, móvil antes del botón, navegador automatizado): el
     valle desde el aire con la sombra de las peñas calculada en un canvas
     2D para la hora elegida, el mismo mando de hora y la línea del día.
   El HTML que trae `el` es el respaldo: se guarda y se repone al destruir.
   Parámetros: ?fps · ?sin-webgl · ?lugar=3d (fuerza el 3D en un navegador
   automatizado; solo para pruebas) · ?hora=HH:MM y ?fecha=AAAA-MM-DD (los
   lee Alba.sol: la portada y el 3D enseñan el mismo instante).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var A = (window.Alba = window.Alba || {});
  if (A.lugar && A.lugar.montar) return;

  var SCRIPT = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var RAIZ = SCRIPT ? new URL('../', SCRIPT).href : (typeof location !== 'undefined' ? new URL('./', location.href).href : './');
  var BASE = RAIZ + 'img/lugar/';
  var ESCENA = RAIZ + 'data/lugar-escena.json';
  var THREE_URL = RAIZ + 'vendor/three-0.160.0.module.min.js';
  var RAD = Math.PI / 180, MIN = 60000;
  var LAT = 43.067674, LON = -6.257025;

  /* ============ utilidades ============ */
  var lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var suave = function (a, b, x) { var t = lim((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var hexA = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); };
  var mezcla = function (a, b, t) { var x = hexA(a), y = hexA(b); return '#' + x.map(function (v, i) { return pad(Math.round(lim(lerp(v, y[i], t), 0, 255)).toString(16)); }).join(''); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var RUMBOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  var rumbo = function (az) { return RUMBOS[Math.round((((az % 360) + 360) % 360) / 45) % 8]; };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var S = function () { return A.sol; };
  function horaDe(f) { return S() ? S().hora(f) : pad(f.getHours()) + ':' + pad(f.getMinutes()); }
  function duracion(ms) { var m = Math.round(ms / MIN); return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + pad(m % 60) : ''); }
  function mismoDia(a, b) { var p = S().madrid(a), q = S().madrid(b); return p.anio === q.anio && p.mes === q.mes && p.dia === q.dia; }
  function inicioDia(f) { var p = S().madrid(f); return S().desdeMadrid(p.anio, p.mes, p.dia, 0, 0); }

  /* ============ la luna (fórmulas de SunCalc, V. Agafonkin; solo para la noche) ============ */
  var J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  var dias = function (f) { return f.valueOf() / 864e5 - 0.5 + J1970 - J2000; };
  var ascRec = function (l, b) { return Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)); };
  var declin = function (l, b) { return Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)); };
  function luna(f) {
    var d = dias(f), phi = RAD * LAT;
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    var l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F), dist = 385001 - 20905 * Math.cos(M);
    var ra = ascRec(l, b), dec = declin(l, b);
    var Ms = RAD * (357.5291 + 0.98560028 * d), Ls = Ms + RAD * (1.9148 * Math.sin(Ms) + 0.02 * Math.sin(2 * Ms) + 0.0003 * Math.sin(3 * Ms)) + RAD * 102.9372 + Math.PI;
    var sra = ascRec(Ls, 0), sdec = declin(Ls, 0);
    var H = RAD * (280.16 + 360.9856235 * d) + RAD * LON - ra;
    var alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
    var az = (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180 + 360) % 360;
    var fi = Math.acos(Math.sin(sdec) * Math.sin(dec) + Math.cos(sdec) * Math.cos(dec) * Math.cos(sra - ra));
    var inc = Math.atan2(149598000 * Math.sin(fi), dist - 149598000 * Math.cos(fi));
    var ang = Math.atan2(Math.cos(sdec) * Math.sin(sra - ra), Math.sin(sdec) * Math.cos(dec) - Math.cos(sdec) * Math.sin(dec) * Math.cos(sra - ra));
    return { alt: alt, az: az, luz: (1 + Math.cos(inc)) / 2, fase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
  }

  /* ============ el día en la casa (todo sale de Alba.sol) ============ */
  // { tr: [{desde, hasta}], en, sa, total, orto, ocaso } o null si Alba.sol no tiene el horizonte
  function resumenDia(f) {
    var s = S(); if (!s) return null;
    var tr = s.tramos(f); if (tr === undefined) return null;
    var of = s.oficial(f);
    return { tr: tr, en: tr.length ? tr[0].desde : null, sa: tr.length ? tr[tr.length - 1].hasta : null,
      total: tr.reduce(function (a, x) { return a + (x.hasta - x.desde); }, 0), orto: of.orto, ocaso: of.ocaso };
  }
  function fraseDia(r, f, real) {
    if (!r) return '';
    var p = S().madrid(f), quien = mismoDia(f, real) ? 'Hoy' : 'El ' + p.dia + ' de ' + MESES[p.mes - 1];
    if (!r.tr.length) return quien + ' el sol no llega a la casa: las peñas lo tapan todo el día.';
    return quien + ' el sol entra en la casa hacia las ' + S().haciaLas(r.en) + ' y se esconde tras las peñas hacia las ' +
      S().haciaLas(r.sa) + ': ' + duracion(r.total) + ' de sol directo' + (r.tr.length > 1 ? ', en ' + r.tr.length + ' ratos' : '') + '.';
  }
  // qué pasa en la casa en ese instante (el estado de la luz, con el sol y la peña en grados)
  function fraseInstante(f, r) {
    var s = S(), p = s.posicion(f), hz = s.horizonte(p.azimut), h = horaDe(f);
    if (hz === undefined || !r) return 'A las ' + h + ' el sol está a ' + Math.round(p.altura) + '° sobre el horizonte.';
    if (p.altura < -6) {
      var l = luna(f);
      return 'A las ' + h + ' es de noche en Caunedo' + (l.alt > 0 && l.luz > 0.05 ? '; la luna está a ' + Math.round(l.alt) + '° al ' + rumbo(l.az) : '') + '.';
    }
    if (p.altura < 0) return 'A las ' + h + ' el sol está bajo el horizonte' + (f < r.orto || !r.orto ? ': clarea por el ' + rumbo(p.azimut) : ': anochece') + '.';
    if (s.visible(f)) return 'A las ' + h + ' da el sol en la casa: está a ' + Math.round(p.altura) + '° sobre el horizonte, al ' + rumbo(p.azimut) + ', por encima de las peñas.';
    var antes = r.en && f < r.en, despues = r.sa && f > r.sa;
    var vuelve = r.tr.filter(function (x) { return x.desde > f; })[0];
    var base = 'A las ' + h + ' el sol está a ' + Math.round(p.altura) + '°, pero por el ' + rumbo(p.azimut) + ' la peña sube hasta ' + Math.round(hz) + '°: ';
    if (!r.tr.length) return base + 'hoy no llega a la casa.';
    if (antes) return base + 'la casa sigue a la sombra hasta las ' + horaDe(r.en) + '.';
    if (despues) return base + 'la casa ya está a la sombra.';
    return base + 'el sol se ha metido tras una cresta; vuelve a las ' + horaDe(vuelve ? vuelve.desde : r.sa) + '.';
  }

  /* ============ el cielo según la altura del sol ============ */
  var CIELO = [            // [altura del sol, cenit, horizonte]
    [-18, '#04060d', '#0a0f1e'],
    [-10, '#0a1230', '#22284a'],
    [-4, '#22305c', '#8a5c6c'],
    [0, '#3c5893', '#ee9e7a'],
    [5, '#5a80bd', '#f4c7a0'],
    [15, '#6c96ce', '#dce5ec'],
    [40, '#4c82c4', '#cfdeea'],
  ];
  function cieloPara(alt) {
    if (alt <= CIELO[0][0]) return { cz: CIELO[0][1], ch: CIELO[0][2] };
    for (var i = 1; i < CIELO.length; i++) {
      if (alt <= CIELO[i][0]) { var a = CIELO[i - 1], b = CIELO[i], t = (alt - a[0]) / (b[0] - a[0]); return { cz: mezcla(a[1], b[1], t), ch: mezcla(a[2], b[2], t) }; }
    }
    var u = CIELO[CIELO.length - 1]; return { cz: u[1], ch: u[2] };
  }

  /* ============ el recorrido: interpolación monótona por componente ============ */
  // Hermite con tangentes de Fritsch-Butland: no se pasa de largo aunque los tramos sean de kilómetros al
  // principio y de metros al final. Empieza y acaba en reposo. (La misma en scripts/lugar-datos.py.)
  function monotona(ps, vs) {
    var n = ps.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]);
    m[0] = 0; m[n - 1] = 0;
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
      var h0 = ps[i] - ps[i - 1], h1 = ps[i + 1] - ps[i];
      m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
    }
    return function (p) {
      if (p <= ps[0]) return vs[0];
      if (p >= ps[n - 1]) return vs[n - 1];
      var k = 0; while (k < n - 2 && p > ps[k + 1]) k++;
      var h = ps[k + 1] - ps[k], t = (p - ps[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }
  function camino(rec) {
    var ps = rec.map(function (r) { return r.p; });
    var f = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.pos[k]; })); });
    var g = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.mira[k]; })); });
    return function (p) { return { pos: [f[0](p), f[1](p), f[2](p)], mira: [g[0](p), g[1](p), g[2](p)] }; };
  }

  /* ============ alturas: PNG RGB → metros ============ */
  function cargarAlturas(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('alturas ' + r.status); return r.blob(); })
      .then(function (b) {
        var op = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
        return (window.createImageBitmap ? createImageBitmap(b, op).catch(function () { return createImageBitmap(b); }) : Promise.reject(new Error('sin createImageBitmap')));
      })
      .then(function (bmp) {
        var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        var d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, out = new Float32Array(n);
        for (var i = 0; i < n; i++) out[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 10 - 100;
        if (bmp.close) bmp.close();
        return { w: c.width, h: c.height, data: out };
      });
  }
  function muestreador(r) {
    var sx = (r.w - 1) / (r.x1 - r.x0), sz = (r.h - 1) / (r.z1 - r.z0), w = r.w, h = r.h, a = r.data;
    return function (x, z) {
      var fx = lim((x - r.x0) * sx, 0, w - 1.0001), fz = lim((z - r.z0) * sz, 0, h - 1.0001);
      var i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * w + i;
      return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + w] * (1 - u) + a[k + w + 1] * u) * v;
    };
  }
  function pesoCaja(r, x, z, b) { var d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z); return lim(d / b, 0, 1); }

  /* ============ la sombra del relieve en 2D (plan B, y la prueba de coherencia con Alba.sol) ============ */
  // ¿le da el sol al punto (x, z), a hOjo metros sobre el suelo? Marcha hacia el sol por el relieve; devuelve 0..1
  // (penumbra del disco solar). alturaFn(x, z) en metros de la escena.
  // Los pasos crecen un k por paso hasta `tope` metros (así no se salta las crestas lejanas). La GPU hace lo mismo.
  function luzEn(alturaFn, x, z, hOjo, az, alt, pasos, k, tope) {
    if (alt < -1) return 0;
    var dx = Math.sin(az * RAD), dz = -Math.cos(az * RAD), tanS = Math.tan(alt * RAD);
    var y = alturaFn(x, z) + hOjo, t = 6, maxT = -10;
    for (var i = 0; i < pasos && t < 7500; i++) {
      var h = alturaFn(x + dx * t, z + dz * t);
      if (h > -1e3) { var a = (h - y) / t; if (a > maxT) maxT = a; }
      t += Math.min(t * (k - 1), tope || 1e9);
    }
    var w = 0.0047 * (1 + tanS * tanS);
    return suave(-w, w, tanS - maxT);
  }

  // [pasos, crecimiento, tope en m]: escritorio y móvil (y el plan B, con los del móvil)
  var RAYO = { alta: [150, 1.08, 80], movil: [96, 1.12, 130] };

  /* ============ texturas dibujadas (ligeras) ============ */
  function azar(semilla) { var s = semilla >>> 0 || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function lienzo(lado, pintar, alto) { var c = document.createElement('canvas'); c.width = lado; c.height = alto || lado; pintar(c.getContext('2d'), lado, alto || lado); return c; }
  function ruidoPlano(g, L, r, k) {
    var im = g.getImageData(0, 0, L, L), d = im.data;
    for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * k; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  }
  // mampostería de granito (la de su zócalo: piezas irregulares, grises y ocres, junta clara rehundida)
  function texPiedra(semilla) {
    return lienzo(512, function (g, L) {
      var r = azar(semilla);
      g.fillStyle = '#8c877e'; g.fillRect(0, 0, L, L);
      var y = 0;
      while (y < L) {
        var hh = 34 + r() * 30, x = -r() * 60;
        while (x < L + 60) {
          var ww = 46 + r() * 74, inc = (r() - 0.5) * 10, inc2 = (r() - 0.5) * 10;
          var base = r() < 0.55 ? '#b9b2a4' : r() < 0.6 ? '#a69f92' : '#c2ae8c';
          g.fillStyle = mezcla(base, r() < 0.5 ? '#6f6a62' : '#d8d2c6', r() * 0.35);
          g.beginPath();
          g.moveTo(x + 3, y + 3 + inc); g.lineTo(x + ww - 3, y + 3 + inc2); g.lineTo(x + ww - 3 + (r() - 0.5) * 8, y + hh - 3); g.lineTo(x + 3 + (r() - 0.5) * 8, y + hh - 3);
          g.closePath(); g.fill();
          g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 3, y + hh - 6, ww - 6, 3);
          x += ww;
        }
        y += hh;
      }
      ruidoPlano(g, L, r, 18);
    });
  }
  function texRevoco(base, semilla) {
    return lienzo(256, function (g, L) {
      var r = azar(semilla); g.fillStyle = base; g.fillRect(0, 0, L, L);
      ruidoPlano(g, L, r, 10);
      for (var k = 0; k < 30; k++) { g.fillStyle = 'rgba(60,50,40,' + (r() * 0.035).toFixed(3) + ')'; g.fillRect(r() * L, r() * L, 10 + r() * 40, 2 + r() * 30); }
    });
  }
  function texGranito(semilla) {
    return lienzo(128, function (g, L) {
      var r = azar(semilla); g.fillStyle = '#b4b0a8'; g.fillRect(0, 0, L, L);
      for (var k = 0; k < 900; k++) { g.fillStyle = r() < 0.5 ? 'rgba(40,40,40,.35)' : 'rgba(255,255,255,.35)'; g.fillRect(r() * L, r() * L, 1 + r() * 1.5, 1 + r() * 1.5); }
    });
  }
  function texTeja(semilla) {        // teja árabe roja: canales en columnas, hileras escalonadas, cada pieza con su tono
    return lienzo(256, function (g, L) {
      var r = azar(semilla), cols = 8, filas = 8, cw = L / cols, fh = L / filas;
      g.fillStyle = '#5a2a1e'; g.fillRect(0, 0, L, L);
      for (var j = 0; j < filas; j++) for (var i = 0; i < cols; i++) {
        var x = i * cw, y = j * fh, t = mezcla('#a4533c', r() < 0.5 ? '#7d3b2b' : '#c0704f', r() * 0.45);
        var gr = g.createLinearGradient(x, 0, x + cw, 0);
        gr.addColorStop(0, mezcla(t, '#2a140e', 0.45)); gr.addColorStop(0.45, mezcla(t, '#ffffff', 0.12)); gr.addColorStop(1, mezcla(t, '#2a140e', 0.5));
        g.fillStyle = gr; g.fillRect(x + 1, y, cw - 2, fh + 3);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 1, y + fh - 2, cw - 2, 3);
      }
      ruidoPlano(g, L, r, 12);
    });
  }
  function texMadera(semilla) {
    return lienzo(128, function (g, L) {
      var r = azar(semilla); g.fillStyle = '#8a5a34'; g.fillRect(0, 0, L, L);
      for (var k = 0; k < 40; k++) { g.fillStyle = 'rgba(' + (r() < 0.5 ? '60,35,15' : '170,120,70') + ',' + (0.08 + r() * 0.12).toFixed(2) + ')'; g.fillRect(0, r() * L, L, 1 + r() * 3); }
    });
  }

  /* ============ el mando de hora (igual en el 3D y en el plano) ============ */
  // Una línea del día (del orto al ocaso) con los ratos de sol en la casa, un deslizador de hora y dos botones.
  function htmlMando(id) {
    return '<div class="lugar__mando" data-mando="' + id + '">' +
      '<p class="lugar__dia" data-l="dia"></p>' +
      '<div class="lugar__linea" aria-hidden="true"><svg viewBox="0 0 1000 24" preserveAspectRatio="none"><rect class="lugar__linea-luz" x="0" y="9" width="0" height="6"/><g class="lugar__linea-sol"></g><line class="lugar__linea-ahora" x1="0" x2="0" y1="1" y2="23"/></svg>' +
      '<p class="lugar__linea-horas"><span data-l="orto"></span><span data-l="ocaso"></span></p></div>' +
      '<label class="lugar__hora"><span class="lugar__hora-tit">Hora</span><b data-l="hora">--:--</b>' +
      '<input type="range" data-l="rango" min="0" max="1440" step="5" value="720" aria-label="Hora del día en Caunedo"></label>' +
      '<p class="lugar__botones"><button type="button" class="lugar__btn lugar__btn--suave" data-l="ahora">Ahora</button>' +
      '<button type="button" class="lugar__btn lugar__btn--suave" data-l="ver" hidden>Ver cómo entra el sol</button></p>' +
      '<p class="lugar__instante" data-l="instante" aria-live="polite"></p>' +
      '</div>';
  }

  /* ============ módulo ============ */
  function montar(el, opciones) {
    opciones = opciones || {};
    var q = new URLSearchParams(location.search);
    var reduce = opciones.movimiento === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sobria = opciones.densidad === 'sobria';
    var movil = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
    var ahorro = !!(navigator.connection && navigator.connection.saveData);
    var forzar3d = q.get('lugar') === '3d';                                       // solo para pruebas
    var automatizado = !!navigator.webdriver && !forzar3d;                         // Playwright: nunca pinta el 3D
    var sinWebgl = opciones.webgl === false || q.has('sin-webgl') || automatizado;
    if (!sinWebgl && !sobria && !reduce && !forzar3d) {
      try { var cv0 = document.createElement('canvas'); sinWebgl = !cv0.getContext('webgl2'); } catch (e) { sinWebgl = true; }
    }
    var puede3d = !sinWebgl && !sobria && !reduce;
    var auto3d = puede3d && !movil && !ahorro;
    var respaldo = el.innerHTML;
    var estado = { modo: 'plano', destruido: false, error3d: null, cargado: false, p: 0, pVis: 0, calidad: 0, t: null, sigue: true, anim: 0 };
    var escuchas = [];
    var escucha = function (o, ev, fn, op) { o.addEventListener(ev, fn, op); escuchas.push(function () { o.removeEventListener(ev, fn, op); }); };
    var t3 = null, meta = null, cargando = null, intervalo = 0, plano = null;

    /* ---------- DOM ---------- */
    el.classList.add('lugar-mod');
    el.innerHTML =
      '<div class="lugar__pista">' +
        '<div class="lugar__escenario" role="img" aria-label="Vuelo en 3D desde las cumbres de Somiedo hasta la casa de Alba en Caunedo, con el relieve real y la luz del sol de este momento">' +
          '<div class="lugar__rotulos" aria-hidden="true"></div>' +
          '<div class="lugar__hud"><p class="lugar__ahora" data-l="ahora3d"></p></div>' +
          htmlMando('3d') +
          '<ol class="lugar__paradas"></ol>' +
          '<div class="lugar__pie3d"><p class="lugar__creditos">Relieve y ortofoto: IGN · Casa: Catastro · Nombres: OSM</p>' +
          '<button type="button" class="lugar__btn lugar__btn--suave" data-l="aplano">Ver en plano</button></div>' +
          '<p class="lugar__aviso" data-l="aviso" role="status" hidden></p>' +
        '</div>' +
      '</div>' +
      '<div class="lugar__planob">' +
        '<figure class="lugar__mapa">' +
          '<div class="lugar__marco"><img alt="El valle de Somiedo alrededor de Caunedo desde el aire (ortofoto del IGN), seis kilómetros de lado" decoding="async" loading="lazy" src="' + BASE + 'plano-720.webp" srcset="' + BASE + 'plano-720.webp 720w, ' + BASE + 'plano-1100.webp 1100w" sizes="(max-width: 820px) 100vw, 56vw">' +
          '<canvas class="lugar__sombra" width="160" height="160" aria-hidden="true"></canvas>' +
          '<ul class="lugar__marcas" aria-hidden="true"></ul><span class="lugar__norte" aria-hidden="true">N</span></div>' +
          '<figcaption data-l="pie2d">El valle desde el aire, seis kilómetros de lado. Lo oscuro es la sombra de las peñas a la hora del mando.</figcaption>' +
        '</figure>' +
        '<div class="lugar__panel"><p class="lugar__ahora" data-l="ahora2d"></p>' + htmlMando('2d') +
        '<p class="lugar__acciones"><button type="button" class="lugar__btn" data-l="a3d" hidden>Ver el valle en 3D</button></p></div>' +
      '</div>' +
      '<p class="lugar__fuente">Relieve MDT05, MDT25 y MDT200 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0) · Planta de la casa © Dirección General del Catastro · Nombres de pueblos y cumbres © colaboradores de OpenStreetMap. A escala real, sin exagerar el relieve. El sol se calcula en tu navegador para Caunedo con el relieve del IGN, que no ve árboles ni casas: las horas son «hacia las».</p>';
    var $ = function (k, raiz) { return (raiz || el).querySelector('[data-l="' + k + '"]'); };
    var pista = el.querySelector('.lugar__pista'), escenario = el.querySelector('.lugar__escenario');
    var capaRot = el.querySelector('.lugar__rotulos');
    var aviso = $('aviso');
    var avisar = function (t) { aviso.textContent = t || ''; aviso.hidden = !t; };
    var mandos = [].slice.call(el.querySelectorAll('.lugar__mando'));

    /* ---------- paradas ---------- */
    var PARADAS = [], lisParadas = [], paradaActual = -1;
    function ponParadas(ps) {
      PARADAS = ps;
      el.querySelector('.lugar__paradas').innerHTML = ps.map(function (p, i) { return '<li data-i="' + i + '"><b>' + esc(p.t) + '</b><span>' + esc(p.d) + '</span></li>'; }).join('');
      lisParadas = [].slice.call(el.querySelectorAll('.lugar__paradas li'));
      paradaActual = -1; marcarParada(estado.pVis);
    }
    function marcarParada(p) {
      if (!PARADAS.length) return;
      var i = 0; for (var k = 0; k < PARADAS.length; k++) if (p >= PARADAS[k].desde - 0.001) i = k;
      if (i === paradaActual) return;
      paradaActual = i;
      lisParadas.forEach(function (li, k) { li.classList.toggle('es-actual', k === i); li.classList.toggle('es-pasada', k < i); });
    }

    /* ---------- la hora de la escena ---------- */
    var dia = null;                 // { inicio, r, a, b } del día que se enseña (minutos desde las 0:00 de Madrid)
    function horaReal() { return S() ? S().ahora() : new Date(); }
    function prepararDia(f) {
      var ini = inicioDia(f), r = resumenDia(f);
      var a = 6 * 60, b = 21 * 60;
      if (r && r.orto && r.ocaso) { a = Math.floor(((r.orto - ini) / MIN - 60) / 5) * 5; b = Math.ceil(((r.ocaso - ini) / MIN + 60) / 5) * 5; }
      dia = { inicio: ini, r: r, a: lim(a, 0, 1435), b: lim(b, 5, 1440) };
      mandos.forEach(function (m) {
        var rg = $('rango', m); rg.min = dia.a; rg.max = dia.b;
        $('dia', m).textContent = fraseDia(r, f, new Date());
        $('orto', m).textContent = r && r.orto ? 'sale ' + horaDe(r.orto) : '';
        $('ocaso', m).textContent = r && r.ocaso ? 'se pone ' + horaDe(r.ocaso) : '';
        $('ver', m).hidden = reduce || !r;
        var X = function (t) { return lim(((t - ini) / MIN - dia.a) / (dia.b - dia.a) * 1000, 0, 1000).toFixed(1); };
        var luz = m.querySelector('.lugar__linea-luz');
        if (r && r.orto && r.ocaso) { luz.setAttribute('x', X(r.orto)); luz.setAttribute('width', (X(r.ocaso) - X(r.orto)).toFixed(1)); }
        m.querySelector('.lugar__linea-sol').innerHTML = r ? r.tr.map(function (x) { return '<rect x="' + X(x.desde) + '" y="5" width="' + Math.max(2, X(x.hasta) - X(x.desde)).toFixed(1) + '" height="14"/>'; }).join('') : '';
      });
    }
    function ponHora(f, sigue) {
      if (!S()) return;
      if (!dia || !mismoDia(f, dia.inicio)) prepararDia(f);
      estado.t = f; estado.sigue = !!sigue;
      var min = (f - dia.inicio) / MIN;
      var p = S().posicion(f);
      mandos.forEach(function (m) {
        var rg = $('rango', m);
        if (document.activeElement !== rg) rg.value = String(lim(Math.round(min / 5) * 5, dia.a, dia.b));
        rg.setAttribute('aria-valuetext', horaDe(f));
        $('hora', m).textContent = horaDe(f);
        $('ahora', m).disabled = !!sigue;
        $('instante', m).textContent = fraseInstante(f, dia.r);
        var x = lim((min - dia.a) / (dia.b - dia.a) * 1000, 0, 1000).toFixed(1), ln = m.querySelector('.lugar__linea-ahora');
        ln.setAttribute('x1', x); ln.setAttribute('x2', x);
        m.classList.toggle('con-sol', !!S().visible(f));
      });
      var lugar = 'en Caunedo · ' + (sigue ? (p.altura > -6 ? 'el sol de ahora' : 'el cielo de ahora') : 'la hora que eliges');
      $('ahora3d').innerHTML = '<b>' + horaDe(f) + ' ' + esc(lugar) + '</b>';
      $('ahora2d').innerHTML = '<b>' + horaDe(f) + '</b> ' + esc(lugar);
      el.style.setProperty('--lugar-noche', String(lim((-p.altura - 1) / 10, 0, 1).toFixed(2)));
      el.classList.toggle('es-noche', p.altura < -6);
      if (t3) t3.luces(f);
      if (plano) plano.pedir();
    }
    function aAhora() { pararAnim(); ponHora(horaReal(), true); }
    function deRango(m) { pararAnim(); var v = +$('rango', m).value; ponHora(new Date(+dia.inicio + v * MIN), false); }
    // «Ver cómo entra el sol»: de un poco antes de que asome a un poco después (con movimiento; 7 s)
    function pararAnim() { if (estado.anim) cancelAnimationFrame(estado.anim); estado.anim = 0; }
    function verEntrar() {
      if (!dia || !dia.r) return;
      pararAnim();
      var r = dia.r, t1 = r.en ? +r.en + 25 * MIN : +dia.inicio + 13 * 60 * MIN, t0 = r.en ? Math.max(+r.orto - 20 * MIN, +r.en - 100 * MIN) : +r.orto;
      var tIni = performance.now(), DUR = 7000;
      var paso = function (ts) {
        var k = lim((ts - tIni) / DUR, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        ponHora(new Date(t0 + (t1 - t0) * e), false);
        estado.anim = k < 1 && !estado.destruido ? requestAnimationFrame(paso) : 0;
      };
      estado.anim = requestAnimationFrame(paso);
    }
    mandos.forEach(function (m) {
      var rg = $('rango', m);
      escucha(rg, 'input', function () { deRango(m); });
      escucha($('ahora', m), 'click', aAhora);
      escucha($('ver', m), 'click', verEntrar);
    });

    function ponModo(m) {
      estado.modo = m;
      el.dataset.modo = m;
      $('a3d').hidden = !(puede3d && m === 'plano' && !estado.error3d);
      if (t3) t3.activo(m === '3d');
      if (m === 'plano' && plano) plano.pedir();
    }

    /* ---------- plan B: el valle desde el aire con la sombra de las peñas ---------- */
    function montarPlano(m) {
      var o = m.orto.plano, ancho = o.x1 - o.x0;
      var ul = el.querySelector('.lugar__marcas');
      var marcas = m.lugares.filter(function (l) { return l.x > o.x0 + 80 && l.x < o.x1 - 80 && l.z > o.z0 + 80 && l.z < o.z1 - 80 && (l.tipo !== 'cima' || l.enPerfil || /Mocoso/.test(l.nombre)); });
      ul.innerHTML = marcas.map(function (l) {
        var x = (l.x - o.x0) / ancho * 100, y = (l.z - o.z0) / ancho * 100;
        return '<li class="lugar__marca lugar__marca--' + l.tipo + (x > 64 ? ' a-la-izq' : '') + '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%"><span>' + esc(l.nombre) + (l.sub && l.tipo !== 'pueblo' ? ' <small>' + esc(l.sub) + '</small>' : '') + '</span></li>';
      }).join('');
      var cv = el.querySelector('.lugar__sombra'), g = cv.getContext('2d'), N = cv.width, alturas = null, pend = 0;
      cargarAlturas(BASE + m.rasters.plano.archivo).then(function (b) {
        alturas = muestreador(Object.assign({}, m.rasters.plano, b));
        pedir();
      }).catch(function (e) { console.warn('Lugar: sin alturas para el plano', e); });
      var hFn = function (x, z) { return (x < -6000 || x > 6000 || z < -6000 || z > 6000) ? -1e4 : alturas(x, z); };
      function pintar() {
        pend = 0;
        if (!alturas || !estado.t || estado.destruido) return;
        var p = S().posicion(estado.t), im = g.createImageData(N, N), d = im.data, paso = ancho / N;
        var noche = lim((-p.altura - 1) / 10, 0, 1);
        for (var j = 0; j < N; j++) {
          for (var i = 0; i < N; i++) {
            var x = o.x0 + (i + 0.5) * paso, z = o.z0 + (j + 0.5) * paso, luz = 0;
            if (p.altura > -1) {
              // la cara del monte que mira al sol (normal del relieve) y la sombra que echan las peñas
              var hx = hFn(x + 20, z) - hFn(x - 20, z), hz = hFn(x, z + 20) - hFn(x, z - 20);
              var nx = -hx / 40, nz = -hz / 40, nl = 1 / Math.sqrt(nx * nx + nz * nz + 1);
              var lx = Math.sin(p.azimut * RAD) * Math.cos(p.altura * RAD), lz = -Math.cos(p.azimut * RAD) * Math.cos(p.altura * RAD), ly = Math.sin(p.altura * RAD);
              var cara = lim((nx * lx + nz * lz + ly) * nl * 3, 0, 1);
              luz = cara > 0 ? cara * luzEn(hFn, x, z, 1, p.azimut, p.altura, RAYO.movil[0], RAYO.movil[1], RAYO.movil[2]) : 0;
            }
            var k = (j * N + i) * 4, sombra = 1 - luz;
            d[k] = 12; d[k + 1] = 16; d[k + 2] = 34;
            d[k + 3] = Math.round(255 * lim(0.58 * sombra * (1 - noche) + noche * 0.86, 0, 0.9));
          }
        }
        g.putImageData(im, 0, 0);
      }
      var tUlt = 0, espera = 0;
      function pedir() {
        if (pend || espera) return;
        var falta = 100 - (performance.now() - tUlt);                 // como mucho, ~10 veces por segundo
        var ya = function () { espera = 0; pend = requestAnimationFrame(function () { tUlt = performance.now(); pintar(); }); };
        if (falta > 0) espera = setTimeout(ya, falta); else ya();
      }
      return { pedir: pedir, cancelar: function () { if (pend) cancelAnimationFrame(pend); if (espera) clearTimeout(espera); pend = espera = 0; } };
    }

    /* ---------- datos ---------- */
    var pSol = S() ? S().cargar().catch(function (e) { console.warn('Lugar: sin horizonte', e); }) : Promise.resolve();
    var pMeta = fetch(ESCENA).then(function (r) { if (!r.ok) throw new Error('lugar-escena.json ' + r.status); return r.json(); })
      .then(function (m) { meta = m; if (!estado.destruido) { ponParadas(m.paradas); plano = montarPlano(m); if (estado.t) plano.pedir(); } return m; });
    pMeta.catch(function (e) { console.warn('Lugar: sin datos', e); });

    /* ---------- el 3D ---------- */
    function cargar3d() {
      if (t3) return Promise.resolve(t3);
      if (cargando) return cargando;
      avisar('Cargando el relieve del valle…');
      var hiDef = !movil && !ahorro;
      cargando = Promise.all([pMeta, pSol]).then(function (rr) {
        var m = rr[0];
        return Promise.all([
          import(THREE_URL),
          cargarAlturas(BASE + m.rasters.valle.archivo), cargarAlturas(BASE + m.rasters.cerca.archivo), cargarAlturas(BASE + m.rasters.lejos.archivo),
        ]).then(function (r) {
          if (estado.destruido) return null;
          var R = {};
          ['valle', 'cerca', 'lejos'].forEach(function (k, i) { var b = r[i + 1], o = m.rasters[k]; R[k] = Object.assign({}, o, { w: b.w, h: b.h, data: b.data }); });
          return crear3d(r[0], m, R, hiDef);
        });
      }).then(function (t) { avisar(''); return t; }, function (e) {
        estado.error3d = String((e && e.message) || e);
        console.warn('Lugar: el 3D no está disponible:', e);
        avisar(''); cargando = null; ponModo('plano');
        return null;
      });
      return cargando;
    }

    function crear3d(THREE, m, R, hiDef) {
      var cv = document.createElement('canvas');
      cv.className = 'lugar__lienzo'; cv.setAttribute('aria-hidden', 'true');
      escenario.insertBefore(cv, capaRot);
      var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: hiDef, powerPreference: 'high-performance', alpha: false, stencil: false });
      var topeDPR = function () { return estado.calidad >= 1 ? 1 : (movil ? 1.25 : 1.5); };
      ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
      ren.outputColorSpace = THREE.SRGBColorSpace;
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.shadowMap.autoUpdate = false;
      var anis = Math.min(8, ren.capabilities.getMaxAnisotropy());
      var esc3 = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(42, 1.6, 1, 200000);
      var disponer = [];
      var guarda = function (o) { disponer.push(o); return o; };
      var i, j;
      var CAS = m.casa, H0 = CAS.y;

      /* --- alturas combinadas: casa 4 m, valle 20 m, lejos 250 m (a escala real; ya con la curvatura) --- */
      var hV = muestreador(R.valle), hC = muestreador(R.cerca), hL = muestreador(R.lejos);
      function altura(x, z) {
        var wv = pesoCaja(R.valle, x, z, 1);
        if (wv <= 0) return hL(x, z);
        var h = hV(x, z), wc = pesoCaja(R.cerca, x, z, 60);
        return wc > 0 ? lerp(h, hC(x, z), wc) : h;
      }

      /* --- la sombra del relieve: dos texturas (valle a ~12 m, casa a ~2,3 m) que se recalculan en la GPU
             solo cuando cambia el sol; el suelo y los edificios las leen (ver «patchRelieve») --- */
      var OFS = 1000;
      function texAlturas(r) {
        var n = r.w * r.h, d = new Uint16Array(n), th = THREE.DataUtils.toHalfFloat;
        for (var k = 0; k < n; k++) d[k] = th(r.data[k] - OFS);
        var t = new THREE.DataTexture(d, r.w, r.h, THREE.RedFormat, THREE.HalfFloatType);
        t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true;
        return guarda(t);
      }
      var caja4 = function (r) { return new THREE.Vector4(r.x0, r.z0, r.x1, r.z1); };
      var uAlt = {
        hValle: { value: texAlturas(R.valle) }, cValle: { value: caja4(R.valle) }, nValle: { value: R.valle.w },
        hCerca: { value: texAlturas(R.cerca) }, cCerca: { value: caja4(R.cerca) }, nCerca: { value: R.cerca.w },
        hOfs: { value: OFS },
      };
      var GLSL_ALT = [
        'uniform sampler2D hValle; uniform vec4 cValle; uniform float nValle;',
        'uniform sampler2D hCerca; uniform vec4 cCerca; uniform float nCerca; uniform float hOfs;',
        'float alturaEn(vec2 q) {',
        '  vec2 a = (q - cCerca.xy) / (cCerca.zw - cCerca.xy);',
        '  if (a.x > 0.003 && a.y > 0.003 && a.x < 0.997 && a.y < 0.997) return textureLod(hCerca, (a * (nCerca - 1.0) + 0.5) / nCerca, 0.0).r + hOfs;',
        '  vec2 b = (q - cValle.xy) / (cValle.zw - cValle.xy);',
        '  if (b.x < 0.0 || b.y < 0.0 || b.x > 1.0 || b.y > 1.0) return -1.0e4;',
        '  return textureLod(hValle, (b * (nValle - 1.0) + 0.5) / nValle, 0.0).r + hOfs;',
        '}'].join('\n');
      var RY = hiDef ? RAYO.alta : RAYO.movil, NPASOS = RY[0];
      var uPase = Object.assign({ L: { value: new THREE.Vector3(0, 1, 0) }, caja: { value: new THREE.Vector4() } }, uAlt);
      var matPase = guarda(new THREE.ShaderMaterial({
        uniforms: uPase, depthTest: false, depthWrite: false,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: [GLSL_ALT, 'uniform vec3 L; uniform vec4 caja; varying vec2 vUv;',
          'void main(){',
          '  vec2 q = caja.xy + vUv * (caja.zw - caja.xy);',
          '  float luz = 0.0;',
          '  if (L.y > -0.02) {',
          '    float lh = max(length(L.xz), 1e-4); vec2 d = L.xz / lh; float tanS = L.y / lh;',
          '    float y = alturaEn(q) + 0.6, t = 5.0, maxT = -10.0;',
          '    for (int i = 0; i < ' + NPASOS + '; i++) {',
          '      float h = alturaEn(q + d * t);',
          '      maxT = max(maxT, (h - y) / t);',
          '      t += min(t * ' + (RY[1] - 1).toFixed(3) + ', ' + RY[2].toFixed(1) + ');',
          '      if (t > 7500.0) break;',
          '    }',
          '    float w = 0.0047 * (1.0 + tanS * tanS);',
          '    luz = smoothstep(-w, w, tanS - maxT);',
          '  }',
          '  gl_FragColor = vec4(luz, luz, luz, 1.0);',
          '}'].join('\n'),
      }));
      var escPase = new THREE.Scene(), camPase = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      var quad = new THREE.Mesh(guarda(new THREE.PlaneGeometry(2, 2)), matPase);
      quad.frustumCulled = false;                 // los vértices ya van en coordenadas de pantalla
      escPase.add(quad);
      var opRT = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
      var rtValle = guarda(new THREE.WebGLRenderTarget(hiDef ? 1024 : 512, hiDef ? 1024 : 512, opRT));
      var rtCerca = guarda(new THREE.WebGLRenderTarget(hiDef ? 512 : 384, hiDef ? 512 : 384, opRT));
      function recalcularSombras(Lw) {
        uPase.L.value.copy(Lw);
        [[rtValle, R.valle], [rtCerca, R.cerca]].forEach(function (x) {
          uPase.caja.value.copy(caja4(x[1]));
          ren.setRenderTarget(x[0]); ren.render(escPase, camPase);
        });
        ren.setRenderTarget(null);
      }
      var uSom = { sValle: { value: rtValle.texture }, sCerca: { value: rtCerca.texture }, scValle: { value: caja4(R.valle) }, scCerca: { value: caja4(R.cerca) }, luzCasa: { value: 1 } };
      // Lambert + la sombra del relieve en la luz direccional (sol o luna). En la casa de Alba, la luz que da
      // Alba.sol (luzCasa): así se enciende a la misma hora que dice la web.
      function patchRelieve(mat, casa) {
        mat.onBeforeCompile = function (sh) {
          Object.assign(sh.uniforms, uSom);
          sh.vertexShader = 'varying vec3 vMundo;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
            '#include <begin_vertex>',
            'vec4 mw_ = vec4(transformed, 1.0);',
            '#ifdef USE_INSTANCING', 'mw_ = instanceMatrix * mw_;', '#endif',
            'vMundo = (modelMatrix * mw_).xyz;'].join('\n'));
          var luces = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );',
            'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= factorRelieve;');
          sh.fragmentShader = ['varying vec3 vMundo;', 'uniform sampler2D sValle; uniform sampler2D sCerca; uniform vec4 scValle; uniform vec4 scCerca; uniform float luzCasa;',
            'float sombraRelieve(vec3 p) {',
            '  float s = 1.0;',
            '  vec2 b = (p.xz - scValle.xy) / (scValle.zw - scValle.xy);',
            '  if (b.x > 0.0 && b.y > 0.0 && b.x < 1.0 && b.y < 1.0) s = texture2D(sValle, b).r;',
            '  vec2 a = (p.xz - scCerca.xy) / (scCerca.zw - scCerca.xy);',
            '  float wa = smoothstep(0.0, 0.08, min(min(a.x, 1.0 - a.x), min(a.y, 1.0 - a.y)));',
            '  if (wa > 0.0) s = mix(s, texture2D(sCerca, clamp(a, 0.0, 1.0)).r, wa);',
            '  return s;',
            '}'].join('\n') + '\n' + sh.fragmentShader.replace('#include <lights_fragment_begin>',
            (casa ? 'float factorRelieve = luzCasa;\n' : 'float factorRelieve = sombraRelieve(vMundo);\n') + luces);
        };
        mat.customProgramCacheKey = function () { return casa ? 'relieve-casa' : 'relieve'; };
        return mat;
      }

      /* --- el suelo: ortofoto del valle + la de la casa, fundidas en el sombreado --- */
      var ldr = new THREE.TextureLoader(), pendientes = 0, tListo = performance.now() + 7000;
      var cargaTex = function (url, alListo) {
        pendientes++;
        return ldr.load(url, function (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; t.needsUpdate = true; if (alListo) alListo(t); pendientes--; pedir(true); },
          undefined, function () { pendientes--; console.warn('Lugar: no carga', url); pedir(true); });
      };
      var O = m.orto, calidadTex = hiDef ? 'alta' : 'baja';
      var uSuelo = { mapCerca: { value: null }, cerCaja: { value: caja4(O.cerca) }, cercaListo: { value: 0 } };
      var matValle = patchRelieve(guarda(new THREE.MeshLambertMaterial({ color: '#5f6a55' })), false);
      var compilaRelieve = matValle.onBeforeCompile;
      matValle.onBeforeCompile = function (sh) {
        compilaRelieve(sh);
        Object.assign(sh.uniforms, uSuelo);
        sh.fragmentShader = 'uniform sampler2D mapCerca;\nuniform vec4 cerCaja;\nuniform float cercaListo;\n' +
          sh.fragmentShader.replace('#include <map_fragment>', [
            '#ifdef USE_MAP',
            '  vec4 texel = texture2D(map, vMapUv);',
            '  vec2 cu = (vMundo.xz - cerCaja.xy) / (cerCaja.zw - cerCaja.xy);',
            '  if (cercaListo > 0.5 && cu.x > 0.0 && cu.x < 1.0 && cu.y > 0.0 && cu.y < 1.0) {',
            '    vec4 tc = texture2D(mapCerca, vec2(cu.x, 1.0 - cu.y));',
            '    texel = mix(texel, tc, smoothstep(0.0, 0.12, min(min(cu.x, 1.0 - cu.x), min(cu.y, 1.0 - cu.y))));',
            '  }',
            // la ortofoto trae las sombras del día del vuelo: se aclaran un poco los oscuros (las de ahora las pone el relieve)
            '  texel.rgb = pow(texel.rgb, vec3(0.88));',
            '  diffuseColor *= texel;',
            '#endif'].join('\n'));
      };
      matValle.customProgramCacheKey = function () { return 'suelo-valle'; };
      cargaTex(BASE + O.valle.archivos[calidadTex], function (t) { matValle.map = t; matValle.color.set('#ffffff'); matValle.needsUpdate = true; });
      cargaTex(BASE + O.cerca.archivos[calidadTex], function (t) { uSuelo.mapCerca.value = t; uSuelo.cercaListo.value = 1; });
      var matLejos = patchRelieve(guarda(new THREE.MeshLambertMaterial({ color: '#5c6658', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 })), false);
      cargaTex(BASE + O.lejos.archivos[calidadTex], function (t) { matLejos.map = t; matLejos.color.set('#ffffff'); matLejos.needsUpdate = true; });

      /* --- relieve: rejilla densa alrededor de la casa, más abierta lejos --- */
      var F_ = hiDef ? 1 : 1.7, TOPE = hiDef ? 60 : 85;
      function ejes(a0, a1, zonas) {             // zonas: [desde, hasta, paso]; el paso crece un 6 % por metro fuera de cada zona
        var pasoEn = function (v) {
          var s = TOPE;
          zonas.forEach(function (zn) { var d = v < zn[0] ? zn[0] - v : v > zn[1] ? v - zn[1] : 0; s = Math.min(s, zn[2] * F_ + 0.06 * d); });
          return s;
        };
        var out = [a0], v = a0;
        while (v < a1 - 0.01) { v = Math.min(a1, v + pasoEn(v + pasoEn(v) / 2)); out.push(v); }
        return out;
      }
      function rejilla(xs, zs, yFn, uvCaja, hueco, faldon) {
        var nx = xs.length, nz = zs.length, n = nx * nz;
        var nF = faldon ? 2 * (nx + nz) : 0;
        var pos = new Float32Array((n + nF) * 3), uv = new Float32Array((n + nF) * 2);
        var kk = 0, ii, jj;
        for (jj = 0; jj < nz; jj++) for (ii = 0; ii < nx; ii++, kk++) {
          var x = xs[ii], z = zs[jj];
          pos[kk * 3] = x; pos[kk * 3 + 1] = yFn(x, z, ii, jj); pos[kk * 3 + 2] = z;
          uv[kk * 2] = (x - uvCaja.x0) / (uvCaja.x1 - uvCaja.x0); uv[kk * 2 + 1] = 1 - (z - uvCaja.z0) / (uvCaja.z1 - uvCaja.z0);
        }
        var idx = [];
        for (jj = 0; jj < nz - 1; jj++) for (ii = 0; ii < nx - 1; ii++) {
          if (hueco && ii >= hueco[0] && ii < hueco[2] && jj >= hueco[1] && jj < hueco[3]) continue;
          var a = jj * nx + ii, b = a + 1, c = a + nx, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
        if (faldon) {                                     // el borde baja como una pared: tapa las rendijas entre mallas
          var borde = [], f0 = n;
          for (ii = 0; ii < nx; ii++) borde.push(ii);
          for (jj = 1; jj < nz; jj++) borde.push(jj * nx + nx - 1);
          for (ii = nx - 2; ii >= 0; ii--) borde.push((nz - 1) * nx + ii);
          for (jj = nz - 2; jj > 0; jj--) borde.push(jj * nx);
          borde.forEach(function (v, qq) {
            var w = f0 + qq;
            pos[w * 3] = pos[v * 3]; pos[w * 3 + 1] = pos[v * 3 + 1] - faldon; pos[w * 3 + 2] = pos[v * 3 + 2];
            uv[w * 2] = uv[v * 2]; uv[w * 2 + 1] = uv[v * 2 + 1];
          });
          for (var q2 = 0; q2 < borde.length; q2++) {
            var v0 = borde[q2], v1 = borde[(q2 + 1) % borde.length], w0 = f0 + q2, w1 = f0 + (q2 + 1) % borde.length;
            idx.push(v0, w0, v1, v1, w0, w1, v0, v1, w0, v1, w1, w0);
          }
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(n + nF > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeVertexNormals();
        return guarda(g);
      }
      var V = R.valle;
      var xs = ejes(V.x0, V.x1, [[-220, 220, 4]]), zs = ejes(V.z0, V.z1, [[-220, 220, 4]]);
      var suelo = new THREE.Mesh(rejilla(xs, zs, function (x, z) { return altura(x, z); }, O.valle, null, 200), matValle);
      suelo.receiveShadow = true;
      esc3.add(suelo);
      var L = R.lejos, xsL = [], zsL = [];
      for (i = 0; i < L.w; i++) xsL.push(L.x0 + i * (L.x1 - L.x0) / (L.w - 1));
      for (j = 0; j < L.h; j++) zsL.push(L.z0 + j * (L.z1 - L.z0) / (L.h - 1));
      var lejos = new THREE.Mesh(rejilla(xsL, zsL, function (x, z, ii, jj) { return L.data[jj * L.w + ii]; }, O.lejos, L.hueco, 300), matLejos);
      esc3.add(lejos);

      /* --- cielo: cúpula con degradado y brillo hacia el sol --- */
      var uCielo = { cZ: { value: new THREE.Color() }, cH: { value: new THREE.Color() }, dirSol: { value: new THREE.Vector3(0, 1, 0) }, brillo: { value: 0 }, cLuz: { value: new THREE.Color('#ffb27a') } };
      var cielo = new THREE.Mesh(guarda(new THREE.SphereGeometry(150000, 40, 20)), guarda(new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false, uniforms: uCielo,
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: ['uniform vec3 cZ; uniform vec3 cH; uniform vec3 dirSol; uniform float brillo; uniform vec3 cLuz; varying vec3 vP;',
          'void main(){ vec3 d = normalize(vP); float h = d.y; vec3 c = mix(cH, cZ, smoothstep(-0.02, 0.5, h)); if (h < -0.02) c = cH;',
          ' float s = max(dot(d, dirSol), 0.0); float vel = 1.0 - smoothstep(0.0, 0.5, abs(h));',
          ' c += cLuz * brillo * (pow(s, 5.0) * 0.45 + pow(s, 64.0) * 0.5) * vel;',
          ' gl_FragColor = vec4(c, 1.0);', ' #include <colorspace_fragment>', '}'].join('\n'),
      })));
      cielo.renderOrder = -10; cielo.frustumCulled = false;
      esc3.add(cielo);
      esc3.fog = new THREE.FogExp2('#d9e2e9', 1 / 30000);
      var rnd = azar(23), nE = hiDef ? 1100 : 600, ePos = new Float32Array(nE * 3);
      for (i = 0; i < nE; i++) {
        var a0 = rnd() * Math.PI * 2, hh = Math.asin(0.02 + rnd() * 0.97);
        ePos[i * 3] = Math.cos(hh) * Math.sin(a0) * 120000; ePos[i * 3 + 1] = Math.sin(hh) * 120000; ePos[i * 3 + 2] = -Math.cos(hh) * Math.cos(a0) * 120000;
      }
      var eGeo = guarda(new THREE.BufferGeometry()); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
      var estrellas = new THREE.Points(eGeo, guarda(new THREE.PointsMaterial({ color: '#f3eee4', size: movil ? 1.4 : 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })));
      estrellas.frustumCulled = false; esc3.add(estrellas);
      var texDe = function (lado, f) { var c = lienzo(lado, f), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return guarda(t); };
      var solS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texDe(128, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,248,226,1)'); r.addColorStop(0.13, 'rgba(255,236,190,1)'); r.addColorStop(0.3, 'rgba(255,205,150,.35)'); r.addColorStop(1, 'rgba(255,205,150,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); }), fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      solS.scale.set(11000, 11000, 1); esc3.add(solS);
      var lunaCv = document.createElement('canvas'); lunaCv.width = lunaCv.height = 128;
      var lunaTex = guarda(new THREE.CanvasTexture(lunaCv)); lunaTex.colorSpace = THREE.SRGBColorSpace;
      var lunaS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: lunaTex, fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      lunaS.scale.set(4200, 4200, 1); esc3.add(lunaS);
      var faseLuna = -1;
      function pintarLuna(fase) {
        var g = lunaCv.getContext('2d'), Ld = 128, r = Ld * 0.36, c = Ld / 2;
        g.clearRect(0, 0, Ld, Ld); g.save(); g.translate(c, c);
        g.fillStyle = 'rgba(40,50,70,.5)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        var crec = fase < 0.5, p = crec ? fase : 1 - fase; if (!crec) g.scale(-1, 1);
        var kk = Math.cos(2 * Math.PI * p);
        g.shadowColor = 'rgba(242,236,227,.55)'; g.shadowBlur = Ld * 0.1; g.fillStyle = '#f1ebdc';
        g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        g.ellipse(0, 0, Math.max(0.01, Math.abs(kk)) * r, r, 0, Math.PI / 2, kk >= 0 ? -Math.PI / 2 : 3 * Math.PI / 2, kk >= 0);
        g.fill(); g.restore(); lunaTex.needsUpdate = true;
      }

      /* --- luces --- */
      var CASA3 = new THREE.Vector3(CAS.x, H0, CAS.z);
      var luzSol = new THREE.DirectionalLight('#ffffff', 2.6);
      luzSol.castShadow = true;
      var SM = hiDef ? 2048 : 1024;
      luzSol.shadow.mapSize.set(SM, SM);
      Object.assign(luzSol.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 2000 });
      luzSol.shadow.camera.updateProjectionMatrix();
      luzSol.shadow.bias = -0.0005; luzSol.shadow.normalBias = 0.04;
      luzSol.target.position.copy(CASA3);
      var luzLuna = new THREE.DirectionalLight('#a8bce0', 0);
      luzLuna.target.position.copy(CASA3);
      var hemi = new THREE.HemisphereLight('#dfe8f0', '#5d5444', 1.5);
      var luzPuerta = new THREE.PointLight('#ffc27a', 0, 26, 2);     // siempre está: si no, cambiaría el programa al anochecer
      esc3.add(luzSol, luzSol.target, luzLuna, luzLuna.target, hemi, luzPuerta);

      /* --- materiales de los edificios --- */
      var texRep = function (c) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anis; return guarda(t); };
      var lam = function (o, casa) { return patchRelieve(guarda(new THREE.MeshLambertMaterial(o)), casa); };
      var tex = { piedra: texRep(texPiedra(7)), blanco: texRep(texRevoco('#ece8e0', 11)), granito: texRep(texGranito(5)), teja: texRep(texTeja(3)), madera: texRep(texMadera(9)), claro: texRep(texRevoco('#d9d3c8', 13)) };
      var MC = {                                // la casa de Alba (su luz, la de Alba.sol)
        piedra: lam({ map: tex.piedra }, true), blanco: lam({ map: tex.blanco }, true), granito: lam({ map: tex.granito }, true),
        teja: lam({ map: tex.teja, side: THREE.DoubleSide }, true), madera: lam({ map: tex.madera }, true), cristal: lam({ color: '#1d222a' }, true),
        canto: lam({ color: '#4a3226' }, true),
      };
      var MP = { blanco: lam({ map: tex.blanco }), claro: lam({ map: tex.claro }), cristal: lam({ color: '#262b33' }) };
      function cajaGeo(w, h, d, tesela) {           // caja con la textura a escala real (tesela de 2,4 m), por cara
        var g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, T = tesela || 2.4;
        var dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        for (var f = 0; f < 6; f++) for (var v = 0; v < 4; v++) { var ix = f * 4 + v; uv.setXY(ix, uv.getX(ix) * dims[f][0] / T, uv.getY(ix) * dims[f][1] / T); }
        return guarda(g);
      }
      function caja(grupo, w, h, d, mat, x, y, z, ry, sombra) {
        var me = new THREE.Mesh(cajaGeo(w, h, d), mat);
        me.position.set(x, y, z); if (ry) me.rotation.y = ry;
        me.castShadow = sombra !== false; me.receiveShadow = true; grupo.add(me); return me;
      }
      var ventanas = [];          // { grupo, x, y, z, ang } cristales que se encienden de noche

      /* --- un tejado a dos aguas sobre un rectángulo orientado (cumbrera a lo largo de su lado largo) --- */
      // pend: pendiente (alto / medio ancho). El faldón pasa por el borde del muro (y = 0 en v = ±lv/2) y vuela
      // `vuelo` m por los aleros y `vueloH` por los hastiales; la cumbrera queda a lv/2 · pend.
      function tejadoGeo(lu, lv, pend, vuelo, vueloH) {
        var hu = lu / 2 + vueloH, hv = lv / 2 + vuelo, pos = [], uv = [], T = 2.0, alto = lv / 2 * pend, ye = -vuelo * pend;
        var P = [[-hu, ye, -hv], [hu, ye, -hv], [hu, alto, 0], [-hu, alto, 0], [-hu, ye, hv], [hu, ye, hv]];
        var paños = [[0, 1, 2, 0, 2, 3], [4, 3, 2, 4, 2, 5]];
        paños.forEach(function (ids, k) {
          ids.forEach(function (id) {
            var p = P[id]; pos.push(p[0], p[1], p[2]);
            uv.push((p[0] + hu) / T, Math.hypot(p[2], p[1] - alto) / T);
          });
        });
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        return guarda(g);
      }
      function hastialGeo(lv, alto) {              // el triángulo de un hastial (en el plano x = 0, mirando a +x)
        var g = new THREE.BufferGeometry(), hv = lv / 2;
        g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, hv, 0, 0, -hv, 0, alto, 0], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([hv / 2.4, 0, -hv / 2.4, 0, 0, alto / 2.4], 2));
        g.computeVertexNormals();
        return guarda(g);
      }

      /* --- los edificios del pueblo: muros sobre su planta del Catastro y tejado del color de la ortofoto.
             Todo junto en cuatro mallas (muros blancos, muros claros, hastiales y tejados con color por vértice):
             ~160 casas en 4 llamadas de dibujo en vez de 650. --- */
      function muroGeo(anillo, y0, y1) {
        var pos = [], uv = [], u = 0, n = anillo.length;
        // orientación: que las caras miren hacia fuera
        var ar = 0; for (var k = 0; k < n; k++) { var p0 = anillo[k], p1 = anillo[(k + 1) % n]; ar += p0[0] * p1[1] - p1[0] * p0[1]; }
        var sg = ar > 0 ? 1 : -1;
        for (k = 0; k < n; k++) {
          var a = anillo[k], b = anillo[(k + 1) % n], lg = Math.hypot(b[0] - a[0], b[1] - a[1]);
          var qd = [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];
          var o = sg > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
          var uvs = [[u, y0], [u + lg, y0], [u + lg, y1], [u, y1]];
          o.forEach(function (id) { pos.push(qd[id][0], qd[id][1], qd[id][2]); uv.push(uvs[id][0] / 2.4, uvs[id][1] / 2.4); });
          u += lg;
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        return g;
      }
      function junta(lista, conColor) {           // une geometrías sin índice (ya colocadas); color opcional por pieza
        var n = 0; lista.forEach(function (x) { n += x.g.attributes.position.count; });
        var P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = conColor ? new Float32Array(n * 3) : null, o = 0;
        lista.forEach(function (x) {
          var g = x.g, c = g.attributes.position.count;
          P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2);
          if (C) for (var k = 0; k < c; k++) { C[(o + k) * 3] = x.c.r; C[(o + k) * 3 + 1] = x.c.g; C[(o + k) * 3 + 2] = x.c.b; }
          o += c; g.dispose();
        });
        var r = new THREE.BufferGeometry();
        r.setAttribute('position', new THREE.BufferAttribute(P, 3)); r.setAttribute('normal', new THREE.BufferAttribute(N, 3)); r.setAttribute('uv', new THREE.BufferAttribute(U, 2));
        if (C) r.setAttribute('color', new THREE.BufferAttribute(C, 3));
        r.computeBoundingSphere();
        return guarda(r);
      }
      var hexTejado = function (h) {                // el de la ortofoto, algo avivado (la foto aérea lo apaga)
        var c = hexA(h), l = (c[0] + c[1] + c[2]) / 3;
        return l < 50 ? '#7d4a3c' : mezcla(h, '#b0604a', 0.25);
      };
      var colTmp = new THREE.Color(), mPieza = new THREE.Matrix4(), qPieza = new THREE.Quaternion(), ePieza = new THREE.Euler();
      var colocar = function (g, x, y, z, ry) { ePieza.set(0, ry, 0); qPieza.setFromEuler(ePieza); mPieza.compose(new THREE.Vector3(x, y, z), qPieza, new THREE.Vector3(1, 1, 1)); g.applyMatrix4(mPieza); return g; };
      var piezas = { blanco: [], claro: [], tejado: [] }, nPueblo = 0;
      m.edificios.forEach(function (e) {
        if (e.tipo === 'alba') return;
        if (!hiDef && Math.hypot(e.rect.cx, e.rect.cz) > 380) return;
        var alto = Math.max(1, e.pisos) * 2.85 + 0.15, techo = e.sueloMax + alto, muro = e.tipo === 'vecina' ? 'blanco' : 'claro';
        piezas[muro].push({ g: muroGeo(e.anillo, e.suelo - 1.2, techo) });
        var rc = e.rect, largoU = rc.lu >= rc.lv;
        var lu = largoU ? rc.lu : rc.lv, lv = largoU ? rc.lv : rc.lu, ang = largoU ? rc.ang : rc.ang + Math.PI / 2;
        colTmp.set(hexTejado(e.tejado));
        piezas.tejado.push({ g: colocar(tejadoGeo(lu, lv, 0.45, 0.45, 0.3), rc.cx, techo, rc.cz, -ang), c: colTmp.clone() });
        [-1, 1].forEach(function (sgn) {            // hastiales
          piezas[muro].push({ g: colocar(hastialGeo(lv, lv / 2 * 0.45), rc.cx + Math.cos(ang) * sgn * lu / 2, techo, rc.cz + Math.sin(ang) * sgn * lu / 2, -ang + (sgn > 0 ? 0 : Math.PI)) });
        });
        nPueblo++;
      });
      var pueblo = new THREE.Group(); esc3.add(pueblo);
      [['blanco', MP.blanco], ['claro', MP.claro], ['tejado', lam({ map: tex.teja, vertexColors: true, side: THREE.DoubleSide })]].forEach(function (x) {
        if (!piezas[x[0]].length) return;
        var me = new THREE.Mesh(junta(piezas[x[0]], x[0] === 'tejado'), x[1]);
        me.castShadow = true; me.receiveShadow = true; pueblo.add(me);
      });

      /* --- la casa de Alba (Catastro D00110500QH27A, 2 plantas + 1 bajo rasante): zócalo de piedra, planta alta
             blanca con esquinas y recercados de granito, tejado de teja roja a dos aguas (cumbrera este-oeste),
             escalera exterior de balaustres de madera en la fachada sur. Medidas a ojo de las fotos (LUGAR.md). --- */
      var casa = new THREE.Group();
      var alba = m.edificios.filter(function (e) { return e.tipo === 'alba'; })[0];
      var balaustres = [];
      var mtx = new THREE.Matrix4(), qt = new THREE.Quaternion(), eY = new THREE.Vector3(0, 1, 0), sc1 = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
      (function () {
        if (!alba) return;
        var rc = alba.rect, W = rc.lu, D = rc.lv, hx = W / 2, hz = D / 2;
        casa.position.set(rc.cx, 0, rc.cz); casa.rotation.y = -rc.ang;
        var yN = alba.suelo, ySur = alba.sueloMax, y0 = ySur + 0.3, y1 = y0 + 2.9, yA = y1 + 2.75;
        var piedraTop = y1 - 0.05, pend = 0.45, cumbre = yA + hz * pend;
        // zócalo de piedra (dos niveles al norte, uno al sur: la casa está en ladera)
        caja(casa, W, piedraTop - (yN - 1.2), D, MC.piedra, 0, (piedraTop + yN - 1.2) / 2, 0);
        // planta alta blanca
        caja(casa, W - 0.02, yA - piedraTop, D - 0.02, MC.blanco, 0, (yA + piedraTop) / 2, 0);
        // hastiales (oeste y este), blancos
        [-1, 1].forEach(function (s) {
          var hm = new THREE.Mesh(hastialGeo(D - 0.02, cumbre - yA), MC.blanco);
          hm.position.set(s * (hx - 0.01), yA, 0); hm.rotation.y = s > 0 ? 0 : Math.PI; hm.castShadow = true; hm.receiveShadow = true; casa.add(hm);
        });
        // esquinas de granito en la planta alta (sillares alternos) y la línea de granito sobre el zócalo
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          for (var y = piedraTop, k = 0; y < yA - 0.2; y += 0.42, k++) {
            var l = k % 2 ? 0.32 : 0.5;
            caja(casa, k % 2 ? 0.28 : l, 0.38, k % 2 ? l : 0.28, MC.granito, c[0] * (hx - (k % 2 ? 0.12 : l / 2 - 0.02)), y + 0.21, c[1] * (hz - (k % 2 ? l / 2 - 0.02 : 0.12)), 0, false);
          }
        });
        caja(casa, W + 0.06, 0.14, D + 0.06, MC.granito, 0, piedraTop, 0, 0, false);
        // tejado y alero
        var tj = new THREE.Mesh(tejadoGeo(W, D, pend, 0.55, 0.35), MC.teja);     // cumbrera a lo largo de x (este-oeste)
        tj.position.set(0, yA, 0); tj.castShadow = true; tj.receiveShadow = true; casa.add(tj);
        caja(casa, W + 0.7, 0.12, 0.12, MC.canto, 0, yA - 0.05, -hz - 0.5, 0, false);
        caja(casa, W + 0.7, 0.12, 0.12, MC.canto, 0, yA - 0.05, hz + 0.5, 0, false);
        // chimeneas de piedra con sombrerete de teja
        [[-0.9, -1.2, 0.62], [1.9, 0.9, 0.55]].forEach(function (c) {
          var top = cumbre + 0.9, base = yA + (hz - Math.abs(c[1])) * pend - 0.2;
          caja(casa, c[2], top - base, c[2], MC.piedra, c[0], (top + base) / 2, c[1]);
          var som = new THREE.Mesh(tejadoGeo(c[2] + 0.25, c[2] + 0.25, 0.6, 0.05, 0.05), MC.teja);
          som.position.set(c[0], top + 0.16, c[1]); casa.add(som);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { caja(casa, 0.08, 0.16, 0.08, MC.piedra, c[0] + p[0] * c[2] * 0.4, top + 0.08, c[1] + p[1] * c[2] * 0.4, 0, false); });
        });
        // huecos: recercado de granito, carpintería de madera y cristal (de noche, algunos encendidos)
        function hueco(cara, u, y, w, h, puerta, enc) {   // cara: 's' (sur, +z), 'n' (norte), 'o' (oeste, −x), 'e' (este)
          var nx = cara === 'o' ? -1 : cara === 'e' ? 1 : 0, nz = cara === 's' ? 1 : cara === 'n' ? -1 : 0;
          var px = nx ? nx * hx : u, pz = nz ? nz * hz : u, ry = nx ? Math.PI / 2 : 0;
          var g = function (ww, hh, off, mat, dy, du) {
            var mx = px + nx * off + (nx ? 0 : (du || 0)), mz = pz + nz * off + (nz ? 0 : (du || 0));
            caja(casa, ww, hh, 0.12, mat, mx, y + (dy || 0), mz, ry, false);
          };
          g(w + 0.36, 0.18, 0.04, MC.granito, h / 2 + 0.09);                 // dintel
          if (!puerta) g(w + 0.44, 0.14, 0.06, MC.granito, -h / 2 - 0.07);    // alféizar
          g(0.18, h, 0.04, MC.granito, 0, -(w / 2 + 0.09)); g(0.18, h, 0.04, MC.granito, 0, w / 2 + 0.09);   // jambas
          g(w, h, 0.0, puerta ? MC.madera : MC.cristal);
          if (!puerta) { g(w, 0.06, 0.02, MC.madera, 0); g(0.06, h, 0.02, MC.madera, 0); }
          ventanas.push({ x: px + nx * 0.08, y: y, z: pz + nz * 0.08, w: w, h: h, ry: ry, enc: !!enc });
        }
        var yv1 = y1 + 1.35, yv0 = y0 + 1.25, yvN = yN + 1.35;
        // sur: abajo la puerta (con su tejadillo) y una ventana bajo el rellano; arriba dos ventanas y la puerta de la escalera
        hueco('s', -2.5, y0 + 1.05, 1.0, 2.1, true); hueco('s', 1.5, yv0, 0.9, 1.0, false, true);
        hueco('s', -2.3, yv1, 1.05, 1.0, false, true); hueco('s', -0.3, yv1, 1.05, 1.0, false); hueco('s', 2.55, y1 + 1.05, 0.95, 2.1, true);
        // oeste (hastial, a la calle): tres ventanas arriba, dos pequeñas abajo
        hueco('o', -3.4, yv1, 0.95, 1.0, false, true); hueco('o', -0.6, yv1, 0.95, 1.0, false); hueco('o', 2.6, yv1, 0.7, 0.9, false);
        hueco('o', -2.6, yv0, 0.6, 0.8, false); hueco('o', 1.6, yv0, 0.6, 0.8, false);
        // norte (tres alturas, al valle)
        hueco('n', 0.6, yN + 1.05, 1.3, 2.1, true); hueco('n', -1.4, yvN, 0.9, 1.0, false); hueco('n', -3.1, yN + 1.05, 0.9, 2.1, true);
        hueco('n', 1.7, yv0, 0.95, 1.0, false, true); hueco('n', -2.0, yv0, 0.95, 1.0, false);
        hueco('n', 0.9, yv1, 1.0, 1.0, false); hueco('n', -1.9, yv1, 1.0, 1.0, false, true);
        // este (asoma sobre la casa baja): una ventana arriba
        hueco('e', -1.0, yv1, 0.9, 1.0, false);
        // tejadillos de teja sobre las puertas del sur (abajo) y del norte
        [[-2.5, hz, y0 + 2.45, 1], [0.6, -hz, yN + 2.45, -1]].forEach(function (t) {
          var gt = new THREE.BufferGeometry(), a = [-0.85, 0.25, 0, 0.85, 0.25, 0, 0.85, -0.12, t[3] * 0.95, -0.85, 0.25, 0, 0.85, -0.12, t[3] * 0.95, -0.85, -0.12, t[3] * 0.95];
          gt.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
          gt.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.85, 0, 0.85, 0.5, 0, 0, 0.85, 0.5, 0, 0.5], 2));
          gt.computeVertexNormals();
          var tt = new THREE.Mesh(guarda(gt), MC.teja);
          tt.position.set(t[0], t[2], t[1]); tt.castShadow = true; casa.add(tt);
          [-0.7, 0.7].forEach(function (d) { caja(casa, 0.09, 0.09, 0.95, MC.madera, t[0] + d, t[2] - 0.05, t[1] + t[3] * 0.47, 0, false); });
        });
        // la escalera exterior: sube pegada a la fachada sur, de oeste a este, hasta el rellano de la puerta de arriba
        var xIni = -1.9, xRel = 1.55, ancho = 1.0, nEsc = 16, zE = hz + ancho / 2, subida = y1 - ySur;
        for (var k = 0; k < nEsc; k++) {
          var x0 = xIni + (xRel - xIni) * k / nEsc, x1 = xIni + (xRel - xIni) * (k + 1) / nEsc, top = ySur + subida * (k + 1) / nEsc;
          caja(casa, x1 - x0 + 0.02, top - (ySur - 0.4), ancho, MC.piedra, (x0 + x1) / 2, (top + ySur - 0.4) / 2, zE, 0, true);
          caja(casa, x1 - x0 + 0.06, 0.06, ancho + 0.06, MC.granito, (x0 + x1) / 2, top - 0.02, zE, 0, false);
        }
        var relX0 = xRel, relX1 = hx + 0.3, relZ1 = hz + 1.35;
        caja(casa, relX1 - relX0, 0.2, relZ1 - hz, MC.granito, (relX0 + relX1) / 2, y1 - 0.1, (hz + relZ1) / 2);           // rellano
        caja(casa, 0.42, y1 - 0.2 - (ySur - 0.4), 0.42, MC.granito, relX1 - 0.21, (y1 - 0.2 + ySur - 0.4) / 2, relZ1 - 0.21); // pilar de granito
        // balaustres de madera: por fuera de la escalera y del rellano
        function linea(a, b, ya, yb) {             // de a a b ([x, z]), apoyados de ya a yb
          var lg = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(lg / 0.15));
          for (var s = 0; s <= n; s++) {
            var t = s / n; pv.set(a[0] + (b[0] - a[0]) * t, ya + (yb - ya) * t, a[1] + (b[1] - a[1]) * t);
            balaustres.push(mtx.compose(pv.clone(), qt.identity(), sc1).clone());
          }
          var pasa = new THREE.Mesh(cajaGeo(lg + 0.1, 0.07, 0.11), MC.madera);         // pasamanos
          pasa.position.set((a[0] + b[0]) / 2, (ya + yb) / 2 + 0.9, (a[1] + b[1]) / 2);
          pasa.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
          pasa.rotation.z = Math.atan2(yb - ya, lg); pasa.rotation.order = 'YZX'; pasa.castShadow = true;
          casa.add(pasa);
        }
        linea([xIni + 0.1, hz + ancho - 0.06], [xRel, hz + ancho - 0.06], ySur + subida / nEsc, y1);
        linea([xRel, relZ1 - 0.06], [relX1 - 0.45, relZ1 - 0.06], y1, y1);
        linea([relX1 - 0.06, relZ1 - 0.45], [relX1 - 0.06, hz + 0.05], y1, y1);
        // tres escalones de granito delante de la puerta de abajo, con su barandilla
        for (k = 0; k < 3; k++) caja(casa, 1.5, 0.1 + 0.1 * (k + 1), 0.32, MC.granito, -2.5, ySur + (0.1 + 0.1 * (k + 1)) / 2 - 0.05, hz + 1.05 - k * 0.32, 0, false);
        linea([-3.3, hz + 1.2], [-3.3, hz + 0.1], ySur, y0);
        casa.updateMatrixWorld(true);
      })();
      esc3.add(casa);
      // los balaustres torneados (una malla instanciada)
      var balGeo = guarda(new THREE.LatheGeometry([[0.0, 0], [0.045, 0], [0.045, 0.08], [0.03, 0.12], [0.05, 0.3], [0.028, 0.45], [0.05, 0.62], [0.03, 0.78], [0.04, 0.84], [0.04, 0.9], [0, 0.9]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 8));
      var bal = new THREE.InstancedMesh(balGeo, MC.madera, Math.max(1, balaustres.length));
      balaustres.forEach(function (mm, n) { bal.setMatrixAt(n, mm); });
      bal.count = balaustres.length; bal.castShadow = true;
      casa.add(bal);
      // de noche: ventanas encendidas (las marcadas) con un halo dibujado, y el farol de la puerta
      var luzV = new THREE.Group(); casa.add(luzV);
      var matLuz = guarda(new THREE.MeshBasicMaterial({ color: '#ffc883', toneMapped: false, transparent: true, opacity: 0 }));
      var haloTex = texDe(64, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,196,120,.85)'); r.addColorStop(0.3, 'rgba(255,190,110,.25)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); });
      var matHalo = guarda(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, fog: false }));
      var halos = [];
      ventanas.filter(function (v) { return v.enc; }).forEach(function (v) {
        var pl = new THREE.Mesh(guarda(new THREE.PlaneGeometry(v.w * 0.92, v.h * 0.92)), matLuz);
        var sgn = v.ry ? (v.x > 0 ? 1 : -1) : (v.z > 0 ? 1 : -1);
        pl.position.set(v.x + (v.ry ? sgn * 0.02 : 0), v.y, v.z + (v.ry ? 0 : sgn * 0.02));
        pl.rotation.y = v.ry ? (v.x > 0 ? Math.PI / 2 : -Math.PI / 2) : (v.z > 0 ? 0 : Math.PI);
        luzV.add(pl);
        var h = new THREE.Sprite(matHalo); h.scale.set(2.6, 2.6, 1); h.position.copy(pl.position); luzV.add(h); halos.push(h);
      });
      var puertaSur = new THREE.Vector3(-2.5, alba ? alba.sueloMax + 2.6 : H0 + 2.6, alba ? alba.rect.lv / 2 + 0.6 : 6);
      casa.localToWorld(puertaSur);
      luzPuerta.position.copy(puertaSur);
      var farol = new THREE.Sprite(matHalo); farol.scale.set(1.8, 1.8, 1); farol.position.copy(puertaSur); esc3.add(farol);

      /* --- rótulos (HTML encima del lienzo) --- */
      var prior = function (l) { return l.tipo === 'alba' ? 0 : l.tipo === 'pueblo' ? 1 : l.enPerfil ? 2 : /Mocoso|Cornón/.test(l.nombre) ? 2 : 3; };
      var FASES = { alba: [0.3, 1.01], pueblo: [0.16, 0.84], cima: [0, 0.5] };
      var rotulos = m.lugares.filter(function (l) { return prior(l) < 3; }).map(function (l) {
        var li = document.createElement('span');
        li.className = 'lugar__rotulo lugar__rotulo--' + l.tipo;
        li.innerHTML = '<span><b>' + esc(l.nombre) + '</b>' + (l.sub ? '<small>' + esc(l.sub) + '</small>' : '') + '</span>';
        capaRot.appendChild(li);
        return { el: li, l: l, v: new THREE.Vector3(l.x, l.y, l.z), visto: false, f: FASES[l.tipo] || [0, 1] };
      });
      function tapado(a, b) {                     // ¿el relieve tapa la línea de la cámara al rótulo?
        for (var n = 1; n < 28; n++) {
          var t = n / 28, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
          if (altura(x, z) > y + 3) return true;
        }
        return false;
      }

      /* --- la luz de un instante: sol (de Alba.sol), luna, cielo y la sombra de las peñas --- */
      var dirSol = new THREE.Vector3(), dirLuna = new THREE.Vector3(), dirPase = new THREE.Vector3(), ultPase = new THREE.Vector3(9, 9, 9);
      var dirDe = function (az, alt, v) { return v.set(Math.sin(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD), -Math.cos(az * RAD) * Math.cos(alt * RAD)); };
      var noche = 0, solCasa = 1;
      function luces(f) {
        f = f || estado.t || horaReal();
        var s = S().posicion(f), l = luna(f), c = cieloPara(s.altura);
        noche = lim((-s.altura - 2) / 10, 0, 1);
        var diaL = lim((s.altura + 4) / 14, 0, 1);
        uCielo.cZ.value.set(c.cz); uCielo.cH.value.set(c.ch);
        dirDe(s.azimut, s.altura, dirSol); dirDe(l.az, l.alt, dirLuna);
        uCielo.dirSol.value.copy(dirSol);
        uCielo.brillo.value = lim(1 - Math.abs(s.altura - 2) / 16, 0, 1);
        esc3.fog.color.set(mezcla(c.ch, c.cz, 0.15));
        luzSol.position.copy(CASA3).addScaledVector(dirSol, 1000);
        luzSol.intensity = 2.8 * suave(-1, 8, s.altura);
        luzSol.color.set(mezcla('#fff4e6', '#ff9a5a', lim(1 - s.altura / 20, 0, 1)));
        solS.visible = s.altura > -3; solS.material.opacity = lim((s.altura + 3) / 4, 0, 1);
        luzLuna.position.copy(CASA3).addScaledVector(dirLuna, 1000);
        luzLuna.intensity = l.alt > 0 ? (0.2 + 0.8 * l.luz) * noche : 0;
        lunaS.visible = l.alt > -1.5 && l.luz > 0.03;
        if (lunaS.visible) { var fk = Math.round(l.fase * 100); if (fk !== faseLuna) { faseLuna = fk; pintarLuna(l.fase); } lunaS.material.opacity = lim((l.alt + 1.5) / 3, 0, 1); }
        hemi.intensity = lerp(0.42, 1.35, diaL);
        hemi.color.set(mezcla('#3c4f86', '#d8e4f0', diaL)); hemi.groundColor.set(mezcla('#15131c', '#5a5040', diaL));
        estrellas.material.opacity = noche * noche;
        // la casa: la luz que dice Alba.sol (el borde del disco sobre el horizonte del MDT, con penumbra)
        var hz = S().horizonte(s.azimut);
        solCasa = hz === undefined ? 1 : lim((s.altura + 0.2667 - hz) / 0.533, 0, 1);
        uSom.luzCasa.value = s.altura > -4 ? solCasa : (l.alt > 0 ? 1 : 0);
        // la sombra de las peñas, para el sol (o para la luna, de noche); solo si se ha movido
        if (s.altura > -4) dirPase.copy(dirSol); else dirPase.copy(dirLuna);
        if (dirPase.distanceToSquared(ultPase) > 1e-8) { recalcularSombras(dirPase); ultPase.copy(dirPase); }
        var enc = noche > 0.05;
        luzV.visible = enc; matLuz.opacity = lim(noche * 1.4, 0, 1); matHalo.opacity = noche * 0.9;
        farol.visible = enc; luzPuerta.intensity = noche * 30;
        ren.shadowMap.needsUpdate = true;
        pedir(true);
      }

      /* --- cámara: el recorrido con el scroll --- */
      var ruta = camino(m.recorrido);
      var vista = { w: 0, h: 0 }, hProm = 0;
      function ajustar() {
        var w = escenario.clientWidth, h = escenario.clientHeight;
        if (!w || !h) return;
        // la barra del navegador del móvil cambia solo el alto: no se rehace nada (si no, salta)
        if (vista.w === w && Math.abs(vista.h - h) < 160 && vista.h) { if (vista.h !== h) { vista.h = h; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); pedir(true); } return; }
        vista.w = w; vista.h = h;
        ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
        ren.setSize(w, h, false);
        cam.aspect = w / h;
        cam.fov = w / h < 1 ? 60 : w / h < 1.3 ? 50 : 44;
        cam.updateProjectionMatrix();
        pedir(true);
      }
      function situar(p) {
        var r = ruta(p);
        cam.position.set(r.pos[0], r.pos[1], r.pos[2]);
        cam.lookAt(r.mira[0], r.mira[1], r.mira[2]);
        var sobre = Math.max(1, r.pos[1] - altura(r.pos[0], r.pos[2]));
        var cerca2 = lim(sobre * 0.12, 0.2, 25);
        if (Math.abs(cerca2 - cam.near) / cam.near > 0.1) { cam.near = cerca2; cam.updateProjectionMatrix(); }
        hProm = r.pos[1];
      }
      var v3 = new THREE.Vector3();
      function colocarRotulos(p) {
        var w = vista.w, h = vista.h, n = 0, MAX = movil ? 5 : 8;
        rotulos.slice().sort(function (a, b) { return prior(a.l) - prior(b.l); }).forEach(function (r) {
          var ok = p >= r.f[0] && p <= r.f[1] && n < MAX;
          if (ok) {
            v3.copy(r.v).project(cam);
            ok = v3.z < 1 && Math.abs(v3.x) < 0.92 && v3.y > -0.55 && v3.y < 0.86;
            if (ok) ok = !tapado(cam.position, r.v);
          }
          if (ok) { n++; r.el.style.transform = 'translate3d(' + ((v3.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v3.y) / 2 * h).toFixed(1) + 'px,0)'; }
          if (ok !== r.visto) { r.visto = ok; r.el.classList.toggle('es-visible', ok); }
        });
      }

      /* --- bucle: pinta solo si algo cambia; se para fuera de pantalla --- */
      var raf = 0, tPrev = 0, activo = false, visible = true, sucio = true, primero = true, pAnt = -1;
      var fpsEl = null, fN = 0, fT0 = 0, tAc = 0, nAc = 0;
      if (q.has('fps')) { fpsEl = document.createElement('p'); fpsEl.className = 'lugar__fps'; escenario.appendChild(fpsEl); }
      function leerScroll() {
        var r = pista.getBoundingClientRect(), recorrido = pista.offsetHeight - escenario.offsetHeight;
        estado.p = recorrido > 0 ? lim(-r.top / recorrido, 0, 1) : 0;
      }
      function paso(t) {
        raf = 0;
        if (estado.destruido || !activo || !visible) return;
        var dt = tPrev ? Math.min(0.1, (t - tPrev) / 1000) : 0.016; tPrev = t;
        leerScroll();
        var kk = reduce ? 1 : 1 - Math.exp(-dt * 5.5);                  // inercia suave, independiente de los fps
        var pV = estado.pVis + (estado.p - estado.pVis) * kk;
        if (Math.abs(estado.p - pV) < 0.00005) pV = estado.p;
        var mueve = Math.abs(pV - pAnt) > 0.00001;
        estado.pVis = pV;
        if (mueve || sucio || (primero && t > tListo)) {
          situar(pV);
          cielo.position.copy(cam.position); estrellas.position.copy(cam.position);
          solS.position.copy(cam.position).addScaledVector(dirSol, 130000);
          lunaS.position.copy(cam.position).addScaledVector(dirLuna, 130000);
          ren.render(esc3, cam);
          colocarRotulos(pV); marcarParada(pV);
          pAnt = pV; sucio = false;
          if (primero && (pendientes <= 0 || t > tListo)) { primero = false; escenario.classList.add('lugar--listo'); estado.cargado = true; }
          if (fpsEl) { fN++; if (!fT0) fT0 = t; if (t - fT0 > 500) { fpsEl.textContent = (fN * 1000 / (t - fT0)).toFixed(0) + ' fps · calidad ' + estado.calidad + ' · DPR ' + ren.getPixelRatio().toFixed(2) + ' · cámara a ' + Math.round(hProm) + ' m · ' + Math.round(ren.info.render.triangles / 1000) + ' k triángulos · casa al sol ' + Math.round(solCasa * 100) + ' %'; fN = 0; fT0 = t; } }
          if (mueve) { tAc += dt; nAc++; }
          if (nAc >= 50) { var media = tAc / nAc; tAc = 0; nAc = 0; if (media > 0.03 && estado.calidad < 2 && !document.hidden) bajarCalidad(); }
          raf = requestAnimationFrame(paso);
        } else if (primero) raf = requestAnimationFrame(paso);   // quieto y listo: no se pinta hasta que algo cambie
      }
      function pedir(ensuciar) { if (ensuciar) sucio = true; if (!raf && activo && visible && !estado.destruido) { tPrev = 0; raf = requestAnimationFrame(paso); } }
      function bajarCalidad() {
        estado.calidad++;
        if (estado.calidad === 1) { ren.setPixelRatio(1); ren.setSize(vista.w, vista.h, false); }
        if (estado.calidad === 2) { ren.shadowMap.enabled = false; luzSol.castShadow = false; ren.setPixelRatio(0.8); ren.setSize(vista.w, vista.h, false); esc3.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); }
        pedir(true);
      }
      var alRedim = new ResizeObserver(function () { ajustar(); });
      alRedim.observe(escenario);
      var io = new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) pedir(true); else { cancelAnimationFrame(raf); raf = 0; }
      }, { rootMargin: '120px' });
      io.observe(pista);
      escucha(window, 'scroll', function () { pedir(false); }, { passive: true });
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); estado.error3d = 'contexto perdido'; ponModo('plano'); });

      ajustar();
      try { ren.compile(esc3, cam); } catch (e) { /* sin compilación previa */ }

      t3 = {
        luces: luces,
        activo: function (si) { activo = si; cv.hidden = !si; if (si) { vista.w = 0; ajustar(); pedir(true); } else { cancelAnimationFrame(raf); raf = 0; } },
        estado: function () { return { p: estado.p, pVis: estado.pVis, calidad: estado.calidad, near: cam.near, fov: cam.fov, triangulos: ren.info.render.triangles, llamadas: ren.info.render.calls, ventanas: ventanas.length, balaustres: balaustres.length, pueblo: nPueblo, solCasa: solCasa, cam: [cam.position.x, cam.position.y, cam.position.z] }; },
        destruir: function () {
          cancelAnimationFrame(raf); raf = 0; alRedim.disconnect(); io.disconnect();
          disponer.forEach(function (o) { try { o.dispose(); } catch (e) { /* ya */ } });
          esc3.traverse(function (o) { if (o.material && o.material.dispose) o.material.dispose(); });
          try { ren.dispose(); ren.forceContextLoss(); } catch (e) { /* ya */ }
          cv.remove();
        },
      };
      luces(estado.t);
      return t3;
    }

    /* ---------- mandos ---------- */
    function activar3d(desdeBoton) {
      ponModo('3d');
      if (desdeBoton) el.scrollIntoView({ block: 'start', behavior: 'auto' });
      cargar3d().then(function (t) { if (t && !estado.destruido && estado.modo === '3d') t.activo(true); });
    }
    $('a3d').addEventListener('click', function () { activar3d(true); });
    $('aplano').addEventListener('click', function () { ponModo('plano'); el.scrollIntoView({ block: 'start', behavior: 'auto' }); });

    pSol.then(function () { if (!estado.destruido) ponHora(horaReal(), true); });
    intervalo = setInterval(function () { if (!document.hidden && estado.sigue && !estado.anim) ponHora(horaReal(), true); }, 60000);
    if (auto3d) activar3d(false); else ponModo('plano');
    el.dataset.montado = '1';

    return {
      destruir: function () {
        estado.destruido = true;
        pararAnim();
        clearInterval(intervalo);
        escuchas.forEach(function (f) { f(); });
        if (plano) plano.cancelar();
        if (t3) t3.destruir();
        t3 = null;
        el.classList.remove('lugar-mod', 'es-noche'); delete el.dataset.modo; delete el.dataset.montado;
        el.style.removeProperty('--lugar-noche');
        el.innerHTML = respaldo;
      },
      estado: function () { return { modo: estado.modo, puede3d: puede3d, auto3d: auto3d, error3d: estado.error3d, cargado: estado.cargado, t: estado.t, sigue: estado.sigue, t3: t3 ? t3.estado() : null }; },
      ver3d: function () { activar3d(false); },
      verPlano: function () { ponModo('plano'); },
      hora: function (f) { pararAnim(); if (f) ponHora(f, false); else aAhora(); },
    };
  }

  A.lugar = { RAYO: RAYO, montar: montar, camino: camino, monotona: monotona, luzEn: luzEn, luna: luna, resumenDia: resumenDia, fraseDia: fraseDia, fraseInstante: fraseInstante, cieloPara: cieloPara };
})();
