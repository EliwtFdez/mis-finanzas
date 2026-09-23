// Exportación a CSV que Excel abre bien en español (UTF-8 con BOM, coma como separador).
import type { Movimiento, Operacion } from './finanzas';

type Celda = string | number | null | undefined;

function celda(v: Celda): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  // Evita que Excel interprete texto como fórmula (=, +, -, @ al inicio).
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function aCsv(encabezados: string[], filas: Celda[][]): string {
  return '﻿' + [encabezados, ...filas].map((f) => f.map(celda).join(',')).join('\r\n') + '\r\n';
}

export function movimientosACsv(movimientos: Movimiento[], nombreCategoria: (id: string) => string): string {
  return aCsv(
    ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Importe', 'Medio de pago', 'Cuenta', 'Notas'],
    [...movimientos]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((m) => [m.fecha, m.tipo, nombreCategoria(m.categoria_id), m.descripcion, m.importe, m.medio_pago, m.cuenta, m.notas]),
  );
}

export function operacionesACsv(operaciones: Operacion[]): string {
  return aCsv(
    ['Fecha', 'Ticker', 'Tipo', 'Cantidad', 'Precio', 'Comisión', 'Moneda', 'Tipo de cambio', 'Notas'],
    [...operaciones]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((o) => [o.fecha, o.ticker, o.tipo, o.cantidad, o.precio, o.comision, o.moneda, o.tipo_cambio, o.notas]),
  );
}
