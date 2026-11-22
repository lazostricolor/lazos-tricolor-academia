// Tests de la mensualidad por vigencia (TARIFAS en state.js, calcMensualidad en utils.js).
// Protegen que subir el precio NO cambie lo que se cobró en meses pasados.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Carga state.js y utils.js como en el navegador (scripts clásicos, mismo ámbito global)
function cargar(tarifasExtra) {
  const ctx = vm.createContext({
    console,
    document: { querySelectorAll: () => [], getElementById: () => null, createElement: () => ({}) },
    window: {},
    Date
  });
  for (const f of ['state.js', 'utils.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  if (tarifasExtra) vm.runInContext('TARIFAS.push(' + JSON.stringify(tarifasExtra) + ')', ctx);
  return (alumna, mk) => vm.runInContext('calcMensualidad(' + JSON.stringify(alumna) + ',' + JSON.stringify(mk) + ')', ctx);
}

test('con la tarifa actual los valores no cambian respecto al código anterior', () => {
  const calc = cargar();
  assert.equal(calc({}, '2026-10'), 70000);
  assert.equal(calc({}, '2026-12'), 35000);   // diciembre: medio mes
  assert.equal(calc({}, '2026-01'), 35000);   // enero: medio mes
  assert.equal(calc({ familiar: true }, '2026-10'), 50000);
  assert.equal(calc({ familiar: true }, '2026-12'), 25000);
});

test('subir la mensualidad no cambia los meses anteriores a la nueva tarifa', () => {
  const calc = cargar({ desde: '2027-02', base: 80000, familiar: 60000, medio: 40000, medioFamiliar: 30000 });
  assert.equal(calc({}, '2026-11'), 70000);            // antes: igual que siempre
  assert.equal(calc({}, '2027-01'), 35000);            // enero 2027 aún con la tarifa vieja
  assert.equal(calc({}, '2027-02'), 80000);            // desde la nueva vigencia
  assert.equal(calc({ familiar: true }, '2027-03'), 60000);
  assert.equal(calc({}, '2027-12'), 40000);
});

test('un mes anterior a la primera tarifa usa la primera (no revienta)', () => {
  const calc = cargar();
  assert.equal(calc({}, '2023-05'), 70000);
});
