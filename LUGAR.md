# Lugar 3D · «El alba, hoy»

El sol de toda la web (`js/sol.js`) y el módulo `lugar` de la sección `#lugar` (agente Lugar 3D, 2026-11-25).
Ficheros: `js/sol.js`, `js/lugar.js`, `css/lugar.css`, `data/lugar.json`, `data/lugar-horizonte.json`,
`data/lugar-escena.json`, `img/lugar/`, `vendor/three-0.160.0.module.min.js`, `scripts/lugar-*`,
`ref/raw/lugar-prueba.html` y `ref/raw/lugar-cache/` (caché de descargas, **114 MB: no va al repo**).

**Nadie ha visto el 3D pintado.** No se prueba con Playwright (reglas del PC): lo tiene que mirar Álvaro en su Chrome
(ver «Qué mirar»). Lo comprobado, en «Pruebas».

## El sol en la casa, día 21 de cada mes (2026, hora de Madrid)

`js/sol.js` sobre el horizonte de `data/lugar-horizonte.json`. «Entra» = asoma el borde de arriba del sol sobre el
relieve visto desde la planta alta de la casa. «Plano» = las horas de las tablas (sin montañas). Se rehace con
`node scripts/lugar-sol.mjs --md`.

| Día 21 de | Orto (plano) | **Entra en la casa** | Portada («hacia las») | Se esconde | Ocaso (plano) | Sol directo | Por dónde entra (rumbo · altura) |
|---|---|---|---|---|---|---|---|
| enero | 08:50 | **10:18** | 10:20 | 15:20 | 18:22 | 4 h 33 (4 ratos) | 133° · 12.5° |
| febrero | 08:13 | **09:45** | 09:45 | 15:56 | 19:03 | 6 h 10 | 120° · 14.7° |
| marzo | 07:26 | **09:16** | 09:15 | 16:37 | 19:38 | 7 h 21 | 108° · 19.0° |
| abril | 07:33 | **09:31** | 09:30 | 18:17 | 21:14 | 8 h 46 | 93° · 20.5° |
| mayo | 06:56 | **09:22** | 09:20 | 18:57 | 21:47 | 9 h 35 | 85° · 24.6° |
| junio | 06:45 | **09:29** | 09:30 | 19:28 | 22:08 | 9 h 59 | 82° · 27.0° |
| julio | 07:04 | **09:32** | 09:30 | 19:08 | 21:57 | 9 h 36 | 84° · 24.7° |
| agosto | 07:37 | **09:35** | 09:35 | 18:21 | 21:18 | 8 h 46 | 92° · 20.5° |
| septiembre | 08:11 | **10:01** | 10:00 | 17:23 | 20:24 | 7 h 23 | 108° · 19.0° |
| octubre | 08:45 | **10:16** | 10:15 | 16:24 | 19:32 | 6 h 08 | 120° · 14.6° |
| noviembre | 08:24 | **09:53** | 09:55 | 14:53 | 17:56 | 4 h 19 (3 ratos) | 133° · 12.5° |
| diciembre | 08:53 | **10:34** | 10:35 | 12:57 | 17:52 | 2 h 22 | 141° · 13.1° |

- **Ningún día de 2026 se queda sin sol directo** en la casa: aquí `entrada()` nunca da `null` (sí lo da si el
  relieve tapa el sol todo el día; está probado con un horizonte de 40°). El día con menos sol es el 19 de diciembre
  (2 h 22, de 10:33 a 12:56: entra por el portillo del sureste y se esconde tras la sierra del sur antes de
  mediodía). Entra más tarde el 1 de enero (10:38) y más pronto el 28 de marzo (09:04).
- En invierno el sol **entra y sale varias veces** (hasta 4 ratos en enero): asoma por el sureste, se mete detrás de
  una cresta y vuelve a salir. `Alba.sol.tramos(fecha)` da cada rato.
- El relieve roba entre hora y media (invierno) y casi tres horas (junio: el sol sale por detrás de la peña del
  noreste, a 0,5 km) a la mañana.

