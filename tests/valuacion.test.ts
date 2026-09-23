import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerCotizacionYahoo, monedaPorTicker, precioEnPesos, simbolosYahoo, valuarPosiciones } from '../src/domain/valuacion.ts';
import type { Operacion, Posicion } from '../src/domain/finanzas.ts';

test('símbolos de Yahoo según la moneda de compra', () => {
  assert.deepEqual(simbolosYahoo('walmex*', 'MXN'), ['WALMEX.MX', 'WALMEX']);
  assert.deepEqual(simbolosYahoo('AAPL', 'USD'), ['AAPL', 'AAPL.MX']);
});

test('quita el sufijo de mercado de la app, que Yahoo no conoce', () => {
  assert.deepEqual(simbolosYahoo('WALMEX-MX', 'MXN'), ['WALMEX.MX']);
  assert.deepEqual(simbolosYahoo('walmex*-mx', 'MXN'), ['WALMEX.MX']);
  assert.deepEqual(simbolosYahoo('VOO-US', 'USD'), ['VOO', 'VOO.MX']);
  assert.deepEqual(simbolosYahoo('VOO-US', 'MXN'), ['VOO.MX', 'VOO']); // comprado en el SIC
  assert.deepEqual(simbolosYahoo('BRK-B', 'USD'), ['BRK-B', 'BRK-B.MX'], 'un guion que no es de mercado se queda');
});

test('lee la respuesta real de /v8/finance/chart', () => {
  const ok = { chart: { result: [{ meta: { symbol: 'WALMEX.MX', currency: 'MXN', regularMarketPrice: 45.9, regularMarketTime: 1790190613 } }], error: null } };
  assert.deepEqual(leerCotizacionYahoo(ok), { simbolo: 'WALMEX.MX', precio: 45.9, moneda: 'MXN', hora: 1790190613 });
  const noExiste = { chart: { result: null, error: { code: 'Not Found', description: 'No data found' } } };
  assert.equal(leerCotizacionYahoo(noExiste), null);
  assert.equal(leerCotizacionYahoo(null), null);
});

test('convierte USD con el tipo de cambio', () => {
  const c = { simbolo: 'AAPL', precio: 100, moneda: 'USD', hora: 0 };
  assert.equal(precioEnPesos(c, 17.5), 1750);
  assert.equal(precioEnPesos(c, null), null);
  assert.equal(precioEnPesos({ ...c, moneda: 'EUR' }, 17.5), null);
});

test('la moneda del ticker es la de su última operación', () => {
  const op = (fecha: string, moneda: 'MXN' | 'USD'): Operacion => ({
    id: fecha, fecha, ticker: 'AAPL', tipo: 'Compra', cantidad: 1, precio: 1, comision: 0, moneda, tipo_cambio: moneda === 'USD' ? 17 : null, notas: null,
  });
  assert.equal(monedaPorTicker([op('2026-03-01', 'MXN'), op('2026-01-01', 'USD')]).get('AAPL'), 'MXN');
});

test('valúa la cartera y reporta los tickers sin precio', () => {
  const posiciones: Posicion[] = [
    { ticker: 'AAPL', titulos: 2, costo: 3618, costoMedio: 1809, gananciaRealizada: 0 },
    { ticker: 'RARO', titulos: 5, costo: 500, costoMedio: 100, gananciaRealizada: 0 },
    { ticker: 'VENDIDA', titulos: 0, costo: 0, costoMedio: 0, gananciaRealizada: 50 },
  ];
  const r = valuarPosiciones(posiciones, new Map([['AAPL', 2000], ['RARO', null]]));
  assert.equal(r.valor, 4000);
  assert.equal(r.gananciaNoRealizada, 382);
  assert.deepEqual(r.sinPrecio, ['RARO']);
  const aapl = r.posiciones.find((p) => p.ticker === 'AAPL')!;
  assert.equal(aapl.gananciaNoRealizada, 382);
  assert.ok(Math.abs(aapl.rendimiento! - 382 / 3618) < 1e-12);
});
