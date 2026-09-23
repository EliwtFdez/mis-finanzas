import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaEnMes, proximaFecha, proximosDelMes, type Recurrente } from '../src/domain/recurrentes.ts';

const fijo = (parcial: Partial<Recurrente>): Recurrente => ({
  id: 'x', tipo: 'Gasto', descripcion: 'X', importe: 100, categoria_id: 'c', dia: 1, medio_pago: null, cuenta: null,
  activo: true, desde: '2026-06-15', aplicado_hasta: null, ...parcial,
});

test('el día se ajusta al fin de mes, igual que en SQL', () => {
  assert.equal(fechaEnMes(2026, 2, 31), '2026-02-28');
  assert.equal(fechaEnMes(2028, 2, 30), '2028-02-29');
  assert.equal(fechaEnMes(2026, 9, 15), '2026-09-15');
});

test('la primera fecha nunca es anterior a desde', () => {
  assert.equal(proximaFecha(fijo({ dia: 1 })), '2026-07-01');
  assert.equal(proximaFecha(fijo({ dia: 15 })), '2026-06-15');
  assert.equal(proximaFecha(fijo({ dia: 31 })), '2026-06-30');
});

test('después de aplicar sigue el mes siguiente, cruzando de año', () => {
  assert.equal(proximaFecha(fijo({ dia: 10, aplicado_hasta: '2026-09-01' })), '2026-10-10');
  assert.equal(proximaFecha(fijo({ dia: 31, aplicado_hasta: '2026-12-01' })), '2027-01-31');
});

test('próximos del mes: activos, después de hoy y en orden', () => {
  const lista = proximosDelMes(
    [
      fijo({ id: 'netflix', dia: 28, aplicado_hasta: '2026-08-01' }),
      fijo({ id: 'renta', dia: 1, aplicado_hasta: '2026-09-01' }),
      fijo({ id: 'gym', dia: 25, aplicado_hasta: '2026-08-01' }),
      fijo({ id: 'pausado', dia: 26, aplicado_hasta: '2026-08-01', activo: false }),
    ],
    '2026-09-20',
  );
  assert.deepEqual(lista.map((x) => [x.recurrente.id, x.fecha]), [
    ['gym', '2026-09-25'],
    ['netflix', '2026-09-28'],
  ]);
});