### Cómo se ha validado (`scripts/lugar-sol.mjs`, referencias independientes, respuestas guardadas en la caché)

| Qué | Referencia | Resultado |
|---|---|---|
| Posición del sol (acimut y altura geométrica) | **JPL Horizons** (NASA), observador topocéntrico en la casa, 48 instantes de 2026 | error máx. **0,0055°** en acimut y **0,0051°** en altura (pedido: ≤ 0,1°) |
| Altura con refracción (> 2°) | JPL Horizons `REFRACTED` (1010 hPa, 10 °C) | 0,019° (Alba.sol usa ~903 hPa, la presión a 964 m) |
| Orto y ocaso con horizonte plano | **Open-Meteo** (archivo), los 365 días de 2025 | media **31 s**, máx. **1,09 min** (Open-Meteo da el minuto truncado) |
| El horizonte | **PVGIS** (JRC, Comisión Europea, MDT propio de ~90 m), 48 rumbos | mediana **1,0°**; máx. 7,5° a 75°: la peña del noreste está a 0,5 km y a 90 m PVGIS la aplana (el MDT05 del IGN la ve entera) |
| La sombra del 3D en la casa | la misma marcha por el relieve que hace la GPU, sobre los PNG de alturas de la escena | entra a la misma hora que Alba.sol **±1 min** los 12 meses |

Dos trampas de Open-Meteo, comprobadas: el archivo da todo el año con desfase fijo +1 h (sin horario de verano) y
calcula en el centro de su celda (43,128, −6,304: a ~7 km). La comparación se hace en esos términos.

## El horizonte (`data/lugar-horizonte.json`)

`{ lat, lon, cota, alturaOjo, horizonte[360], distanciaKm[360], cimas[], tapadas[], paso, horizonteFino[3600] }`
(el contrato del encargo más tres campos: `horizonteFino` cada 0,1°, que es el que usa Alba.sol para no perder picos
estrechos; `tapadas`; `paso`). Lo hace `scripts/lugar-horizonte.py`:

- **El ojo**: centro de la casa del Catastro, **a 4 m sobre el MDT05** (ventanas de la planta alta). Los 30 primeros
  metros no cuentan (la casa, su era y la carretera: el MDT es el suelo desnudo). Bajar el ojo a 1,5 m movería la
  entrada como mucho 1-2 min (el relieve que manda está a 0,5-4 km).
- Cada 0,1° de rumbo, del ojo a 150 km: **MDT05** del IGN hasta ~11 km, **MDT25** hasta ~33 km y **MDT200** más
  allá; curvatura de la Tierra con refracción terrestre normal (k = 0,13). Máximo 32,8° (al 70°, la peña de encima
  de la casa); mínimo 0,24° (al norte, el valle abierto hacia la Pola).
- **`cimas`** (en el perfil; nombre de OpenStreetMap, cota del MDT del IGN): Peña de Gúa (111°, 20,1°, 1.686 m,
  2,0 km), Peña Salgada (123°, 13,6°, 1.975 m, 4,2 km), El Altu Putracón (131°, 13,1°, 1.912 m, 4,1 km), Alto la
  Encarralina (140°, 13,6°, 1.859 m, 3,7 km), Pico Cerridiel (336°, 10,0°, 1.465 m, 2,8 km), Alto de la Mochá (350°,
  4,9°, 1.495 m, 6,2 km). El nomenclátor del IGN (NGBE, WFS) no respondía (504) el día de hacerlo: los nombres son
  los de OSM (casi todos de la importación del IGN), comprobados contra el perfil del MDT.
- **«El Mocoso (1.471 m)» de su texto no cuadra.** El Pico Mocoso de OSM (y vértice `Mocoso`) está a 2,05 km al
  oeste-suroeste (258°) y tiene **1.988 m** en el MDT05 (1.989 en OSM). **Su cima no se ve desde la casa**: queda
  4,4° por debajo de su propia ladera, que es lo que forma el perfil por ese lado (a 1,2 km). Desde la casa se ve
  la mole del Mocoso, no su cumbre. No hay ninguna cumbre de 1.471 m en el perfil; lo más parecido es el Pico
  Cerridiel (1.465 m, al norte-noroeste). Va en `tapadas` para no rotularlo como si se viera. **Pendiente**:
  preguntar a la casa qué llaman «El Mocoso» y quitar la cifra de 1.471 m.

