# Alba · «Amanece en Alba»

Propuesta de web para **Apartamentos rurales Alba** (Caunedo, parroquia de Gúa, 33840 Somiedo, Asturias): una casa de
piedra y madera con cuatro apartamentos de entrada independiente a 960 m, en el Parque Natural de Somiedo. No la han
encargado. Una sola página (`index.html`) más legales y 404. **En local, sin publicar y sin commits.** `noindex, nofollow`
en todas las páginas. Solo castellano.

Encargo: [`ENCARGO.md`](ENCARGO.md). Datos: `ref/DATOS-ALBA.md` → `data/alba.json` (lo que no está ahí, en
[`PENDIENTES.md`](PENDIENTES.md) o «por confirmar»). El 3D («El alba, hoy») y el sol (`js/sol.js`) son del agente Lugar 3D:
sus notas, en [`LUGAR.md`](LUGAR.md).

## El concepto

**Su nombre hecho literal: el alba en Alba.** Caunedo está en el fondo de un valle cerrado: el sol sale (en las tablas)
hora y media antes de llegar a la casa, que espera a que asome por encima de las peñas. La web cuenta eso con datos reales:

- **Portada**: el perfil REAL de las peñas que se ven desde la puerta (MDT25 del IGN, en cuatro capas por distancia: de 9 a
  32 km, de 4 a 9, de 1,8 a 4 y lo de menos de 1,8 km; el filo de arriba es el horizonte de Lugar, el mismo con el que se
  calcula el sol), «Alba» gigante **detrás** (las cumbres le muerden las letras), el cielo de ahora y el sol en su sitio
  real con su camino de hoy, y la frase **«Hoy el sol entra en la casa hacia las 09:55»** (cambia sola: «Ahora da el sol
  en la casa…», «Ahora lo tapa una peña: vuelve hacia las…», «Mañana el sol entra…»; si un día no llega, lo dice). Las
  cimas con nombre que asoman en ese horizonte (OSM, con su cota del MDT) van rotuladas. Sin foto: es SVG, nítido a
  cualquier tamaño.
- **La web entera cambia de luz con la hora de Caunedo**: alba, día, atardecer y noche (por la altura del sol: noche por
  debajo de −6°; alba o atardecer entre −6° y 6°, por la mañana o por la tarde; día por encima). Mando en la cabecera para
  verlas (alba, día, atardecer, noche, ahora) y `?hora=HH:MM`, `?fecha=AAAA-MM-DD` (los lee `Alba.sol.ahora()`), `?luz=`.
  El script bloqueante del `<head>` pone la luz antes de pintar; `main.js` la revisa cada minuto con `js/sol.js`.
  De noche y al atardecer se encienden las ventanas de la fachada dibujada.
- **El pie cierra el día**: el mismo perfil de las peñas y el camino ENTERO del sol de hoy; al llegar, el trazo de sol
  directo en la casa se dibuja y el sol acaba escondido tras la peña por donde se va de verdad: «Hoy, 3 h 40 min de sol en
  la casa, en 2 ratos: entra hacia las 09:55 y se va tras las peñas hacia las 14:50. Mañana entra hacia las…».

Lectura de diseño (`design-taste-frontend`): web de alojamiento premium para quien decide y reserva; lenguaje de lugar y
de dato (la luz, el relieve, las rutas), sin fotos de relleno; dials 8 / 6 / 3. Un tema por estado de luz (dos claros y
dos oscuros) que cambia la página entera, no secciones sueltas; `#lugar`, oscura siempre (contrato con el 3D). Radios:
14 px en cajas y fotos, píldora en botones y mandos.

### Las letras (Google Fonts, `display=swap`; ninguna está en la cartera: lo comprueba `verificar.mjs`)

- **Darker Grotesque** (800; titulares y «Alba»): grotesca alta y estrecha; a tamaño gigante tiene presencia sin ser una
  de palo seco más, y su forma vertical va con las peñas. Tiene €, ñ, tildes y « » (comprobado en la fuente).
