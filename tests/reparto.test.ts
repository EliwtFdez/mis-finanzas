import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repartoGastos, type Categoria, type LineaCategoria } from '../src/domain/finanzas.ts';

const linea = (nombre: string, gastado: number): LineaCategoria => ({
  categoria: { id: nombre, nombre, tipo: 'Gasto', orden: 0 } as Categoria,
  gastado,
  presupuesto: null,
});

test('ordena de mayor a menor, omite las que no tienen gasto y suma 1', () => {
  const r = repartoGastos([linea('Comida', 300), linea('Salud', 0), linea('Vivienda', 700)]);
  assert.deepEqual(r.map((s) => [s.categoria?.nombre, s.gastado, s.proporcion]), [
    ['Vivienda', 700, 0.7],
    ['Comida', 300, 0.3],
  ]);
});

test('más de 5 categorías: el resto se junta en «Otras»', () => {
  const r = repartoGastos([10, 20, 30, 40, 50, 60, 70].map((n, i) => linea(`C${i}`, n)));
  assert.deepEqual(r.map((s) => s.categoria?.nombre ?? 'Otras'), ['C6', 'C5', 'C4', 'C3', 'C2', 'Otras']);
  assert.equal(r.at(-1)!.gastado, 30);
  assert.ok(Math.abs(r.reduce((s, x) => s + x.proporcion, 0) - 1) < 1e-9);
});

test('con 6 categorías no crea «Otras» de una sola', () => {
  const r = repartoGastos([10, 20, 30, 40, 50, 60].map((n, i) => linea(`C${i}`, n)));
  assert.equal(r.length, 6);
  assert.ok(r.every((s) => s.categoria !== null));
});

test('sin gastos no hay reparto', () => {
  assert.deepEqual(repartoGastos([linea('Comida', 0)]), []);
  assert.deepEqual(repartoGastos([]), []);
});
