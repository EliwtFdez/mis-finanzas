import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarioMsi, estadoMsi, type CompraMsi } from '../src/domain/msi.ts';

test('mismo reparto y fechas que la función SQL crear_compra_msi', () => {
  assert.deepEqual(calendarioMsi('2026-01-31', 1000, 3), [
    { numero: 1, fecha: '2026-01-31', importe: 333.33 },
    { numero: 2, fecha: '2026-02-28', importe: 333.33 },
    { numero: 3, fecha: '2026-03-31', importe: 333.34 },
  ]);
});

test('cruza de año y la suma siempre es el total exacto', () => {
  const pagos = calendarioMsi('2026-11-15', 12345.67, 12);
  assert.equal(pagos[1].fecha, '2026-12-15');
  assert.equal(pagos[2].fecha, '2027-01-15');
  assert.equal(pagos.at(-1)!.fecha, '2027-10-15');
  const suma = Math.round(pagos.reduce((s, p) => s + p.importe, 0) * 100) / 100;
  assert.equal(suma, 12345.67);
  assert.ok(pagos.slice(0, -1).every((p) => p.importe === 1028.8));
});

test('estado: pagados, restantes y totales del mes', () => {
  const compra = (id: string, fecha: string, total: number, meses: number): CompraMsi => ({
    id, fecha, descripcion: id, importe_total: total, meses, categoria_id: 'c', cuenta: null,
    pagos: calendarioMsi(fecha, total, meses).map(({ fecha, importe }) => ({ fecha, importe })),
  });
  const r = estadoMsi([compra('tele', '2026-07-10', 600, 6), compra('vieja', '2025-01-05', 300, 3)], '2026-09-20');
  assert.deepEqual(r.estados.map((e) => [e.compra.id, e.pagados, e.restantes, e.montoRestante, e.terminada]), [
    ['tele', 3, 3, 300, false],
    ['vieja', 3, 0, 0, true],
  ]);
  assert.equal(r.esteMes, 100);
  assert.equal(r.deudaRestante, 300);
  assert.equal(r.activas, 1);
});