- **Pathway Extreme** (texto): legible, con tamaño óptico.
- **Ubuntu Sans Mono** (cifras: horas, minutos, km, precios, cotas): cifras de instrumento para los datos medidos.

### Los colores (`css/base.css`; contraste en `node scripts/paleta.mjs`: todas las parejas pasan en los cuatro estados)

| Estado | Fondo | Texto | Marca (titulares) | Acento (botón) / como texto | Cielo (arriba → horizonte) |
|---|---|---|---|---|---|
| Día | `#EEF2EE` caliza | `#14201A` | `#1D3A2D` haya | `#B5401F` teja / `#A13818` | `#7FAAD6` → `#DCE8EF` |
| Alba | `#F2ECEE` | `#221A24` | `#3B2843` | `#B5401F` / `#A13818` | `#5E6E9E` → `#F4C3A4` |
| Atardecer | `#2A1D22` | `#F7ECE4` | `#F6D2B8` | `#E06A40` / `#F39A72` | `#3B3263` → `#C96A45` |
| Noche | `#11171F` | `#E8EDF4` | `#CFDBEA` | `#E06A40` / `#F2916B` | `#060A13` → `#1E2E4C` |

Un solo acento: **la teja roja de su tejado** (más clara en los estados oscuros). Las capas de las peñas van del gris
azulado lejano al verde oscuro cercano (perspectiva aérea); el suelo de la portada, donde va el texto, es oscuro en los
cuatro estados. Los nombres de las cimas llevan un halo del color del cielo para leerse sobre «Alba» y las crestas.
Contrato con Lugar 3D: `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--marca`, `--acento`, `--linea`,
`--letra-*`, `--gutter`, `--ancho`, `--cabecera` y las del cielo por estado; **dentro de `#lugar` se redefinen `--fondo`
`#0E1316`, `--superficie`, `--texto` `#EDF1F2`, `--texto-suave`, `--linea`, `--acento-texto` y `--foco`** para fondo oscuro.

## Las secciones

1. **Portada «Amanece en Alba»** (`js/portada.js`, `Alba.portada`). El SVG que escribe `construir.mjs` (del sureste al
   suroeste, a escala real) es el respaldo sin JS y el LCP. Montado, se redibuja al tamaño de la pantalla (en el móvil, 80°
   que siguen al sol; en el escritorio, ~170° mirando al sur), con la escala vertical casi real (algo exagerada en el
   móvil). **Gesto**: arrastrar en horizontal mueve la HORA de hoy; el sol recorre su camino y toda la web cambia de luz con
   él; al soltar vuelve a la hora de ahora (900 ms). Con teclado, la portada es un deslizador (flechas ±10 min, RePág/AvPág
   ±1 h, Inicio o Esc para volver). `touch-action: pan-y`: el gesto vertical sigue bajando la página.
2. **La casa**: la fachada dibujada a línea (de la foto publicable `sr-…137898`, a mano en `partes/fachada.svg`), cuatro
   cifras (apartamentos, 960 m, 2 llaves, todo el año), las dos fichas con su tarifa oficial (60/70 € y 100/120 € la noche,
   el apartamento entero; no se dice cuál de los cuatro es el grande) y los servicios con icono propio (`partes/iconos.html`).
3. **Por dentro**: su visita virtual (Pano2VR de EuroWeb Media) **creada solo al pulsar**, con el aviso de contenido
   externo y cookies junto al botón. **Su visor no admite abrir un nodo por URL** (comprobado: `index.html`,
   `pano2vr_player.js` 6.1.14 y `skin.js` no leen ni hash ni parámetros), así que va un solo visor con su tira de
   miniaturas y, al lado, la guía de las nueve vistas por apartamento. Debajo, cuatro fotos limpias pequeñas.