## La casa (`data/lugar.json`)

- **El punto de su web cae a 8 m de la casa** (sobre la casa baja pegada). La casa es la **parcela catastral
  D00110500QH27A** (1988; 77 m² de planta; **2 plantas + 1 bajo rasante**, como en las fotos: dos alturas de piedra al
  norte, una al sur). Se ha deducido de la ortofoto y de las fotos de su web: la casa alta con la casa baja blanca
  pegada al este (`0008.jpg`), la fachada de tres alturas al norte (`0004.jpg`) y el hastial a la calle al oeste
  (`0001.jpg`). Por eso **la escalera de madera queda en la fachada sur** (deducido).
- `cotaCasa` **960 m** (MDT05 en el centro; 958-961 m en sus bordes; Open-Meteo daba 959). `lat` 43,067674,
  `lon` −6,257025 (centro de la casa del Catastro).
- **Duda para la casa**: en el Catastro, D00110500 tiene 2 viviendas (76 y 77 m²) y las dos parcelas de la casa
  baja pegada (D00110600 y D00110700) una cada una (43 y 48 m²): **4 viviendas entre las tres**. Puede que uno o dos
  de los apartamentos estén en la casa baja. En el 3D la casa baja va como vecina (blanca, teja roja, sin detalle).

## Qué hace el 3D

Un vuelo que avanza con el scroll (escenario `position: sticky` en una pista de 480 vh; sin GSAP; se sale bajando o
subiendo con rueda, táctil o teclado):

| Scroll | Cámara | Parada |
|---|---|---|
| 0 – 22 % | sobre Peña Salgada (~2.170 m), mirando al valle: el portillo del sureste por donde entra el sol de invierno | Desde las cumbres |
| 22 – 45 % | cruza sobre la Peña de Gúa: la sombra de las peñas sobre la ladera de enfrente | La sombra de las peñas |
| 45 – 68 % | sobre la Pola mirando valle arriba: Gúa abajo, Caunedo al fondo | El valle |
| 68 – 86 % | baja por el valle hacia Caunedo | Caunedo |
| 86 – 100 % | rodea el pueblo y acaba **en la calle al suroeste de la casa, a 1,7 m**: el hastial oeste y la escalera, con la peña detrás (el encuadre de `0001.jpg`) | La casa |

- **Relieve**: MDT05 del IGN a 4 m en 1,2 km alrededor de la casa y a 20 m en una caja de 12 × 12 km; anillo de
  64 × 64 km con MDT25/MDT200 a 250 m. **A escala real, sin exagerar**, con la caída por la curvatura ya aplicada (la
  escena es el plano tangente en la casa: el sol de Alba.sol vale tal cual en toda ella). Malla: 4 m alrededor de la
  casa, hasta 60 m lejos (85 m en móvil); la escena entera son ~415 000 triángulos en escritorio y ~281 000 en móvil.
- **Ortofoto PNOA**: 4,7 m/px en el valle (2560 px; 9,4 en móvil), **0,59 m/px en la caja de la casa** (WMTS z18,
  2048 px; 1,2 en móvil; los tejados borrados, porque los edificios van en 3D) y 40 m/px el anillo. Los oscuros de la
  foto se aclaran un poco en el sombreado (la foto trae las sombras del día del vuelo; las de ahora las pone el relieve).
- **La sombra de las peñas**: en la GPU, en dos texturas (valle a 12 m/px, casa a 2,3 m/px) que se recalculan **solo
  cuando cambia el sol**: cada texel marcha hacia el sol por el relieve (150 pasos que crecen un 8 % hasta 80 m, hasta
  7,5 km; en móvil 96 pasos) y compara con la altura del sol, con la penumbra del disco. El suelo y los edificios la
  leen en su luz directa. **La casa de Alba no la lee: su luz sale de Alba.sol** (borde del disco sobre el horizonte
  del MDT05), así que se enciende a la misma hora que dice la portada.
