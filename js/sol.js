/* Alba.sol · el sol de Caunedo con el relieve real (agente Lugar 3D). Sin dependencias.
   Posición: algoritmo de NOAA/Meeus (error < 0,01° entre 1950 y 2050), con nutación y paralaje.
   Refracción: Saemundsson, corregida por la presión a la cota de la casa (≈ 900 hPa, 10 °C).
   El sol «entra» cuando asoma su borde de arriba (centro + semidiámetro aparente, con refracción) sobre el
   horizonte del MDT del IGN (data/lugar-horizonte.json, cada 0,1°). Validado en scripts/lugar-sol.mjs contra
   JPL Horizons (posición) y Open-Meteo (orto y ocaso); ver LUGAR.md.
   API (window.Alba.sol):
     ahora() → Date               (lee ?hora=HH:MM y ?fecha=AAAA-MM-DD, hora de Madrid)
     posicion(fecha) → { azimut, altura, alturaGeometrica }   grados; altura aparente (con refracción)
     entrada(fecha) → Date|null   primer momento del día (de Madrid) en que el sol asoma sobre el relieve en la casa
     salida(fecha) → Date|null    último momento en que se ve (se esconde tras el relieve)
     tramos(fecha) → [{ desde, hasta }]   ratos de sol directo en la casa ese día
     oficial(fecha) → { orto, ocaso }     con horizonte plano, como las tablas (−0,833°)
     visible(fecha) → bool        ¿da el sol en la casa en ese instante?
     horizonte(azimut) → grados   el relieve en ese rumbo (tras cargar)
     cargar() → Promise           lee el horizonte (una vez); usar(datos) lo pone a mano (pruebas)
     hora(fecha) → 'HH:MM' (Madrid) · haciaLas(fecha) → 'HH:MM' redondeada a 5 min · madrid(fecha) → partes
   Sin cargar(), entrada/salida/tramos/visible devuelven undefined (no inventan un horizonte plano). */