4. **El alba, hoy** (`#lugar`): el 3D de Lugar. Respaldo de la Web: el sol en la casa el día 21 de cada mes (calculado con
   `js/sol.js` al construir).
5. **A cuánto queda** (`js/distancias.js`, `Alba.distancias`): mapa propio sobre el **sombreado real del relieve** (MDT25
   y MDT200 del IGN, `img/relieve/`, fundido con el fondo en los cuatro estados) con la casa en el centro. Al elegir un sitio
   se dibuja **su ruta real de OSRM** (en coche, línea; a pie, puntos; si hay que dejar el coche, los dos tramos seguidos),
   el mapa vuela hasta que cabe y la ficha da minutos, km, carreteras, el **perfil de altura** (MDT, cada 40 m) con lo que
   sube y baja, la foto de Commons y el enlace a Google Maps. Mandos: **en coche / a pie** (desde la puerta) y **«tengo 20
   min / 1 hora / medio día»** (ida ≤ 20, 60 o 90 min), que enciende lo que queda dentro y lo cuenta. Teclado: la lista es
   el mando (flechas); táctil: tocar el sitio en el mapa. Sin JS (o si fallan los datos), la tabla; montado, la tabla sigue
   en «Ver todo en una tabla». Sitios comprobados en OSM (ver «Datos»).
6. **Reseñas**: 4,7 de 5 con 39 en Google, **marcado «por comprobar»** (dato de Sensación Rural; la ficha de Google no se
   deja leer sin navegador). Sin citas.
7. **Reservar** (`js/reserva.js`): simulador con su tarifa oficial por temporada; **disponibilidad simulada y marcada**
   («Simulación… días ocupados de ejemplo», encima del calendario, y en la leyenda). Elige apartamento, personas, llegada y
   salida (dos meses en el escritorio; uno en el móvil; teclado con flechas, una sola parada de tabulación), desglosa las
   noches de alta y baja, calcula la **cancelación con fechas** para esa llegada (la regla de 30 días si toca temporada
   alta) y prepara la solicitud: correo con todo escrito (lo envía quien reserva), los dos teléfonos y «WhatsApp: por
   confirmar». No envía ni guarda nada.
8. **Cómo llegar + contacto + mapa**: sus indicaciones desde Oviedo y León, con el tiempo y los km de OSRM (y el
   aeropuerto); teléfonos y correo; Google Maps (sin clave) solo al pulsar.

Pie: el día que se completa, contacto, créditos (fotos de Commons con autor y licencia, IGN, OSM/OSRM), legales y
«Preferencias de cookies». Legales (`scripts/legales.mjs`) con el titular (Vimay Alojamientos, S. L., B74046673). 404
«Por aquí no sale el sol» (las peñas sin sol).

## Fotos (regla dura del encargo)

- **Nada de EuroWeb Media** (`ref/origen/album`, `galeria`, `marca`): solo se miraron para dibujar la fachada. Tampoco las
  de EscapadaRural, TusCasasRurales ni Turismo Asturias (marca de agua del portal). Lo comprueba `verificar.mjs`.
- **Las 5 de Sensación Rural** (`sr-*.webp`, 750 px): a su tamaño y a 480, nunca ampliadas (`scripts/fotos.py`).
- **Paisaje de Wikimedia Commons** (`scripts/commons.json`): cinco, licencia comprobada una a una (CC BY 4.0, CC BY-SA 3.0
  y 4.0) y que son de ese sitio: la braña de La Pornacal (MRuedaC), el lago del Valle (Tanja Freibott), el lago de la Cueva
  en Saliencia (Saliencia2013), Pola de Somiedo (Carmenmoran) y la braña de Sousas en el valle del Lago (Juanbitas; el pie
  dice que es la braña, no el pueblo). Se sirven a 480 y 800 desde la miniatura de 1280 de Commons; autor, licencia y enlace
  en el pie y en la ficha del sitio.
- `data/fotos.json` deja preparada la galería por estancias para cuando manden las originales.

## Datos (cómo se rehacen)

