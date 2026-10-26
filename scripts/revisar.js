// Revisión rápida de js/ sin dependencias: corre en `npm run revisar` y en GitHub.
// 1. Cada archivo debe tener sintaxis válida.
// 2. Ninguna función global puede estar definida en dos archivos (regla de oro 1):
//    con scripts clásicos la última en cargar pisa a la otra EN SILENCIO.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'js');
const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const definidas = {};
let errores = 0;

for (const f of archivos) {
  const codigo = fs.readFileSync(path.join(dir, f), 'utf8');
  try {
    new vm.Script(codigo, { filename: 'js/' + f });
  } catch (e) {
    console.error('❌ Sintaxis en js/' + f + ': ' + e.message);
    errores++;
  }
  // Solo declaraciones al inicio de línea (globales); las anidadas van indentadas
  const re = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = re.exec(codigo))) {
    (definidas[m[1]] = definidas[m[1]] || []).push(f);
  }
}

for (const [nombre, donde] of Object.entries(definidas)) {
  if (donde.length > 1) {
    console.error('❌ La función ' + nombre + '() está definida más de una vez: ' + donde.join(', '));
    errores++;
  }
}

if (errores) process.exit(1);
console.log('✅ ' + archivos.length + ' archivos de js/ sin errores de sintaxis ni funciones duplicadas');
