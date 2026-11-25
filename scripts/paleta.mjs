// Contraste (WCAG 2) de las parejas de color en los CUATRO estados de luz y en #lugar, leído de css/base.css.
//   node scripts/paleta.mjs        → tabla; sale con código 1 si alguna pareja no llega a su mínimo
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(RAIZ, 'css/base.css'), 'utf8');

function bloque(selector) {
  const i = css.indexOf(selector + ' {');
  if (i < 0) throw new Error('falta ' + selector);
  const cuerpo = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  const v = {};
  for (const m of cuerpo.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) v[m[1]] = m[2];
  return v;
}
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const ESTADOS = { dia: ':root, :root[data-luz="dia"], .portada[data-luz="dia"]', alba: ':root[data-luz="alba"], .portada[data-luz="alba"]', atardecer: ':root[data-luz="atardecer"], .portada[data-luz="atardecer"]', noche: ':root[data-luz="noche"], .portada[data-luz="noche"]' };
// [texto, fondo, mínimo, qué es]
const PAREJAS = [
  ['texto', 'fondo', 7, 'texto'], ['texto', 'fondo-2', 7, 'texto en tramo alterno'], ['texto', 'superficie', 7, 'texto en cajas'],
  ['texto-suave', 'fondo', 4.5, 'texto secundario'], ['texto-suave', 'fondo-2', 4.5, 'secundario en tramo alterno'], ['texto-suave', 'superficie', 4.5, 'secundario en cajas'],
  ['marca', 'fondo', 4.5, 'titulares'], ['marca', 'fondo-2', 4.5, 'titulares en tramo alterno'],
  ['acento-texto', 'fondo', 4.5, 'enlaces'], ['acento-texto', 'superficie', 4.5, 'enlaces en cajas'], ['acento-texto', 'fondo-2', 4.5, 'enlaces en tramo alterno'],
  ['sobre-acento', 'acento', 4.5, 'botón principal'], ['foco', 'fondo', 3, 'foco'], ['foco', 'superficie', 3, 'foco en cajas'], ['linea', 'fondo', 1.3, 'filetes (decorativo)'],
  ['suelo-texto', 'suelo', 7, 'texto de la portada'], ['suelo-suave', 'suelo', 4.5, 'secundario de la portada'], ['suelo-texto', 'capa-4', 4.5, 'texto de la portada sobre la ladera cercana'], ['suelo-suave', 'capa-4', 4.5, 'secundario sobre la ladera cercana'],
  ['palabra', 'cielo-medio', 3, '«Alba» sobre el cielo (texto grande)'], ['palabra', 'cielo-bajo', 3, '«Alba» sobre el cielo bajo'],
  ['cima-texto', 'cima-halo', 4.5, 'nombres de las cimas (con su halo)'],
];
let mal = 0;
for (const [nombre, sel] of Object.entries(ESTADOS)) {
  const v = bloque(sel);
  console.log(`\n${nombre.toUpperCase()}`);
  for (const [a, b, min, que] of PAREJAS) {
    if (!v[a] || !v[b]) { console.log(`  falta --${a} o --${b}`); mal++; continue; }
    const c = contraste(v[a], v[b]);
    const ok = c >= min;
    if (!ok) mal++;
    console.log(`  ${ok ? 'ok ' : 'MAL'} ${c.toFixed(2).padStart(6)} ≥ ${min}  --${a} sobre --${b}  (${que})`);
  }
}
const L = bloque('#lugar');
console.log('\n#LUGAR (oscura en los cuatro)');
for (const [a, b, min] of [['texto', 'fondo', 7], ['texto-suave', 'fondo', 4.5], ['texto-suave', 'superficie', 4.5], ['acento-texto', 'fondo', 4.5], ['foco', 'fondo', 3]]) {
  const c = contraste(L[a], L[b]); if (c < min) mal++;
  console.log(`  ${c >= min ? 'ok ' : 'MAL'} ${c.toFixed(2).padStart(6)} ≥ ${min}  --${a} sobre --${b}`);
}
console.log(mal ? `\n${mal} parejas por debajo` : '\nTodas las parejas llegan a su mínimo');
process.exitCode = mal ? 1 : 0;