```
node scripts/distancias-rutas.mjs   # sitios (OSM por id) y rutas OSRM coche/a pie → ref/raw/rutas.json
python -I -X utf8 scripts/relieve.py   # MDT25/MDT200 del IGN (caché en ref/raw/relieve-cache/): horizonte provisional,
                                       # capas de la portada, cimas (OSM), sombreado del mapa y perfiles → data/*.json, img/relieve/
python -I -X utf8 scripts/fotos.py     # img/fotos/ (WebP y JPG, nunca amplía) + fotos.json
python -I -X utf8 scripts/marca.py     # favicons e img/og.jpg
node scripts/legales.mjs               # *.src.html de las legales y el 404
node scripts/paleta.mjs                # contraste de los cuatro estados (sale con 1 si algo no llega)
node construir.mjs                     # partes + datos → *.html; versionar.mjs pone ?v=<huella>
node verificar.mjs                     # Playwright, puerto 8971 (sin capturas, sin pintar WebGL)
```

- **Casa**: coordenadas y cota de `data/lugar.json` (Lugar 3D, sobre el Catastro: 43,067674, −6,257025; 960 m del MDT05).
  Las rutas salen de ahí.
- **Sitios comprobados en OSM** (Overpass, 25-11-2026): Braña de Mumián (node 4247991421, a 1,3 km en línea recta, pero a
  pie OSRM va por la carretera hasta el arranque de su senda: 5,7 km), Pola de Somiedo, La Peral, el alto del puerto de
  Somiedo (1.485 m en OSM), la braña de La Pornacal (desde Villar de Vildas), Valle de Lago, el lago del Valle (desde Valle
  de Lago, hasta su orilla), los lagos de Saliencia (el lago de la Cueva, desde el aparcamiento del alto de La Farrapona),
  Belmonte de Miranda, Oviedo, León y el aeropuerto de Asturias.
- **Horizonte**: el de Lugar (`data/lugar-horizonte.json`) manda. `data/horizonte-provisional.json` (el mío, mismo
  esquema, MDT25, ojo a 1,6 m) solo se usa si falta el suyo. Difieren 0,24° de media y 1,95° como mucho (al noreste, a
  58°: él mira desde la planta alta, a 4 m, y con un MDT más fino).

## Módulos y contrato

| Módulo | Agente | Hueco | Ficheros |
|---|---|---|---|
| `portada` | Web | `#portada [data-modulo="portada"]` (respaldo: el SVG fijo) | `js/portada.js`, `data/portada.json` |
| `lugar` | Lugar 3D | `#lugar [data-modulo="lugar"]` (respaldo: la tabla del sol cada mes) | `js/lugar.js`, `css/lugar.css`, `img/lugar/`, `data/lugar*.json`, `vendor/` → [`LUGAR.md`](LUGAR.md) |
| `distancias` | Web | `#distancias [data-modulo="distancias"]` (respaldo: la tabla) | `js/distancias.js`, `data/distancias.json`, `img/relieve/` |
| `reserva` | Web | `#reservar [data-modulo="reserva"]` (respaldo: teléfonos, correo y cancelación) | `js/reserva.js` + `<script id="datos-alba">` |
| `dia` | Web | `#pie [data-modulo="dia"]` (respaldo: el perfil y la frase del año) | `js/portada.js` (`Alba.dia`) |

`Alba.<mod>.montar(el, { movimiento, densidad, webgl })` → `{ destruir() }`. `main.js` monta la portada al cargar y el
resto al acercarse (900 px); si un módulo falla, vuelve su respaldo. `js/sol.js` va antes que `main.js`; la Web no carga
Three.js. Eventos: `alba:resize` (solo resizes de verdad, no la barra del móvil) y `alba:densidad`. `Alba.luz`
(`elegir`, `previa`, `revisar`), `Alba.web`, `Alba.panorama` (geometría, también en Node) los pone la web.

## Mando de densidades (solo con `?revision`)