- **La casa** sobre su planta del Catastro (8,7 × 11,0 m): zócalo de mampostería de granito (dos alturas al norte,
  una al sur), planta alta blanca con **esquinas de sillares de granito**, recercados de granito en todos los huecos
  (18), carpintería de madera, **tejado de teja roja a dos aguas con la cumbrera este-oeste** y dos chimeneas de piedra
  con sombrerete, **escalera exterior pegada a la fachada sur** (16 peldaños de granito sobre su macizo de piedra) con
  **rellano sobre un pilar de granito y 57 balaustres torneados de madera** con pasamanos, tejadillos de teja sobre
  las puertas de abajo. Alturas, huecos y chimeneas **a ojo** de las fotos (que solo se han usado de referencia).
- **El pueblo**: los 163 edificios del Catastro en 1,2 km (en móvil, los de 380 m), muros sobre su planta (claros;
  el color real de cada muro no se sabe) y tejado a dos aguas del color de su tejado en la ortofoto. Cuatro mallas.
- **El cielo de ahora**: color del cielo y de la luz según la altura del sol, el sol y la luna en su sitio (la luna,
  con las fórmulas de SunCalc), estrellas; de noche, 5 ventanas de la casa y el farol de la puerta encendidos (halo
  dibujado, sin bloom). La sombra del relieve de noche es la de la luna.
- **El mando de hora** (en el 3D, arriba a la derecha; en el plan B, al lado del plano): la frase del día («Hoy el
  sol entra en la casa hacia las 09:55 y se esconde tras las peñas hacia las 14:50: 3 h 40 de sol directo, en 2
  ratos»), **la línea del día** (del orto al ocaso, con los ratos de sol en la casa en `--acento-texto` y la marca de
  la hora), un deslizador de hora (de 1 h antes del orto a 1 h después del ocaso, de 5 en 5 min, con teclado), «Ahora»
  y **«Ver cómo entra el sol»** (7 s, de un poco antes de la entrada a un poco después; no sale con movimiento
  reducido) y la frase del instante («A las 08:45 el sol está a 2°, pero por el sureste la peña sube hasta 14°: la
  casa sigue a la sombra hasta las 09:57.»). La hora de la escena es siempre la de `Alba.sol` (`?hora`, `?fecha`).
- **Rótulos**: cumbres del perfil + Pico Mocoso y Cornón al principio, pueblos en medio (nombre en castellano de OSM:
  Pola de Somiedo, Gúa, El Coto, La Llera…), «Alba · 960 m» al final; solo si el relieve no los tapa, 8 a la vez
  como mucho (5 en móvil).

### Plan B (en el mismo hueco)

Sin WebGL, con movimiento reducido, en densidad «sobria», con ahorro de datos, en el móvil antes de pulsar el botón
y en navegadores automatizados: **el valle desde el aire** (ortofoto, 6 × 6 km con la casa en el centro y el norte
arriba) **con la sombra de las peñas a la hora del mando**, calculada en un canvas 2D (160 × 160, la misma marcha que
la GPU, como mucho 10 veces por segundo) sobre las alturas del valle; marcas de Alba, pueblos y cumbres; el mismo
mando de hora y la línea del día. De noche se oscurece y la marca de la casa brilla. Sin JS, el respaldo de Web.

| Caso | Qué se ve |
|---|---|
| Escritorio con WebGL2 | el 3D se carga al montar (Web monta a ~900 px); se enseña cuando han llegado las texturas (o a los 7 s) |
| Móvil (≤ 820 px o puntero grueso) o ahorro de datos | plan B + botón **«Ver el valle en 3D»** (Three.js y texturas no se piden hasta pulsar) |
| `prefers-reduced-motion`, `movimiento: false`, `densidad: 'sobria'`, sin WebGL2, `?sin-webgl` | plan B, sin botón |
| `navigator.webdriver` (Playwright) | plan B siempre; `?lugar=3d` lo fuerza (no usarlo con WebGL de verdad en pruebas) |
| En 3D | botón «Ver en plano» abajo a la derecha |
| Si falla la carga o se pierde el contexto | vuelve solo al plan B |

