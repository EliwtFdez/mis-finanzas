import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorComercio } from '../src/domain/revision.ts';
import type { Movimiento } from '../src/domain/finanzas.ts';

const m = (id: string, descripcion: string | null, importe: number): Movimiento => ({
  id, fecha: '2026-09-01', tipo: 'Gasto', categoria_id: 'otros', descripcion, importe, medio_pago: null, cuenta: null, notas: null, por_revisar: true,
});

test('agrupa pagos del mismo comercio sin importar mayúsculas, acentos ni espacios', () => {
  const grupos = agruparPorComercio([
    m('1', 'Café Punta', 45),
    m('2', 'OXXO', 29),
    m('3', 'cafe  punta', 55.1),
    m('4', null, 10),
  ]);
  assert.deepEqual(grupos.map((g) => [g.descripcion, g.movimientos.map((x) => x.id), g.total]), [
    ['Café Punta', ['1', '3'], 100.1],
    ['OXXO', ['2'], 29],
    ['Sin descripción', ['4'], 10],
  ]);
});
