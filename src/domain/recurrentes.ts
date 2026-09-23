// Gastos e ingresos fijos. La fecha de cada mes debe coincidir con aplicar_recurrentes() en SQL.
import type { TipoMovimiento } from './finanzas';

export interface Recurrente {
  id: string;
  tipo: TipoMovimiento;
  descripcion: string;
  importe: number;
  categoria_id: string;
  dia: number;
  medio_pago: string | null;
  cuenta: string | null;
  activo: boolean;
  desde: string; // AAAA-MM-DD
  aplicado_hasta: string | null; // primer día del último mes registrado
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha del fijo en ese mes: el día indicado o el último día si el mes es más corto. */
export function fechaEnMes(anio: number, mes: number, dia: number): string {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${dos(mes)}-${dos(Math.min(dia, ultimo))}`;
}

/** Próxima fecha que todavía no se registra (puede ser hoy o antes si falta aplicar). */
export function proximaFecha(r: Pick<Recurrente, 'dia' | 'desde' | 'aplicado_hasta'>): string {
  let [anio, mes] = (r.aplicado_hasta ?? r.desde).split('-').map(Number);
  if (r.aplicado_hasta) mes += 1;
  for (let i = 0; i < 3; i++, mes++) {
    if (mes > 12) { mes -= 12; anio += 1; }
    const fecha = fechaEnMes(anio, mes, r.dia);
    if (fecha >= r.desde) return fecha;
  }
  throw new Error('Fecha imposible');
}

/** Fijos activos que faltan por llegar en el mes de `hoy`, en orden de fecha. */
export function proximosDelMes(recurrentes: Recurrente[], hoy: string) {
  const mes = hoy.slice(0, 7);
  return recurrentes
    .filter((r) => r.activo)
    .map((r) => ({ recurrente: r, fecha: proximaFecha(r) }))
    .filter((x) => x.fecha.startsWith(mes) && x.fecha > hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
