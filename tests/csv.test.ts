import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aCsv, movimientosACsv, operacionesACsv } from '../src/domain/csv.ts';

test('escapa comillas, comas y saltos de línea; vacíos para null', () => {
  const csv = aCsv(['A', 'B', 'C'], [['Súper, "La Esquina"', null, 12.5], ['línea\nnueva', undefined, 0]]);
  assert.equal(csv, '﻿A,B,C\r\n"Súper, ""La Esquina""",,12.5\r\n"línea\nnueva",,0\r\n');
});

test('neutraliza texto que Excel ejecutaría como fórmula, pero no los números negativos', () => {
  const csv = aCsv(['X'], [['=HYPERLINK("x")'], ['-10'], ['@SUM(A1)'], [-10]]);
  assert.equal(csv.split('\r\n').slice(1, 5).join('|'), `"'=HYPERLINK(""x"")"|'-10|'@SUM(A1)|-10`);
});

test('movimientos ordenados por fecha y con nombre de categoría', () => {
  const base = { medio_pago: null, cuenta: null, notas: null } as const;
  const csv = movimientosACsv(
    [
      { ...base, id: '2', fecha: '2026-09-02', tipo: 'Gasto', categoria_id: 'c', descripcion: 'OXXO', importe: 29 },
      { ...base, id: '1', fecha: '2026-09-01', tipo: 'Ingreso', categoria_id: 's', descripcion: null, importe: 20000, cuenta: 'Nómina' },
    ],
    (id) => ({ c: 'Comida', s: 'Sueldo' })[id] ?? '',
  );
  assert.deepEqual(csv.trim().split('\r\n').slice(1), ['2026-09-01,Ingreso,Sueldo,,20000,,Nómina,', '2026-09-02,Gasto,Comida,OXXO,29,,,']);
});

test('operaciones con tipo de cambio', () => {
  const csv = operacionesACsv([
    { id: '1', fecha: '2026-01-10', ticker: 'AAPL', tipo: 'Compra', cantidad: 2, precio: 100, comision: 9, moneda: 'USD', tipo_cambio: 18, notas: null },
  ]);
  assert.equal(csv.trim().split('\r\n')[1], '2026-01-10,AAPL,Compra,2,100,9,USD,18,');
});
