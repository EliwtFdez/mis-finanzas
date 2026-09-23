import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debeBloquear, GRACIA_BLOQUEO_MS } from '../src/domain/bloqueo.ts';

test('bloquea al abrir la app solo si está activado', () => {
  assert.equal(debeBloquear(true, null, 1000), true);
  assert.equal(debeBloquear(false, null, 1000), false);
});

test('respeta el periodo de gracia al volver de segundo plano', () => {
  assert.equal(debeBloquear(true, 0, GRACIA_BLOQUEO_MS - 1), false);
  assert.equal(debeBloquear(true, 0, GRACIA_BLOQUEO_MS), true);
  assert.equal(debeBloquear(false, 0, GRACIA_BLOQUEO_MS * 10), false);
});
