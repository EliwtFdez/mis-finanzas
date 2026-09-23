import type { Movimiento } from './finanzas';

export interface GrupoComercio<M extends Movimiento = Movimiento> {
  clave: string;
  descripcion: string;
  movimientos: M[];
  total: number;
}

const claveComercio = (d: string | null) => (d ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Agrupa pagos pendientes del mismo comercio para categorizarlos de una vez. Los más frecuentes primero. */
export function agruparPorComercio<M extends Movimiento>(movimientos: M[]): GrupoComercio<M>[] {
  const grupos = new Map<string, GrupoComercio<M>>();
  for (const m of movimientos) {
    const clave = claveComercio(m.descripcion);
    const g = grupos.get(clave) ?? { clave, descripcion: m.descripcion ?? 'Sin descripción', movimientos: [], total: 0 };
    g.movimientos.push(m);
    g.total = Math.round((g.total + m.importe) * 100) / 100;
    grupos.set(clave, g);
  }
  return [...grupos.values()].sort((a, b) => b.movimientos.length - a.movimientos.length || b.total - a.total);
}
