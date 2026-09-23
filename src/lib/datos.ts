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
  if (msg.includes('categorias_nombre_unico')) return 'Ya tienes una categoría con ese nombre.';
  if (msg.includes('movimientos_categoria_id_fkey')) return 'Esta categoría tiene movimientos. Ocúltala en lugar de borrarla.';
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo antes de entrar.';
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  return msg;
}

function lanzar(error: unknown): never {
  throw new Error(mensajeError(error));
}

// ─── Categorías ───────────────────────────────────────────────

/** Categorías activas; con `todas` también las ocultas (para mostrar nombres de movimientos viejos). */
export async function cargarCategorias({ todas = false } = {}): Promise<Categoria[]> {
  let consulta = supabase.from('categorias').select('id, nombre, tipo, orden, activa').order('orden');
  if (!todas) consulta = consulta.eq('activa', true);
  const { data, error } = await consulta;
  if (error) lanzar(error);
  return data as Categoria[];
}

export async function crearCategoria(c: Pick<Categoria, 'nombre' | 'tipo' | 'orden'>) {
  const { error } = await supabase.from('categorias').insert({ ...c, nombre: c.nombre.trim() });
  if (error) lanzar(error);
}

export async function actualizarCategoria(id: string, cambios: Partial<Pick<Categoria, 'nombre' | 'orden' | 'activa'>>) {
  const { error } = await supabase
    .from('categorias')
    .update(cambios.nombre === undefined ? cambios : { ...cambios, nombre: cambios.nombre.trim() })
    .eq('id', id);
  if (error) lanzar(error);
}

export async function borrarCategoria(id: string) {
  const { error } = await supabase.from('categorias').delete().eq('id', id);
  if (error) lanzar(error);
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

/** Guarda una importación completa en una sola operación: o entra todo o no entra nada. */
export async function guardarMovimientos(movimientos: MovimientoNuevo[]) {
  if (!movimientos.length) return;
  const { error } = await supabase.from('movimientos').insert(movimientos);
  if (error) lanzar(error);
}

export async function borrarMovimiento(id: string) {
  const { error } = await supabase.from('movimientos').delete().eq('id', id);
  if (error) lanzar(error);
}

// ─── Cuenta del usuario ──────────────────────────────────────

export interface ResumenDatosUsuario {
  movimientos: number;
  operaciones: number;
  presupuestos: number;
}

/** Cantidades visibles para la sesión actual; RLS impide contar datos ajenos. */
export async function cargarResumenDatosUsuario(): Promise<ResumenDatosUsuario> {
  const [movimientos, operaciones, presupuestos] = await Promise.all([
    supabase.from('movimientos').select('id', { count: 'exact', head: true }),
    supabase.from('operaciones').select('id', { count: 'exact', head: true }),
    supabase.from('presupuestos').select('id', { count: 'exact', head: true }),
  ]);
  const error = movimientos.error ?? operaciones.error ?? presupuestos.error;
  if (error) lanzar(error);
  return {
    movimientos: movimientos.count ?? 0,
    operaciones: operaciones.count ?? 0,
    presupuestos: presupuestos.count ?? 0,
  };
}

export interface Perfil {
  nombre: string;
  edad: number | null;
  ocupacion: string;
}

/** Lee el perfil de los metadatos del usuario (nombre puede venir de un registro previo como `name`). */
export function perfilDe(metadatos: Record<string, unknown> | undefined): Perfil {
  const m = metadatos ?? {};
  const edad = Number(m.edad);
  return {
    nombre: String(m.full_name ?? m.name ?? ''),
    edad: m.edad !== null && m.edad !== undefined && Number.isInteger(edad) ? edad : null,
    ocupacion: String(m.ocupacion ?? ''),
  };
}

/** Guarda el perfil en los metadatos de la cuenta; la sesión se actualiza sola. */
export async function guardarPerfil(p: Perfil) {
  const { error } = await supabase.auth.updateUser({
    data: { full_name: p.nombre.trim() || null, edad: p.edad, ocupacion: p.ocupacion.trim() || null },
  });
  if (error) lanzar(error);
}

// ─── Atajos de iPhone (Apple Pay) ─────────────────────────────

export interface EstadoAtajos {
  created_at: string;
  ultimo_uso: string | null;
}

export async function cargarEstadoAtajos(): Promise<EstadoAtajos | null> {
  const { data, error } = await supabase.from('tokens_atajo').select('created_at, ultimo_uso').maybeSingle();
  if (error) lanzar(error);
  return data;
}

/** Crea un código nuevo (el anterior deja de funcionar). Solo se puede ver esta vez. */
export async function generarCodigoAtajos(): Promise<string> {
  const { data, error } = await supabase.rpc('generar_token_atajo');
  if (error) lanzar(error);
  return data as string;
}

export async function desconectarAtajos(userId: string) {
  const { error } = await supabase.from('tokens_atajo').delete().eq('user_id', userId);
  if (error) lanzar(error);
}

/** Borra todos los datos financieros de la sesión en una sola transacción. */
export async function borrarTodosMisDatos() {
  const { error } = await supabase.rpc('borrar_todos_mis_datos');
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