## Para Web

1. **Cargar**: `css/lugar.css` en el `<head>`; `js/sol.js` y `js/lugar.js` con `defer`, `sol.js` antes (ya está).
   **Three.js no lo cargas tú**: `lugar.js` lo pide con `import()` a `vendor/three-0.160.0.module.min.js` (copia propia
   de Three.js r160, MIT, la misma que Montemar) solo cuando hace falta. Sin import map, sin CDN.
2. **Montar**: `Alba.lugar.montar(el, { movimiento, densidad, webgl })` → `{ destruir(), estado(), ver3d(), verPlano(),
   hora(fecha|null) }`. `hora(fecha)` pone la escena a esa hora (por si quieres que el control de luz de la cabecera
   la mueva); `hora(null)` vuelve a «ahora». `densidad: 'sobria'` → plan B.
3. **La clase raíz del módulo es `.lugar-mod`**; todo lo mío va con prefijo `lugar__`. El contenido del div se guarda
   y se repone al destruir.
4. **Sticky**: `top: var(--lugar-arriba)`, que por defecto es tu `var(--cabecera)`. Ningún antepasado de
   `[data-modulo="lugar"]` puede llevar `overflow` (salvo el `overflow-x: clip` de `html`) ni `transform`/`filter`.
5. **Variables que lee** (las de `#lugar`): `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--linea`,
   `--acento-texto` (el sol: ratos de sol, el mando, el botón), `--foco`, `--gutter`, `--ancho`, `--cabecera`,
   `--letra-titular`, `--letra-texto`, `--letra-cifras`. No usa `--marca` ni `--acento`. No define colores de página.
6. **`Alba.sol`** (contrato del encargo y algo más, que ya usa tu portada): `ahora()`, `posicion(f)` →
   `{ azimut, altura, alturaGeometrica }` (altura aparente, con refracción), `entrada(f)`, `salida(f)`, `tramos(f)`,
   `oficial(f)` (horizonte plano, −0,833°), `visible(f)`, `horizonte(az)`, `cargar()`, `usar(datos)`, `madrid(f)`,
   `desdeMadrid(a, m, d, h, mi)`, `hora(f)`, `haciaLas(f)` (redondeo a 5 min). Sin `cargar()`, `entrada`/`salida`/
   `tramos`/`visible` dan `undefined` (no fingen un horizonte plano).
7. **`data/lugar.json`**: `cotaCasa` **960**, `lat`, `lon`, `catastro`. Ya puedes quitar `data/horizonte-provisional.json`.
8. **Privacidad**: el módulo no pide nada fuera de la web (ni Open-Meteo: no hay nubes en esta escena). Créditos en
   el pie del módulo: IGN (CC BY 4.0), Catastro, OSM.
9. **Git (para quien haga el commit)**: `ref/raw/lugar-cache/` pesa **114 MB** y se regenera: hay que ignorarlo en
   `.gitignore` (Montemar lo hace). `ref/` entero lleva además las fotos de EuroWeb Media.
10. **Peso**: con `defer` y la carga diferida, nada entra en el LCP. El 3D baja **3,37 MB en escritorio** (Three.js
    655 KB incluido) y **1,93 MB en móvil** al pulsar; el plan B, **~0,3 MB** (plano de 720 px, alturas de 40 m y los
    dos JSON). `img/lugar/` entero: 3,8 MB. `lugar.js` 85 KB, `sol.js` 10 KB y `lugar.css` 16 KB, sin minificar.

