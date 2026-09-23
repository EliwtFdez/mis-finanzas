import { test } from 'node:test';
import assert from 'node:assert/strict';
import { netoDividendoMXN, resumenDividendos, resumenMes, type Dividendo } from '../src/domain/finanzas.ts';
import { dividendosACsv } from '../src/domain/csv.ts';

const div = (d: Partial<Dividendo> & Pick<Dividendo, 'fecha' | 'ticker' | 'importe'>): Dividendo => ({
  id: Math.random().toString(36),
  retencion: 0,
  moneda: 'MXN',
  tipo_cambio: null,
  notas: null,
  ...d,
});

test('neto en pesos: bruto menos retención, por el tipo de cambio si es en dólares', () => {
  assert.equal(netoDividendoMXN(div({ fecha: '2026-06-10', ticker: 'WALMEX-MX', importe: 120.5 })), 120.5);
  assert.equal(netoDividendoMXN(div({ fecha: '2026-07-01', ticker: 'VOO-US', importe: 10, retencion: 1, moneda: 'USD', tipo_cambio: 18.5 })), 166.5);
  // 0.1 + 0.2 en dólares no deja centavos sueltos
  assert.equal(netoDividendoMXN(div({ fecha: '2026-07-01', ticker: 'X', importe: 0.3, retencion: 0.1, moneda: 'USD', tipo_cambio: 3 })), 0.6);
});

test('totales por ticker y del historial', () => {
  const r = resumenDividendos([
    div({ fecha: '2026-03-10', ticker: 'WALMEX-MX', importe: 100 }),
    div({ fecha: '2026-06-10', ticker: 'WALMEX-MX', importe: 120.5 }),
    div({ fecha: '2026-07-01', ticker: 'VOO-US', importe: 10, retencion: 1, moneda: 'USD', tipo_cambio: 18.5 }),
  ]);
  assert.equal(r.porTicker.get('WALMEX-MX'), 220.5);
  assert.equal(r.porTicker.get('VOO-US'), 166.5);
  assert.equal(r.total, 387);
  assert.deepEqual(resumenDividendos([]), { total: 0, porTicker: new Map() });
});

test('el resumen del mes suma solo los dividendos de ese mes', () => {
  const r = resumenMes({
    anio: 2026, mes: 7, movimientos: [], categorias: [], presupuestos: [], operaciones: [],
    dividendos: [
      div({ fecha: '2026-06-30', ticker: 'A', importe: 50 }),
      div({ fecha: '2026-07-01', ticker: 'VOO-US', importe: 10, retencion: 1, moneda: 'USD', tipo_cambio: 18.5 }),
      div({ fecha: '2026-07-15', ticker: 'B', importe: 20 }),
    ],
  });
  assert.equal(r.dividendos, 186.5);
  assert.equal(r.ingresos, 0, 'no se mezclan con los ingresos del presupuesto');
  assert.equal(resumenMes({ anio: 2026, mes: 7, movimientos: [], categorias: [], presupuestos: [], operaciones: [] }).dividendos, 0);
});

test('CSV de dividendos en orden de fecha', () => {
  const csv = dividendosACsv([
    div({ fecha: '2026-07-01', ticker: 'VOO-US', importe: 10, retencion: 1, moneda: 'USD', tipo_cambio: 18.5 }),
    div({ fecha: '2026-06-10', ticker: 'WALMEX-MX', importe: 120.5, notas: 'Ordinario, 2026' }),
  ]);
  assert.equal(
    csv,
    '﻿Fecha,Ticker,Importe bruto,Retención,Moneda,Tipo de cambio,Notas\r\n' +
      '2026-06-10,WALMEX-MX,120.5,0,MXN,,"Ordinario, 2026"\r\n' +
      '2026-07-01,VOO-US,10,1,USD,18.5,\r\n',
  );
});
