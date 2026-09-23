import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nivelPresupuesto } from '../src/domain/finanzas.ts';

test('nivel del presupuesto: bien antes del 80%, cerca desde el 80% y agotado desde el 100%', () => {
  assert.equal(nivelPresupuesto(0, 1000), 'bien');
  assert.equal(nivelPresupuesto(799.99, 1000), 'bien');
  assert.equal(nivelPresupuesto(800, 1000), 'cerca');
  assert.equal(nivelPresupuesto(999.99, 1000), 'cerca');
  assert.equal(nivelPresupuesto(1000, 1000), 'agotado');
  assert.equal(nivelPresupuesto(1500, 1000), 'agotado');
});

test('los centavos flotantes no esconden el 80%', () => {
  // 0.7 + 0.1 da 0.7999999999999999 en coma flotante
  assert.equal(nivelPresupuesto(0.7 + 0.1, 1), 'cerca');
});

test('sin presupuesto no hay alerta; con presupuesto en cero cualquier gasto lo agota', () => {
  assert.equal(nivelPresupuesto(5000, null), 'bien');
  assert.equal(nivelPresupuesto(0, 0), 'bien');
  assert.equal(nivelPresupuesto(1, 0), 'agotado');
});