| Fichero | Peso | Para |
|---|---|---|
| `orto-valle-2560.webp` / `-1280` | 1119 / 317 KB | suelo del valle (escritorio / móvil) |
| `orto-cerca-2048.webp` / `-1024` | 684 / 229 KB | suelo alrededor de la casa |
| `orto-lejos-1600.webp` / `-800` | 345 / 131 KB | anillo lejano |
| `alturas-valle.png` | 391 KB | 601 × 601 a 20 m (0,5 m de precisión) |
| `alturas-cerca.png` | 80 KB | 301 × 301 a 4 m |
| `alturas-lejos.png` | 118 KB | 257 × 257 a 250 m |
| `plano-720.webp` / `-1100`, `alturas-plano.png` | 110 / 226 / 123 KB | plan B |

## Datos (cómo se rehacen)

```
python -I -X utf8 scripts/lugar-osm.py         # cumbres (45 km), pueblos, ríos y vías de OSM (Overpass con espejos)
python -I -X utf8 scripts/lugar-horizonte.py   # MDT (en caché), la casa del Catastro, el horizonte → data/lugar-horizonte.json, data/lugar.json
node scripts/lugar-sol.mjs [--md]              # validación del sol (Horizons, Open-Meteo, PVGIS) y la tabla de arriba
python -I -X utf8 scripts/lugar-datos.py       # alturas, ortofotos, Catastro, rótulos, recorrido → img/lugar/, data/lugar-escena.json
node scripts/lugar-prueba.mjs                  # pruebas (ver abajo); --sin-navegador: solo las de Node
```

User-Agent genérico `datos-mapa-script/1.0 (uso puntual)`, sin datos personales. Coordenadas locales en metros desde
el centro de la casa: x al este, z al sur, y = altura del MDT − caída por curvatura. Alturas en PNG RGB:
`(R·256 + G) / 10 − 100` m.

| Fuente | Servicio | Uso |
|---|---|---|
| MDT05 / MDT25 / MDT200 IGN | WCS `servicios.idee.es/wcs-inspire/mdt` (`Elevacion4258_5/_25/_200`; no hay MDT02) | horizonte y relieve |
| PNOA | WMS `www.ign.es/wms-inspire/pnoa-ma` (valle, anillo); WMTS `www.ign.es/wmts/pnoa-ma` z18 (casa) | suelo |
| Catastro | `Consulta_RCCOOR` (parcela del punto), `Consulta_DNPRC` (usos y viviendas), INSPIRE `wfsBU` (plantas y alturas) | la casa y el pueblo |
| OSM | Overpass (espejos; overpass-api.de daba 502) | nombres de cumbres y pueblos |
| JPL Horizons, Open-Meteo, PVGIS | API públicas | solo validación (no los usa la web) |

## Pruebas

`node scripts/lugar-prueba.mjs` (servidor propio en el 8972, un solo Chromium **con WebGL desactivado**, 1280×800 y
390×844, escala 1; se cierra al acabar). Última pasada: **62 bien, 0 mal**. Comprueba:

1. **Node**: el contrato de `Alba.sol`; `?hora`/`?fecha` en hora de Madrid (verano e invierno); orto < entrada <
   salida < ocaso; en la entrada el sol asoma justo sobre la peña; `null` cuando el relieve lo tapa todo; 0 días sin
   sol en 2026; frases del día y del instante; el recorrido no se pasa de sus puntos (máx. 5,3 m por 1/4000 de
   scroll) y acaba a 21 m de la casa mirando al 59°.
2. **Datos**: esquema del horizonte; cada cima cae en el perfil; `lugar.json`; la casa en el centro; `img/lugar` sin
   ficheros de más; pesos.
3. **Plan B** (escritorio y móvil): sin lienzo WebGL; plano, marcas y **sombra de las peñas** (58 % del valle en
   sombra el 25-nov a las 10:30); el mando (10:30 → «da el sol en la casa»; 08:45 → «a la sombra hasta las 09:57»);
   sin scroll horizontal; sin errores; `destruir()` repone el respaldo; **coherencia: la sombra de la escena llega a
   la casa a la misma hora que Alba.sol (±1 min los 12 meses)**.
