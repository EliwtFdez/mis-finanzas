import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todasLasFilas } from '../src/domain/paginas.ts';

const servidor = (total: number) => {
  const pedidas: Array<[number, number]> = [];
  const pagina = async (desde: number, hasta: number) => {
    pedidas.push([desde, hasta]);
    const data = Array.from({ length: Math.max(0, Math.min(hasta, total - 1) - desde + 1) }, (_, i) => desde + i);
    return { data, error: null };
  };
  return { pagina, pedidas };
};

test('trae todas las páginas hasta una incompleta', async () => {
  const s = servidor(2500);
  const filas = await todasLasFilas(s.pagina);
  assert.equal(filas.length, 2500);
  assert.equal(filas.at(-1), 2499);
  assert.deepEqual(s.pedidas, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('con un múltiplo exacto pide una página vacía y termina', async () => {
  const s = servidor(2000);
  assert.equal((await todasLasFilas(s.pagina)).length, 2000);
  assert.equal(s.pedidas.length, 3);
});

test('propaga el error de una página', async () => {
  await assert.rejects(todasLasFilas(async () => ({ data: null, error: new Error('sin red') })), /sin red/);
});
