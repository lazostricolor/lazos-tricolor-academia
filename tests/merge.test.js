// Tests del núcleo de sincronización (js/merge.js).
// Correr con: npm test   (Node 18+, sin dependencias)
// Cada test lleva el nombre del bug que protege: si uno falla, NO lo
// "arregles" cambiando el test; revisa qué cambió en mergeDB.
const { test } = require('node:test');
const assert = require('node:assert/strict');

// mergeDB escribe mucho en consola; en los tests sobra
console.log = () => {};
console.warn = () => {};

const { mergeDB, coherenciaAlumnas } = require('../js/merge.js');

const al = (id, extra = {}) => ({ id, nombre: 'Alumna ' + id, categoria: 'Infantil', ...extra });

test('un remoto más nuevo pero VACÍO no borra las alumnas locales', () => {
  const local  = { alumnos: [al(1), al(2)], _ts_alumnos: 100 };
  const remoto = { alumnos: [], _ts_alumnos: 200 };
  const r = mergeDB(local, remoto);
  assert.deepEqual(r.alumnos.map(a => a.id), [1, 2]);
});

test('una sección sin _ts_ remoto no gana por tener _version alto (pérdida de rifas 2026-07-11)', () => {
  const local  = { pagos: { 1: { '2026-10': { pagado: true } } }, _ts_pagos: 100 };
  const remoto = { pagos: {}, _version: 9e12 };
  const r = mergeDB(local, remoto);
  assert.equal(r.pagos[1]['2026-10'].pagado, true);
});

test('fusión por id: no se pierde lo que agregó el otro equipo y gana la edición más reciente', () => {
  const local  = { alumnos: [al(1), al(2, { nombre: 'Vieja', _editTs: 10 })], _ts_alumnos: 100 };
  const remoto = { alumnos: [al(2, { nombre: 'Nueva', _editTs: 20 }), al(3)], _ts_alumnos: 200 };
  const r = mergeDB(local, remoto);
  assert.deepEqual(r.alumnos.map(a => a.id).sort(), [1, 2, 3]);
  assert.equal(r.alumnos.find(a => a.id === 2).nombre, 'Nueva');
});

test('una alumna retirada no revive como activa (retiro más reciente gana)', () => {
  const local  = { alumnos: [al(5, { _movTs: 100 })], alumnosRetirados: [], _ts_alumnos: 100, _ts_alumnosRetirados: 100 };
  const remoto = { alumnos: [], alumnosRetirados: [al(5, { _movTs: 200, fechaRetiro: '2026-10-01' })], _ts_alumnos: 200, _ts_alumnosRetirados: 200 };
  const r = mergeDB(local, remoto);
  assert.equal(r.alumnos.some(a => a.id === 5), false);
  assert.equal(r.alumnosRetirados.filter(a => a.id === 5).length, 1);
});

test('una reactivación más reciente que el retiro la deja solo en activas', () => {
  const db = { alumnos: [al(5, { _movTs: 300 })], alumnosRetirados: [al(5, { _movTs: 200 })] };
  coherenciaAlumnas(db);
  assert.equal(db.alumnos.filter(a => a.id === 5).length, 1);
  assert.equal(db.alumnosRetirados.some(a => a.id === 5), false);
});

test('arrays sin id: se conserva el más largo (comportamiento documentado)', () => {
  const local  = { gastos: [{ m: 1 }, { m: 2 }, { m: 3 }], _ts_gastos: 100 };
  const remoto = { gastos: [{ m: 9 }], _ts_gastos: 100 };
  const r = mergeDB(local, remoto);
  assert.equal(r.gastos.length, 3);
});

test('pagos con el mismo _ts: gana el _editTs más nuevo y, sin sello, gana "pagado"', () => {
  const local = { _ts_pagos: 100, pagos: {
    1: { '2026-09': { pagado: false, _editTs: 50 } },
    2: { '2026-09': { pagado: true } }
  } };
  const remoto = { _ts_pagos: 100, pagos: {
    1: { '2026-09': { pagado: true, _editTs: 40 } },
    2: { '2026-09': { pagado: false } }
  } };
  const r = mergeDB(local, remoto);
  assert.equal(r.pagos[1]['2026-09'].pagado, false); // editado después en local
  assert.equal(r.pagos[2]['2026-09'].pagado, true);  // pagos viejos sin sello
});

test('no se pierden claves que mergeDB no conoce (alumnosHistoricas)', () => {
  const local  = { alumnosHistoricas: [al(90)] };
  const remoto = { alumnosHistoricas: [al(91)] };
  const r = mergeDB(local, remoto);
  assert.deepEqual(r.alumnosHistoricas.map(a => a.id).sort(), [90, 91]);
});

test('nextId y reciboSeq nunca retroceden', () => {
  const r = mergeDB({ nextId: 40, reciboSeq: 7 }, { nextId: 35, reciboSeq: 9 });
  assert.equal(r.nextId, 40);
  assert.equal(r.reciboSeq, 9);
});

test('ninguna sección conocida queda undefined aunque el remoto venga incompleto', () => {
  const r = mergeDB({}, {});
  for (const k of ['alumnos', 'alumnosRetirados', 'profesores', 'pagos', 'asistencias', 'clases', 'rifas', 'gastosV', 'planificador']) {
    assert.notEqual(r[k], undefined, k);
  }
});
