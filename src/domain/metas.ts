// Metas de ahorro: cuánto llevas, cuánto falta y cuánto apartar al mes para llegar a tiempo.
import type { Aportacion, MetaAhorro } from './finanzas';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface EstadoMeta {
  meta: MetaAhorro;
  ahorrado: number;
  falta: number;
  /** 0 a 1, para la barra. */
  proporcion: number;
  completada: boolean;
  /** La fecha límite ya pasó y falta dinero. */
  vencida: boolean;
  /** Meses para apartar, contando el actual; null sin fecha límite o si ya venció. */
  mesesRestantes: number | null;
  /** Cuánto apartar cada mes para llegar a tiempo; null si no aplica. */
  alMes: number | null;
}

/** Meses de `hoy` a `limite`, ambos incluidos (septiembre a diciembre = 4). */
export function mesesHasta(hoy: string, limite: string): number {
  const [ah, mh] = hoy.split('-').map(Number);
  const [al, ml] = limite.split('-').map(Number);
  return (al - ah) * 12 + (ml - mh) + 1;
}

export function estadoMeta(meta: MetaAhorro, aportaciones: Pick<Aportacion, 'meta_id' | 'importe'>[], hoy: string): EstadoMeta {
  const ahorrado = r2(aportaciones.filter((a) => a.meta_id === meta.id).reduce((s, a) => s + a.importe, 0));
  const falta = r2(Math.max(0, meta.objetivo - ahorrado));
  const completada = falta === 0;
  const vencida = !completada && !!meta.fecha_limite && meta.fecha_limite < hoy;
  const mesesRestantes = !completada && !vencida && meta.fecha_limite ? Math.max(1, mesesHasta(hoy, meta.fecha_limite)) : null;
  return {
    meta,
    ahorrado,
    falta,
    proporcion: Math.min(1, Math.max(0, ahorrado / meta.objetivo)),
    completada,
    vencida,
    mesesRestantes,
    alMes: mesesRestantes ? r2(falta / mesesRestantes) : null,
  };
}

/** Pendientes primero (la fecha más cercana arriba, las sin fecha al final) y luego las completadas. */
export function estadoMetas(metas: MetaAhorro[], aportaciones: Pick<Aportacion, 'meta_id' | 'importe'>[], hoy: string): EstadoMeta[] {
  return metas
    .map((m) => estadoMeta(m, aportaciones, hoy))
    .sort(
      (a, b) =>
        Number(a.completada) - Number(b.completada) ||
        (a.meta.fecha_limite ?? '9999').localeCompare(b.meta.fecha_limite ?? '9999') ||
        a.meta.nombre.localeCompare(b.meta.nombre, 'es'),
    );
}

export const ICONOS_METAS = ['🛟', '✈️', '🏖️', '🏠', '🚗', '💻', '📱', '🎓', '💍', '👶', '🐾', '🎁', '💰'];