`index.html?revision` enseña «Versión: **Amanece** / **Sobria**» abajo a la izquierda (se aparta mientras está el aviso
de cookies). Sin `?revision` no existe.

- **Amanece** (cargada): la página entera cambia de luz con la hora, la portada se arrastra, el pie se dibuja.
- **Sobria**: la página se queda de día y **solo la portada lleva la luz de ahora**; sin gesto ni animaciones; y **añade**
  el día de hoy en cifras en la portada (amanece, el sol entra en la casa, se va, anochece, horas de sol) y la tabla «De un
  vistazo» (los dos tipos de apartamento en seis filas, con el precio por persona).

### Receta de borrado (antes de enseñársela al cliente como web suya)

1. `partes/cabeza.html`: borrar desde `// MANDO DE MAQUETA` hasta el cierre de su `if (q && q.has('revision')) { … }`.
2. `partes/pie.html`: borrar desde `<!-- MANDO DE MAQUETA` hasta `<!-- fin del MANDO DE MAQUETA -->`.
3. `js/main.js`: borrar el bloque `/* ============ 12. MANDO DE MAQUETA` … `/* fin del MANDO DE MAQUETA */`.
4. `css/estilos.css`: borrar desde `/* MANDO DE MAQUETA` hasta `/* fin del MANDO DE MAQUETA */` (se van también las
   reglas de la sobria).
5. `node construir.mjs && node verificar.mjs` (el bloque 1 comprueba esta receta sobre copias en memoria).

## Nivel (§5 bis) y «no repetir» (§3 bis)

- **Fórmula rota**: sin cortina, sin pila sticky, sin marquesina, sin cursor propio, sin letra a letra, sin botones
  magnéticos y sin GSAP ni Lenis. **Pieza propia**: el panorama real desde la puerta con el sol de ahora y su frase, que
  además gobierna la luz de toda la web.
- **Gesto táctil del hero**: arrastrar la hora (Pointer Events, `touch-action: pan-y`, vuelta a ahora con suavizado);
  probado con toques reales por CDP (bloque 13).
- **El objeto se completa en el pie**: el día de hoy entero (con movimiento reducido, ya completo).
- **Foco con forma propia**: contorno redondeado de 2 px + el medio sol del alba asomando por el filo de arriba
  (`#foco-alba`), en el color del foco de cada estado (en la portada, el del sol; en `#lugar`, el suyo).
- **Menú §5 bis**: dato real en vivo: el sol de ahora en Caunedo con el relieve (calculado, sin servicio externo).
- **Rendimiento** (abajo).

`node ../plantillas-negocios-web/scripts/repeticion.mjs ../apartamentos-alba-somiedo-web` (2026-11-25): en las últimas
diez webs no domina ninguna pieza (marquesina, letra a letra, cursor, cortina y serif 0/10; crema con acento 1/10). **Alba
no usa ninguna del kit** («crema + acento chillón: fondo #EEF2EE» lo nota como posible, pero no cuenta: es gris verdoso
frío, no crema) → **repite 0 de las dominantes (tope 2)**.

## Rendimiento

Medido el 2026-11-25 en `verificar.mjs` (bloque 12: 412×915, **escala 1**, CPU ×4, 4G lenta 1,6 Mb/s y 150 ms, letras
servidas vacías y 3D vacío): **LCP 1,46-1,59 s** (el `<text>` «Alba» del SVG de la portada) y **una tarea larga de
~225 ms al cargar** (montar la portada: capas, camino del sol y tramos de sol del día). **INP no medido.** Sin canvas ni
WebGL en la parte de la Web (el 3D tiene su propio presupuesto en `LUGAR.md`): no hay DPR que topar; la portada solo pinta
mientras se arrastra o vuelve, y su reloj de cada minuto no hace nada si la portada no se ve. El mapa es SVG con dos
imágenes de relieve (142 KB y 95 KB, `loading` al acercarse); las fotos de Commons, a 480/800 y diferidas.

