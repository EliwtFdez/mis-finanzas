import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCartera, resumenMes, resumenAnual, type Operacion, type Categoria, type Movimiento } from '../src/domain/finanzas.ts';

const op = (o: Partial<Operacion> & Pick<Operacion, 'fecha' | 'tipo' | 'cantidad' | 'precio'>): Operacion => ({
  id: Math.random().toString(36),
  ticker: 'ABC-US',
  comision: 0,
  moneda: 'USD',
  tipo_cambio: 18,
  notas: null,
  ...o,
});

test('ejemplo de la hoja Guía: costo 3,618 y ganancia 171 MXN', () => {
  const r = calcularCartera([
    op({ fecha: '2026-01-10', tipo: 'Compra', cantidad: 2, precio: 100, comision: 1 }),
  ]);
  assert.equal(r.costoTotal, 3618);

  const r2 = calcularCartera([
    op({ fecha: '2026-01-10', tipo: 'Compra', cantidad: 2, precio: 100, comision: 1 }),
    op({ fecha: '2026-02-10', tipo: 'Venta', cantidad: 1, precio: 110 }),
  ]);
  assert.equal(r2.gananciaTotal, 171);
  assert.equal(r2.posiciones[0].titulos, 1);
  assert.equal(r2.posiciones[0].costo, 1809);
});

test('el orden de captura no importa: se ordena por fecha', () => {
  const r = calcularCartera([
    op({ fecha: '2026-02-10', tipo: 'Venta', cantidad: 1, precio: 110 }),
    op({ fecha: '2026-01-10', tipo: 'Compra', cantidad: 2, precio: 100, comision: 1 }),
  ]);
  assert.equal(r.gananciaTotal, 171);
  assert.ok(r.operaciones.every((o) => o.estado === 'OK'));
});

test('venta mayor al saldo queda marcada y fuera del cálculo', () => {
  const r = calcularCartera([
    op({ fecha: '2026-01-10', tipo: 'Compra', cantidad: 1, precio: 50, moneda: 'MXN', tipo_cambio: null }),
    op({ fecha: '2026-01-11', tipo: 'Venta', cantidad: 3, precio: 60, moneda: 'MXN', tipo_cambio: null }),
  ]);
  assert.equal(r.operaciones[1].estado, 'Venta excede saldo');
  assert.equal(r.posiciones[0].titulos, 1);
  assert.equal(r.gananciaTotal, 0);
});

test('costo promedio con compras a distinto precio y tipo de cambio', () => {
  const r = calcularCartera([
    op({ fecha: '2026-01-01', tipo: 'Compra', cantidad: 10, precio: 10, tipo_cambio: 17 }), // 1,700
    op({ fecha: '2026-03-01', tipo: 'Compra', cantidad: 10, precio: 20, tipo_cambio: 19 }), // 3,800
    op({ fecha: '2026-04-01', tipo: 'Venta', cantidad: 20, precio: 15, comision: 2, tipo_cambio: 20 }), // 5,960
  ]);
  assert.equal(r.gananciaTotal, 460); // 5,960 − 5,500
  assert.equal(r.posiciones[0].titulos, 0);
  assert.equal(r.posiciones[0].costo, 0);
});

test('resumen de septiembre con presupuesto total y por categoría', () => {
  const categorias: Categoria[] = [
    { id: 'c1', nombre: 'Transporte', tipo: 'Gasto', orden: 1 },
    { id: 'c2', nombre: 'Servicios', tipo: 'Gasto', orden: 2 },
    { id: 'c3', nombre: 'Sueldo', tipo: 'Ingreso', orden: 3 },
  ];
  const mov = (m: Partial<Movimiento>): Movimiento => ({
    id: 'x', fecha: '2026-09-21', tipo: 'Gasto', categoria_id: 'c1', descripcion: null,
    importe: 0, medio_pago: null, cuenta: null, notas: null, ...m,
  });
  const movimientos = [
    mov({ categoria_id: 'c1', importe: 280 }),
    mov({ categoria_id: 'c2', importe: 350 }),
    mov({ tipo: 'Ingreso', categoria_id: 'c3', importe: 14800 }),
    mov({ fecha: '2026-08-30', categoria_id: 'c1', importe: 999 }),
  ];
  const r = resumenMes({
    anio: 2026, mes: 9, movimientos, categorias, operaciones: [],
    presupuestos: [
      { anio: 2026, mes: 9, categoria_id: null, monto: 15800 },
      { anio: 2026, mes: 9, categoria_id: 'c1', monto: 600 },
    ],
  });
  assert.equal(r.gastos, 630);
  assert.equal(r.ingresos, 14800);
  assert.equal(r.presupuestoRestante, 15170);
  assert.deepEqual(r.porCategoria.map((l) => [l.categoria.nombre, l.gastado, l.presupuesto]), [
    ['Transporte', 280, 600],
    ['Servicios', 350, null],
  ]);
  assert.equal(resumenAnual(2026, movimientos)[7].gastos, 999);
});