4. **Escena con un `WebGLRenderer` falso** (Three.js real, no pinta): monta sin NaN (~415 000 triángulos y 228
   objetos en escritorio, ~281 000 en móvil); la sombra del relieve se calcula en pases aparte y se rehace al mover la
   hora; el 21-jun a las 09:00 la casa está a la sombra en la escena y en el texto, a las 09:40 al sol; rótulos y
   paradas por tramos (p=0: Peña Salgada, Pico Mocoso, Pico Cerridiel, El Altu Putracón, Peña de Gúa; p=0,5: Peña de
   Gúa, Gúa, Alba; p=1: Alba); fuera de pantalla no pinta; «Ver en plano»; `destruir()`; en el móvil, plan B con
   botón y sin pedir Three.js hasta pulsar; «Ver cómo entra el sol» acaba con el sol en la casa.

**No comprobado**: nada se ha pintado con WebGL: ni los shaders compilados (el pase de sombras, el parche de Lambert,
el cielo), ni la casa vista, ni la sombra de las peñas en la escena, ni los fps. Un error de GLSL solo se vería en
Chrome (consola: `THREE.WebGLProgram: Shader Error`), con el suelo negro o sin sombras.

## Rendimiento

Sin `transmission`, sin `RectAreaLight`, sin bloom (halos dibujados), colores en sRGB (`'#hex'`), DPR ≤ 1,5 (1,25 en
móvil) con bajada automática (DPR 1; luego sin mapa de sombras y DPR 0,8 si los fotogramas pasan de 30 ms), mapa de
sombras de los edificios solo en 180 m alrededor de la casa y recalculado solo cuando cambia el sol, **se pinta solo
cuando algo cambia** (scroll, tamaño, hora) y nada fuera de pantalla. Lo caro: **el pase de la sombra de las peñas**
(1024² + 512² texels × 150 pasos en escritorio) cada vez que cambia la hora: cada minuto, al mover el mando y en
cada fotograma de «Ver cómo entra el sol». Si ahí va a tirones, bajar `RAYO` en `lugar.js` o el tamaño de `rtValle`.

## Qué mirar (Álvaro, en su Chrome)

Servidor en la carpeta de la web (`python -m http.server 8972`) y abrir `http://localhost:8972/ref/raw/lugar-prueba.html`
(solo el módulo) o la página de Web. **Lo primero**:

1. **Que se pinte** y la consola sin `Shader Error`. Con `?fps` (abajo a la izquierda): fps, calidad, DPR, cámara,
   triángulos y «casa al sol %». Si la calidad baja sola a 1 o 2, va justo.
2. **La sombra de las peñas**: `?fecha=2026-06-21&hora=09:00` y mover el mando hasta las 09:40 (o «Ver cómo entra el
   sol»): la línea de sol tiene que bajar por la ladera y llegar a la casa a las 09:29, cuando el texto dice que
   entra. Mirar que no haya manchas, escalones ni una costura en el borde de la caja de la casa (600 m).
3. **La casa** en el último 15 %: piedra abajo, blanco arriba con esquinas de granito, teja roja, la escalera de
   madera en la fachada de la calle. Si sale al revés (la escalera al norte), avisar: la orientación es deducida.
4. **Que la casa se encienda a la vez que la ladera de alrededor** (la casa usa Alba.sol, el suelo la textura).
5. **De noche** (`?hora=22:30`): ventanas y farol encendidos, luna y estrellas.
6. **Rótulos**: que caigan en su sitio y no se monten.
7. **Móvil real**: el botón «Ver el valle en 3D», que el mando (arriba) no tape la escena y que el scroll no se trabe.
8. Si va a menos de 5 fps: Chrome sin aceleración por hardware (`chrome://settings/system`).

## Pendiente

- Que Álvaro lo vea pintado (nadie lo ha visto).
- Preguntar a la casa por «El Mocoso (1.471 m)» (la cifra no cuadra; ver arriba) y si algún apartamento está en la
  casa baja pegada.
- Confirmar la orientación (escalera al sur) y las medidas a ojo.
- `.gitignore`: añadir `ref/raw/lugar-cache/` (114 MB).
- El MDT no ve árboles ni casas: la casa de enfrente o un árbol pueden adelantar la sombra unos minutos.