## Verificación

`node verificar.mjs` (2026-11-25, con `js/sol.js` y `data/lugar-horizonte.json` REALES de Lugar 3D; `js/lugar.js` y
`css/lugar.css` servidos vacíos): **156 bien, 1 mal** en el pase entero; el fallo era la receta del mando (el código del
foco nombraba `.mando`); corregido, los bloques 1 y 3 vuelven a pasar: **60 bien, 0 mal**. Trece bloques: archivos y
contrato; portada a cinco tamaños y la frase a cuatro horas; la luz (cuatro estados, mando, contraste AA medido en el
navegador en los cuatro, foco); la casa; la visita a petición; el hueco del 3D; A cuánto queda (rutas, mandos, teclado,
táctil, fallo de datos); el simulador; cookies, mapa y mando; móvil (menú, barra, anchos, botones); legales; rendimiento; y,
una vez y al final, con movimiento (gesto táctil, pie, recarga).

## Qué mirar en Chrome

**Nadie ha visto la web pintada**: las pruebas miden comportamiento, no aspecto (sin capturas, por las reglas del PC).
Servidor local en esta carpeta (`npx serve -l 8971` o `python -m http.server 8971`) y abrir `index.html`.

1. **Portada**: que «Alba» se lea detrás de las peñas (que las cumbres le muerdan solo la base); que las cuatro capas se
   distingan; que los nombres de las cimas no se monten. Probar `?hora=08:30`, `?hora=12:00`, `?hora=13:40`, `?hora=18:00`
   y `?hora=22:00` con `&fecha=2026-11-25`. Y en verano: `?fecha=2027-06-21&hora=07:00`.
2. **Arrastrar el sol** (ratón y dedo): que el sol siga al dedo, que toda la web cambie de luz con él y que al soltar vuelva.
3. **Los cuatro estados** con el mando de la cabecera: sobre todo atardecer y noche en «La casa» (la fachada con las
   ventanas encendidas), el mapa (el relieve fundido) y el simulador.
4. **La fachada dibujada**: está trazada a mano sobre la foto; mirar proporciones de la escalera y los balaustres.
5. **A cuánto queda**: elegir Lago del Valle, Lagos de Saliencia, Oviedo y León (el vuelo del mapa y el trazo); «Tengo 1
   hora»; «A pie». Que el sombreado del relieve se lea en los cuatro estados.
6. **El simulador**: elegir fechas en julio y en diciembre (alta y baja), la cancelación y el correo que prepara.
7. **La visita virtual**: pulsar y moverse por sus miniaturas.
8. **El pie**: bajar del todo y ver cómo se dibuja el día y el sol se esconde.
9. `?revision` → **Sobria**.
10. El **foco** con Tab (el medio sol en la esquina).

## Lo que se ha cambiado respecto al encargo (y por qué)

- **Selector por apartamento en la visita**: no se puede (su visor no abre nodos por URL; comprobado en su código). Va la
  guía de las vistas por apartamento junto a un solo visor.
- **Reseñas**: la nota de Google no se ha podido comprobar en su ficha (Google pide consentimiento a los navegadores
  automáticos); va con «por comprobar» a la vista.
- **«Vistas a El Mocoso (1.471 m)»** (su texto): no se usa. El Pico Mocoso de OSM mide 1.986 m en el MDT y, desde la casa,
  lo tapa una cresta más cercana. Ver PENDIENTES.
- **Cota**: 960 m (MDT05, `data/lugar.json`), no 959 (Open-Meteo).
- **Braña de Mumián**: está a 1,3 km en línea recta, pero el mapa de caminos de OSM no tiene senda directa desde Caunedo:
  OSRM va por la carretera hasta el arranque de la senda (5,7 km, 1 h 18 min). Se dice así en la web.
- **Lagos de Saliencia**: se da el lago de la Cueva (el primero desde La Farrapona) como destino.
