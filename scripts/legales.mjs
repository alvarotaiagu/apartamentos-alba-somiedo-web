/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común (receta de Montemar y Amaicha).
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   Titular: el de ref/DATOS-ALBA.md (data/alba.json). Solo castellano; noindex en todas. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/alba.json'), 'utf8'));
const T = D.titular, C = D.contacto;
const TEL = `<a href="tel:${C.telefonos[0].tel}">${C.telefonos[0].texto}</a>`;
const CORREO = `<a href="mailto:${C.correo}">${C.correo}</a>`;

const TITULAR = `<dl>
  <dt>Titular</dt><dd>${T.nombre}</dd>
  <dt>NIF</dt><dd>${T.nif}</dd>
  <dt>Domicilio</dt><dd>${T.domicilio}</dd>
  <dt>Nombre comercial</dt><dd>${D.nombre}</dd>
  <dt>Teléfonos</dt><dd>${TEL} y <a href="tel:${C.telefonos[1].tel}">${C.telefonos[1].texto}</a></dd>
  <dt>Correo</dt><dd>${CORREO}</dd>
  <dt>Registro de turismo</dt><dd>${D.registro} (apartamentos rurales, ${D.categoria})</dd>
</dl>
<p class="aviso">PENDIENTE: revisar estos textos con la casa antes de publicar (inscripción en el Registro Mercantil, representante y la dirección exacta: otros portales dan «${D.lugar.calle}», sin confirmar). Esta web es una propuesta que nadie ha encargado todavía.</p>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre ${D.nombre}, cuatro apartamentos rurales en Caunedo (Somiedo, Asturias). Los precios son su tarifa oficial; la disponibilidad y las condiciones de cada reserva las confirma la casa.</p>
<p>El calendario de «Elige fechas» es <b>una simulación</b>: los días ocupados son de ejemplo y no reserva nada. Solo prepara una solicitud que envías tú desde tu correo, o te da el teléfono. La reserva existe cuando la casa la confirma.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos y el dibujo de la fachada son de esta web. Las fotos de la casa son, de momento, las que la casa publicó en su ficha de EscapadaRural (con la marca de agua del portal) y en Sensación Rural, a la espera de las originales. Las letras Darker Grotesque, Pathway Extreme y Ubuntu Sans Mono se usan con su licencia libre (SIL Open Font License; Ubuntu Font Licence).</p>
<p class="aviso">PENDIENTE: confirmar con la casa que sus fotos de los portales se pueden usar aquí y pedirle las originales.</p>
<p>Las fotos del paisaje son de Wikimedia Commons, cada una con su autor y su licencia libre (Creative Commons), citados en el pie de la página principal y en la ficha de cada sitio.</p>
<p>La visita virtual es de EuroWeb Media, S. L., que la aloja en su servidor; se incrusta tal cual, solo si la pides.</p>
<p>El relieve y las alturas (portada, «A cuánto queda» y el pie) salen del Modelo Digital del Terreno del Instituto Geográfico Nacional: «© Instituto Geográfico Nacional», CC BY 4.0. La hora a la que el sol entra en la casa se calcula con ese relieve. Las rutas y los sitios son de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL, <a href="https://www.openstreetmap.org/copyright">openstreetmap.org/copyright</a>), con el enrutador OSRM (router.project-osrm.org y routing.openstreetmap.de).</p>
<p>La sección «El alba, hoy» usa el relieve y la ortofoto del IGN (CC BY 4.0) y la cartografía de la Dirección General del Catastro; la escena en 3D se dibuja con Three.js (licencia MIT), que va con esta misma web.</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (la visita virtual, Google Maps y su ficha de Google) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Los que nos das al escribirnos o al llamarnos para reservar: nombre, teléfono, correo, las fechas, cuántos venís y lo que quieras contarnos. Los usamos para contestarte y gestionar tu reserva.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<h2>El calendario de la web</h2>
<p>El simulador de fechas no guarda ni envía nada: funciona en tu navegador. El botón «Preparar la solicitud por correo» abre tu programa de correo con el mensaje escrito; lo envías tú, si quieres.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al escribirnos, la gestión de la reserva que pides y, para el registro de viajeros, una obligación legal. Los datos se guardan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo lo que obliga la ley (el registro de viajeros).</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos escribiendo a ${CORREO} o llamando al ${TEL}. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Una sola cosa: <code>alba-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>alba-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web (Darker Grotesque, Pathway Extreme y Ubuntu Sans Mono) se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Visita virtual (EuroWeb Media)</b>: solo se carga si pulsas «Abrir la visita virtual». Viene de cdn.eurowebmedia.es y carga Google Analytics, que pone sus cookies (por ejemplo, <code>_ga</code>). A partir de ese momento se aplican sus condiciones.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede poner sus cookies.</li>
</ul>
<h2>Los dibujos, el sol y el 3D</h2>
<p>La portada, la fachada, el mapa de «A cuánto queda», el sol de cada día y la escena en 3D se dibujan en tu navegador con archivos que van con esta misma web: no ponen cookies.</p>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>
<p class="aviso">PENDIENTE: si la escena en 3D de «El alba, hoy» pide datos a otro servicio (por ejemplo, la nubosidad de ahora), añadirlo aquí. Ver LUGAR.md.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1 en el texto en las cuatro luces del día, foco visible, textos alternativos en las fotos, el calendario con flechas y animaciones que se quitan si tu sistema pide reducir el movimiento. El dibujo de la portada, el mapa y el 3D son un apoyo: la información está también en el texto y en tablas.</p>
<h2>Contenido de terceros</h2>
<p>La visita virtual (EuroWeb Media) y el mapa de Google no dependen de esta web: su accesibilidad es la de sus servicios.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, llama al ${TEL} o escribe a ${CORREO}. Te daremos la información en un formato accesible.</p>`,
  },
};

const FUENTES = 'https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@500..900&family=Pathway+Extreme:opsz,wght@8..12,400..700&family=Ubuntu+Sans+Mono:wght@400..600&display=swap';
const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Apartamentos rurales Alba</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FUENTES}">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;

const MARCA = `<a class="legal-marca" href="./" aria-label="Apartamentos rurales Alba, a la portada"><svg viewBox="0 0 32 20" aria-hidden="true"><path class="lm-arco" d="M5 17a11 11 0 0 1 22 0"/><path class="lm-linea" d="M1 17h30"/></svg><span>Alba</span></a>`;

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `${cabeza(p.titulo)}
<body>
<header class="legal-cab">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

// el 404: las peñas sin sol (el mismo perfil del pie, de construir.mjs)
fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay">
  <main class="no">
    ${MARCA}
    <div class="no__dibujo">
<!--dia-svg-->
    </div>
    <h1>Por aquí no sale el sol</h1>
    <p>La página que buscas no existe o ha cambiado de sitio. La casa sigue en Caunedo, en el Parque Natural de Somiedo.</p>
    <p class="no__acc"><a class="btn btn--acento" href="./#reservar">Ver fechas</a><a class="btn btn--linea" href="./">Volver a la portada</a></p>
  </main>
</body>
</html>
`);
console.log('404.src.html');
