import { supabase } from './supabase';
import type { Categoria, Movimiento, Operacion, Presupuesto } from '@/domain/finanzas';

// PostgREST devuelve numeric como número, pero lo normalizamos por si llega como texto.
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numONull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Convierte errores de Postgres en mensajes que se entienden. */
export function mensajeError(e: unknown): string {
  const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (msg.includes('importe_check')) return 'El importe debe ser mayor que cero.';
  if (msg.includes('tipo_cambio_segun_moneda')) return 'Para USD escribe el tipo de cambio de esa operación.';
  if (msg.includes('ticker_check')) return 'Escribe el ticker en mayúsculas y sin espacios.';
  if (msg.includes('cantidad_check')) return 'La cantidad debe ser mayor que cero.';
  if (msg.includes('precio_check')) return 'El precio debe ser mayor que cero.';
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo antes de entrar.';
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  return msg;
}

function lanzar(error: unknown): never {
  throw new Error(mensajeError(error));
}

// ─── Categorías ───────────────────────────────────────────────

export async function cargarCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nombre, tipo, orden')
    .eq('activa', true)
    .order('orden');
  if (error) lanzar(error);
  return data as Categoria[];
}

// ─── Movimientos ──────────────────────────────────────────────

const aMovimiento = (r: Record<string, unknown>): Movimiento => ({ ...(r as unknown as Movimiento), importe: num(r.importe) });

export async function cargarMovimientosDelAnio(anio: number): Promise<Movimiento[]> {
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .gte('fecha', `${anio}-01-01`)
    .lte('fecha', `${anio}-12-31`)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) lanzar(error);
  return (data ?? []).map(aMovimiento);
}

export async function cargarMovimiento(id: string): Promise<Movimiento> {
  const { data, error } = await supabase.from('movimientos').select('*').eq('id', id).single();
  if (error) lanzar(error);
  return aMovimiento(data);
}

export async function cuentasUsadas(): Promise<string[]> {
  const { data, error } = await supabase
    .from('movimientos')
    .select('cuenta')
    .not('cuenta', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return [];
  return [...new Set((data ?? []).map((r) => String(r.cuenta)).filter(Boolean))].slice(0, 6);
}

export type MovimientoNuevo = Omit<Movimiento, 'id' | 'created_at'>;

export async function guardarMovimiento(m: MovimientoNuevo, id?: string) {
  const { error } = id
    ? await supabase.from('movimientos').update(m).eq('id', id)
    : await supabase.from('movimientos').insert(m);
  if (error) lanzar(error);
}

export async function borrarMovimiento(id: string) {
  const { error } = await supabase.from('movimientos').delete().eq('id', id);
  if (error) lanzar(error);
}

// ─── Operaciones de acciones ──────────────────────────────────

const aOperacion = (r: Record<string, unknown>): Operacion => ({
  ...(r as unknown as Operacion),
  cantidad: num(r.cantidad),
  precio: num(r.precio),
  comision: num(r.comision),
  tipo_cambio: numONull(r.tipo_cambio),
});

export async function cargarOperaciones(): Promise<Operacion[]> {
  const { data, error } = await supabase
    .from('operaciones')
    .select('*')
    .order('fecha')
    .order('created_at');
  if (error) lanzar(error);
  return (data ?? []).map(aOperacion);
}

export type OperacionNueva = Omit<Operacion, 'id' | 'created_at'>;

export async function guardarOperacion(o: OperacionNueva, id?: string) {
  const { error } = id
    ? await supabase.from('operaciones').update(o).eq('id', id)
    : await supabase.from('operaciones').insert(o);
  if (error) lanzar(error);
}

export async function borrarOperacion(id: string) {
  const { error } = await supabase.from('operaciones').delete().eq('id', id);
  if (error) lanzar(error);
}

// ─── Presupuestos ─────────────────────────────────────────────

export async function cargarPresupuestos(anio: number, mes: number): Promise<Presupuesto[]> {
  const { data, error } = await supabase
    .from('presupuestos')
    .select('id, anio, mes, categoria_id, monto')
    .eq('anio', anio)
    .eq('mes', mes);
  if (error) lanzar(error);
  return (data ?? []).map((r) => ({ ...(r as Presupuesto), monto: num(r.monto) }));
}

/**
 * Deja los presupuestos del mes exactamente como vienen en `montos`
 * (clave '' = total del mes). Un monto vacío o 0 elimina ese presupuesto.
 */
export async function guardarPresupuestos(anio: number, mes: number, montos: Record<string, number | null>) {
  const actuales = await cargarPresupuestos(anio, mes);
  const porClave = new Map(actuales.map((p) => [p.categoria_id ?? '', p]));

  for (const [clave, monto] of Object.entries(montos)) {
    const existente = porClave.get(clave);
    const categoria_id = clave === '' ? null : clave;
    if (!monto || monto <= 0) {
      if (existente?.id) {
        const { error } = await supabase.from('presupuestos').delete().eq('id', existente.id);
        if (error) lanzar(error);
      }
    } else if (existente?.id) {
      if (existente.monto !== monto) {
        const { error } = await supabase.from('presupuestos').update({ monto }).eq('id', existente.id);
        if (error) lanzar(error);
      }
    } else {
      const { error } = await supabase.from('presupuestos').insert({ anio, mes, categoria_id, monto });
      if (error) lanzar(error);
    }
  }
}
