import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCartera, resumenMes, resumenAnual, type Operacion, type Categoria, type Movimiento } from '../src/domain/finanzas.ts';
import { emparejarAutomaticos, esDuplicado, extraerGastosDeTexto, NOTA_APPLE_PAY } from '../src/domain/estadoCuenta.ts';
import { reconstruirTextoPdf } from '../src/domain/textoPdf.ts';

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

test('extrae, categoriza y ordena gastos de un estado de cuenta', () => {
  const categorias: Categoria[] = [
    { id: 'comida', nombre: 'Comida', tipo: 'Gasto', orden: 1 },
    { id: 'salud', nombre: 'Salud', tipo: 'Gasto', orden: 2 },
    { id: 'otros', nombre: 'Otros', tipo: 'Gasto', orden: 3 },
  ];
  const gastos = extraerGastosDeTexto(`
    FECHA DESCRIPCIÓN CARGO SALDO
    20/09 FARMACIA DEL AHORRO $450.00 $2,100.00
    19/09 SUPERMERCADO LA ESQUINA 1,250.50 2,550.00
    18/09 DEPÓSITO NÓMINA $8,000.00 $3,800.50
    17/09 SALDO ANTERIOR $9,999.00
  `, categorias, 2026);
  assert.equal(gastos.length, 2);
  assert.deepEqual(gastos.map((g) => [g.descripcion, g.importe, g.categoria_id]), [
    ['SUPERMERCADO LA ESQUINA', 1250.5, 'comida'],
    ['FARMACIA DEL AHORRO', 450, 'salud'],
  ]);
});

test('detecta duplicados exactos sin depender de acentos o mayúsculas', () => {
  assert.equal(esDuplicado(
    { fecha: '2026-09-20', importe: 450, descripcion: 'Farmacia México' },
    [{ fecha: '2026-09-20', importe: 450, descripcion: 'FARMACIA MEXICO' }],
  ), true);
});

test('entiende movimientos de tarjeta BBVA con dos fechas y excluye pagos', () => {
  const categorias: Categoria[] = [
    { id: 'comida', nombre: 'Comida', tipo: 'Gasto', orden: 1 },
    { id: 'salud', nombre: 'Salud', tipo: 'Gasto', orden: 2 },
    { id: 'otros', nombre: 'Otros', tipo: 'Gasto', orden: 3 },
  ];
  const gastos = extraerGastosDeTexto(`
    TARJETA DE CRÉDITO
    CARGOS, COMPRAS Y ABONOS REGULARES (NO A MESES)
    Fecha de la operación Fecha de cargo Descripción del movimiento Monto
    03-ago-2026 04-ago-2026 FARM SIMILARES SUC 123 + $450.00
    05-ago-2026 05-ago-2026 BMOVIL.PAGO TDC - $2,000.00
  `, categorias, 2026);
  assert.equal(gastos.length, 1);
  assert.equal(gastos[0].fecha, '2026-08-03');
  assert.equal(gastos[0].descripcion, 'FARM SIMILARES SUC 123');
  assert.equal(gastos[0].importe, 450);
  assert.equal(gastos[0].categoria_id, 'salud');
});

test('entiende cuenta de débito BBVA con fechas 07/AGO y columnas de saldos', () => {
  const categorias: Categoria[] = [
    { id: 'comida', nombre: 'Comida', tipo: 'Gasto', orden: 1 },
    { id: 'otros', nombre: 'Otros', tipo: 'Gasto', orden: 2 },
  ];
  const gastos = extraerGastosDeTexto(`
    Estado de Cuenta Libretón Básico Cuenta Digital
    FECHA OPER LIQ DESCRIPCION REFERENCIA CARGOS ABONOS SALDO
    07/AGO 07/AGO OXXO MADERO 29.00
    12/AGO 12/AGO DEPOSITO EFECTIVO PRACTIC 2,800.00
    14/AGO 14/AGO SPEI RECIBIDO BANORTE 5,600.00
    16/AGO 17/AGO PAGO CUENTA DE TERCERO 250.00 2,821.60 2,087.59
  `, categorias, 2026);
  assert.deepEqual(gastos.map((g) => [g.fecha, g.descripcion, g.importe, g.categoria_id]), [
    ['2026-08-07', 'OXXO MADERO', 29, 'comida'],
    ['2026-08-16', 'PAGO CUENTA DE TERCERO', 250, 'otros'],
  ]);
});

test('reconstruye una fila aunque los fragmentos caigan a ambos lados del redondeo', () => {
  const texto = reconstruirTextoPdf([[
    { str: '18/AGO', x: 10, y: 100.9 },
    { str: '18/AGO', x: 60, y: 99.2 },
    { str: 'SUBWAY48626', x: 120, y: 100.1 },
    { str: '158.00', x: 300, y: 99.5 },
  ]]);
  assert.equal(texto, '18/AGO 18/AGO SUBWAY48626 158.00');
});

test('marca importes en la columna ABONOS aunque la descripción parezca un pago', () => {
  const texto = reconstruirTextoPdf([[
    { str: 'CARGOS', x: 380, y: 200 },
    { str: 'ABONOS', x: 430, y: 200 },
    { str: '07/AGO', x: 10, y: 180 },
    { str: '07/AGO', x: 60, y: 180 },
    { str: 'PAGO CUENTA DE TERCERO', x: 110, y: 180 },
    { str: '400.00', x: 432, y: 180 },
  ]]);
  assert.match(texto, /PAGO CUENTA DE TERCERO 400\.00 \[ABONO\]/);
});

test('empareja cada gasto del PDF con un solo pago de Apple Pay por importe y fecha cercana', () => {
  const pares = emparejarAutomaticos(
    [
      { id: 'a', fecha: '2026-09-10', importe: 29 },
      { id: 'b', fecha: '2026-09-10', importe: 29 },
      { id: 'c', fecha: '2026-09-20', importe: 158 },
    ],
    [
      { id: 'ap1', fecha: '2026-09-09', importe: 29, notas: NOTA_APPLE_PAY },
      { id: 'manual', fecha: '2026-09-10', importe: 29, notas: null },
      { id: 'ap2', fecha: '2026-09-15', importe: 158, notas: NOTA_APPLE_PAY },
    ],
  );
  assert.deepEqual([...pares].map(([g, m]) => [g, m.id]), [['a', 'ap1']]);
});

test('también empareja fijos mensuales (Netflix) pero no movimientos capturados a mano', () => {
  const pares = emparejarAutomaticos(
    [{ id: 'pdf-netflix', fecha: '2026-09-29', importe: 219 }, { id: 'pdf-cafe', fecha: '2026-09-10', importe: 55 }],
    [
      { id: 'fijo', fecha: '2026-09-28', importe: 219, notas: null, recurrente_id: 'r1' },
      { id: 'manual', fecha: '2026-09-10', importe: 55, notas: null, recurrente_id: null },
    ],
  );
  assert.deepEqual([...pares].map(([g, m]) => [g, m.id]), [['pdf-netflix', 'fijo']]);
});
