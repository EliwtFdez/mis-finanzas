import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarMovimientos } from '../src/domain/busqueda.ts';
import type { Movimiento } from '../src/domain/finanzas.ts';

const base = { tipo: 'Gasto' as const, medio_pago: null, cuenta: null, notas: null };
const movimientos: Movimiento[] = [
  { ...base, id: '1', fecha: '2026-09-01', categoria_id: 'com', descripcion: 'OXXO Madero', importe: 29 },
  { ...base, id: '2', fecha: '2026-09-02', categoria_id: 'sal', descripcion: 'Farmacia del Ahorro', importe: 450.9, cuenta: 'BBVA Azul' },
  { ...base, id: '3', fecha: '2026-09-03', categoria_id: 'com', descripcion: null, importe: 1250.5, notas: 'Súper de la quincena' },
];
const nombres: Record<string, string> = { com: 'Comida', sal: 'Salud' };
const buscar = (q: string) => buscarMovimientos(movimientos, q, (id) => nombres[id] ?? '').map((m) => m.id);

test('sin consulta devuelve todo', () => {
  assert.deepEqual(buscar('  '), ['1', '2', '3']);
});

test('busca en descripción, categoría, cuenta y notas sin importar acentos ni mayúsculas', () => {
  assert.deepEqual(buscar('oxxo'), ['1']);
  assert.deepEqual(buscar('comida'), ['1', '3']);
  assert.deepEqual(buscar('bbva'), ['2']);
  assert.deepEqual(buscar('super'), ['3']);
  assert.deepEqual(buscar('FARMACIA ahorro'), ['2'], 'todas las palabras deben coincidir');
  assert.deepEqual(buscar('farmacia oxxo'), []);
});

test('busca por monto exacto, con formato o por la parte entera', () => {
  assert.deepEqual(buscar('29'), ['1']);
  assert.deepEqual(buscar('450'), ['2']);
  assert.deepEqual(buscar('$1,250.50'), ['3']);
  assert.deepEqual(buscar('comida 1250'), ['3']);
});
