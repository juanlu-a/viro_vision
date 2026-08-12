/**
 * Genera `src/global.css` desde `src/constants/colors.js`.
 *
 * Existe para que las clases de Tailwind se escriban **una sola vez**: `bg-surface` y no
 * `bg-surface dark:bg-dark-surface`. El truco es que el color no es un hex fijo sino una variable
 * CSS, y lo que cambia entre temas es el valor de la variable, no la clase.
 *
 * Se genera en vez de escribirse a mano porque si no habría una segunda copia de la paleta, que es
 * justo lo que `colors.js` existe para evitar. Correr `npm run theme:css` después de tocar colores.
 *
 * `overlay` queda afuera del esquema de tripletas: ya es un rgba con transparencia propia, y
 * Tailwind necesita `r g b` sueltos para poder aplicarle su propio canal alfa.
 */
const fs = require('node:fs');
const path = require('node:path');

const { Colors } = require('../src/constants/colors');

/** `#0E2B4F` → `14 43 79`, que es lo que Tailwind espera para poder componer alfa. */
function aTripleta(hex) {
  const h = hex.replace('#', '');
  const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return n.join(' ');
}

function variables(paleta, indent) {
  return Object.entries(paleta)
    .filter(([, valor]) => valor.startsWith('#'))
    .map(([nombre, valor]) => `${indent}--color-${kebab(nombre)}: ${aTripleta(valor)};`)
    .join('\n');
}

function kebab(nombre) {
  return nombre.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

const css = `/* GENERADO POR scripts/generate-theme-css.js — no editar a mano.
   La paleta vive en src/constants/colors.js. Regenerar con: npm run theme:css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
${variables(Colors.light, '    ')}
  }

  .dark:root {
${variables(Colors.dark, '    ')}
  }
}
`;

const destino = path.join(__dirname, '..', 'src', 'global.css');
fs.writeFileSync(destino, css);
console.log(`global.css generado con ${Object.keys(Colors.light).length} tokens por tema.`);