(function (w) {
  'use strict';
  var A = w.Alba = w.Alba || {};
  var RAD = Math.PI / 180, DIA = 86400000;
  var LAT = 43.067674, LON = -6.257025, COTA = 964;     // se sustituyen por los del JSON al cargar
  var H = null, PASO = 1, datos = null, promesa = null;
  var rutaJSON = (function () {
    try {
      var s = w.document && w.document.currentScript && w.document.currentScript.src;
      return s ? new URL('../data/lugar-horizonte.json', s).href : 'data/lugar-horizonte.json';
    } catch (e) { return 'data/lugar-horizonte.json'; }
  })();

  function norm(x) { x %= 360; return x < 0 ? x + 360 : x; }

  /* ---------- posición (NOAA/Meeus) ---------- */
  function astro(t) {
    var jd = t / DIA + 2440587.5, d = jd - 2451545, T = d / 36525;
    var L0 = norm(280.46646 + T * (36000.76983 + T * 0.0003032));
    var M = (357.52911 + T * (35999.05029 - 0.0001537 * T)) * RAD;
    var C = Math.sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M) * (0.019993 - 0.000101 * T) + Math.sin(3 * M) * 0.000289;
    var om = (125.04 - 1934.136 * T) * RAD;
    var lam = (L0 + C - 0.00569 - 0.00478 * Math.sin(om)) * RAD;
    var e0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    var eps = (e0 + 0.00256 * Math.cos(om)) * RAD;
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    var r = 1.000001018 * (1 - e * e) / (1 + e * Math.cos(M + C * RAD));          // distancia en UA
    // tiempo sidéreo aparente de Greenwich (con la ecuación de los equinoccios)
    var gst = 280.46061837 + 360.98564736629 * d + T * T * (0.000387933 - T / 38710000) - 0.00478 * Math.sin(om) * Math.cos(eps);
    return { dec: dec, ra: ra, gst: gst, r: r };
  }

  function geometrica(t) {
    var s = astro(t), f = LAT * RAD;
    var h = (s.gst + LON) * RAD - s.ra;
    var alt = Math.asin(Math.sin(f) * Math.sin(s.dec) + Math.cos(f) * Math.cos(s.dec) * Math.cos(h));
    var az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(f) - Math.tan(s.dec) * Math.cos(f)) / RAD + 180;
    alt = alt / RAD - (8.794 / 3600) / s.r * Math.cos(alt);                     // paralaje
    return { azimut: norm(az), altura: alt, semi: 0.26666 / s.r };
  }

  // refracción (Saemundsson) en grados para una altura geométrica, a la presión de la casa
  var FACTOR = 1;
  function presion() {
    var p = 1013.25 * Math.pow(1 - 2.25577e-5 * COTA, 5.25588);
    FACTOR = (p / 1010) * (283 / (273 + 10));
  }
  presion();
  function refraccion(h) {
    if (h < -2) h = -2;
    return FACTOR * 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * RAD) / 60;
  }

  function posicion(fecha) {
    var g = geometrica(+(fecha || new Date()));
    return { azimut: g.azimut, altura: g.altura + refraccion(g.altura), alturaGeometrica: g.altura };
  }

  /* ---------- el horizonte de la casa ---------- */
  function horizonte(az) {
    if (!H) return undefined;
    var x = norm(az) / PASO, i = Math.floor(x), f = x - i, n = H.length;
    return H[i % n] * (1 - f) + H[(i + 1) % n] * f;
  }
  // cuánto asoma el borde de arriba del sol sobre el relieve (grados; > 0 = da el sol en la casa)
  function margen(t) {
    var g = geometrica(t);
    return g.altura + refraccion(g.altura) + g.semi - horizonte(g.azimut);
  }
  function visible(fecha) { return H ? margen(+(fecha || new Date())) > 0 : undefined; }

  /* ---------- hora de Madrid ---------- */
  var fmt = null;
  function madrid(fecha) {
    var t = new Date(+fecha), p = {};
    try {
      fmt = fmt || new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      fmt.formatToParts(t).forEach(function (x) { p[x.type] = +x.value; });
    } catch (e) {                                   // sin Intl con zonas: hora central europea con su verano (UE)
      var y = t.getUTCFullYear();
      var dom = function (m) { var d = new Date(Date.UTC(y, m + 1, 0, 1)); return Date.UTC(y, m, d.getUTCDate() - d.getUTCDay(), 1); };
      var off = (+t >= dom(2) && +t < dom(9)) ? 2 : 1, u = new Date(+t + off * 3600000);
      p = { year: u.getUTCFullYear(), month: u.getUTCMonth() + 1, day: u.getUTCDate(), hour: u.getUTCHours(), minute: u.getUTCMinutes(), second: u.getUTCSeconds() };
    }
    return { anio: p.year, mes: p.month, dia: p.day, h: p.hour % 24, min: p.minute, s: p.second };
  }
  // Date de una hora de Madrid (con su cambio de hora)
  function desdeMadrid(anio, mes, dia, h, mi) {
    var base = Date.UTC(anio, mes - 1, dia, h, mi || 0), t = base - 3600000;
    for (var k = 0; k < 3; k++) {
      var p = madrid(t), vista = Date.UTC(p.anio, p.mes - 1, p.dia, p.h, p.min);
      if (vista === base) break;
      t += base - vista;
    }
    return new Date(t);
  }
  function inicioDia(fecha) { var p = madrid(fecha); return desdeMadrid(p.anio, p.mes, p.dia, 0, 0); }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function hora(fecha) { var p = madrid(fecha); return dos(p.h) + ':' + dos(p.min); }
  function haciaLas(fecha) { return hora(new Date(Math.round(+fecha / 300000) * 300000)); }

  function ahora() {
    var q = null;
    try { q = new URLSearchParams(w.location ? w.location.search : ''); } catch (e) { }
    var t = new Date(), hq = q && q.get('hora'), fq = q && q.get('fecha');
    var mh = hq && /^(\d{1,2}):(\d{2})$/.exec(hq), mf = fq && /^(\d{4})-(\d{2})-(\d{2})$/.exec(fq);
    if (!mh && !mf) return t;
    var p = madrid(t);
    if (mf) { p.anio = +mf[1]; p.mes = +mf[2]; p.dia = +mf[3]; }
    if (mh) { p.h = Math.min(23, +mh[1]); p.min = Math.min(59, +mh[2]); }
    return desdeMadrid(p.anio, p.mes, p.dia, p.h, p.min);
  }

  /* ---------- cruces con el horizonte ---------- */
  function afina(f, a, b) {                          // f(a) <= 0 < f(b) o al revés: bisección a ~1 s
    var fa = f(a) > 0;
    while (b - a > 1000) { var m = (a + b) / 2; if ((f(m) > 0) === fa) a = m; else b = m; }
    return (a + b) / 2;
  }
  var cache = {};
  function tramos(fecha) {
    if (!H) return undefined;
    var t0 = +inicioDia(fecha || new Date()), t1 = +inicioDia(new Date(t0 + DIA + 3 * 3600000));
    if (cache[t0]) return cache[t0];
    var out = [], paso = 120000, prev = margen(t0) > 0, ini = prev ? t0 : null;
    for (var t = t0 + paso; t <= t1; t += paso) {
      var v = margen(t) > 0;
      if (v !== prev) {
        var c = afina(margen, t - paso, t);
        if (v) ini = c; else { out.push({ desde: new Date(ini), hasta: new Date(c) }); ini = null; }
        prev = v;
      }
    }
    if (ini !== null) out.push({ desde: new Date(ini), hasta: new Date(t1) });
    cache[t0] = out;
    return out;
  }
  function entrada(fecha) { var r = tramos(fecha); return r === undefined ? undefined : (r.length ? r[0].desde : null); }
  function salida(fecha) { var r = tramos(fecha); return r === undefined ? undefined : (r.length ? r[r.length - 1].hasta : null); }

  // orto y ocaso «oficiales»: centro del sol a −0,833° geométricos (34′ de refracción + 16′ de semidiámetro)
  function oficial(fecha) {
    var t0 = +inicioDia(fecha || new Date()), f = function (t) { return geometrica(t).altura + 0.8333; };
    var orto = null, ocaso = null, paso = 600000, prev = f(t0) > 0;
    for (var t = t0 + paso; t <= t0 + DIA; t += paso) {
      var v = f(t) > 0;
      if (v !== prev) { var c = new Date(afina(f, t - paso, t)); if (v && !orto) orto = c; else if (!v) ocaso = c; prev = v; }
    }
    return { orto: orto, ocaso: ocaso };
  }

  function usar(d) {
    datos = d;
    H = d.horizonteFino || d.horizonte; PASO = d.horizonteFino ? (d.paso || 360 / H.length) : 1;
    if (typeof d.lat === 'number') LAT = d.lat;
    if (typeof d.lon === 'number') LON = d.lon;
    if (typeof d.cota === 'number') COTA = d.cota + (d.alturaOjo || 0);
    presion(); cache = {};
    return d;
  }
  function cargar() {
    if (!promesa) {
      promesa = fetch(rutaJSON, { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('horizonte ' + r.status); return r.json(); })
        .then(usar)
        .catch(function (e) { promesa = null; throw e; });
    }
    return promesa;
  }

  A.sol = {
    ahora: ahora, posicion: posicion, entrada: entrada, salida: salida, tramos: tramos, oficial: oficial,
    visible: visible, horizonte: horizonte, cargar: cargar, usar: usar,
    madrid: madrid, desdeMadrid: desdeMadrid, hora: hora, haciaLas: haciaLas,
    get datos() { return datos; }, get lugar() { return { lat: LAT, lon: LON }; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
