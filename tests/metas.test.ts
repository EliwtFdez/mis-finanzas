import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoMeta, estadoMetas, mesesHasta } from '../src/domain/metas.ts';
import type { MetaAhorro } from '../src/domain/finanzas.ts';

const meta = (m: Partial<MetaAhorro> & Pick<MetaAhorro, 'id' | 'objetivo'>): MetaAhorro => ({
  nombre: m.id,
  fecha_limite: null,
  icono: null,
  ...m,
});

test('meses hasta la fecha límite cuentan el mes actual', () => {
  assert.equal(mesesHasta('2026-09-23', '2026-12-31'), 4);
  assert.equal(mesesHasta('2026-09-23', '2026-09-30'), 1);
  assert.equal(mesesHasta('2026-11-02', '2027-03-01'), 5);
});

test('progreso con aportaciones y retiros, y cuánto apartar al mes', () => {
  const e = estadoMeta(
    meta({ id: 'viaje', objetivo: 60000, fecha_limite: '2027-03-31' }),
    [
      { meta_id: 'viaje', importe: 5000 },
      { meta_id: 'viaje', importe: 2500 },
      { meta_id: 'viaje', importe: -1500 },
      { meta_id: 'otra', importe: 99999 },
    ],
    '2026-09-23',
  );
  assert.equal(e.ahorrado, 6000);
  assert.equal(e.falta, 54000);
  assert.equal(e.proporcion, 0.1);
  assert.equal(e.mesesRestantes, 7); // sep a mar
  assert.equal(e.alMes, 7714.29);
  assert.equal(e.completada, false);
  assert.equal(e.vencida, false);
});

test('sin fecha límite no hay monto mensual; al pasarse del objetivo queda completa', () => {
  const sinFecha = estadoMeta(meta({ id: 'fondo', objetivo: 1000 }), [{ meta_id: 'fondo', importe: 300 }], '2026-09-23');
  assert.equal(sinFecha.alMes, null);
  assert.equal(sinFecha.mesesRestantes, null);

  const completa = estadoMeta(meta({ id: 'fondo', objetivo: 1000, fecha_limite: '2026-01-31' }), [{ meta_id: 'fondo', importe: 1200 }], '2026-09-23');
  assert.deepEqual([completa.completada, completa.falta, completa.proporcion, completa.vencida, completa.alMes], [true, 0, 1, false, null]);
});

test('una meta vencida con faltante no sugiere monto mensual', () => {
  const e = estadoMeta(meta({ id: 'x', objetivo: 1000, fecha_limite: '2026-08-31' }), [], '2026-09-23');
  assert.deepEqual([e.vencida, e.mesesRestantes, e.alMes, e.falta], [true, null, null, 1000]);
});

test('orden: pendientes por fecha más cercana, sin fecha al final, completadas abajo', () => {
  const orden = estadoMetas(
    [
      meta({ id: 'lista', objetivo: 10 }),
      meta({ id: 'sin-fecha', objetivo: 100 }),
      meta({ id: 'marzo', objetivo: 100, fecha_limite: '2027-03-01' }),
      meta({ id: 'diciembre', objetivo: 100, fecha_limite: '2026-12-01' }),
    ],
    [{ meta_id: 'lista', importe: 10 }],
    '2026-09-23',
  ).map((e) => e.meta.id);
  assert.deepEqual(orden, ['diciembre', 'marzo', 'sin-fecha', 'lista']);
});
