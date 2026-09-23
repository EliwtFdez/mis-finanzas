import { supabase } from './supabase';
import type { Aportacion, Categoria, Dividendo, MetaAhorro, Movimiento, Operacion, Presupuesto } from '@/domain/finanzas';
import type { CompraMsi } from '@/domain/msi';
import type { Recurrente } from '@/domain/recurrentes';
import { todasLasFilas } from '@/domain/paginas';

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
  if (msg.includes('retencion_menor_al_importe')) return 'La retención debe ser menor que el importe bruto.';
  if (msg.includes('metas_ahorro_objetivo_check')) return 'La meta debe ser mayor que cero.';
  if (msg.includes('metas_ahorro_nombre_check')) return 'Escribe un nombre de hasta 60 caracteres.';
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

/** Todas las filas de una consulta paginada, con el error traducido. */
const todas = <T,>(pagina: Parameters<typeof todasLasFilas<T>>[0]) => todasLasFilas(pagina).catch(lanzar);

// ─── Categorías ───────────────────────────────────────────────

/** Categorías activas; con `todas` también las ocultas (para mostrar nombres de movimientos viejos). */
export async function cargarCategorias({ todas = false } = {}): Promise<Categoria[]> {
  let consulta = supabase.from('categorias').select('id, nombre, tipo, orden, activa, icono, color').order('orden');
  if (!todas) consulta = consulta.eq('activa', true);
  const { data, error } = await consulta;
  if (error) lanzar(error);
  return data as Categoria[];
}

export async function crearCategoria(c: Pick<Categoria, 'nombre' | 'tipo' | 'orden' | 'icono' | 'color'>) {
  const { error } = await supabase.from('categorias').insert({ ...c, nombre: c.nombre.trim() });
  if (error) lanzar(error);
}

export async function actualizarCategoria(id: string, cambios: Partial<Pick<Categoria, 'nombre' | 'orden' | 'activa' | 'icono' | 'color'>>) {
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
  const filas = await todas((desde, hasta) =>
    supabase
      .from('movimientos')
      .select('*')
      .gte('fecha', `${anio}-01-01`)
      .lte('fecha', `${anio}-12-31`)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(desde, hasta),
  );
  return filas.map(aMovimiento);
}

/** Todos los movimientos de todos los años (para exportar). */
export async function cargarTodosLosMovimientos(): Promise<Movimiento[]> {
  const filas = await todas((desde, hasta) =>
    supabase.from('movimientos').select('*').order('fecha').order('created_at').order('id').range(desde, hasta),
  );
  return filas.map(aMovimiento);
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

/** Regresa el id del movimiento (el nuevo, si se creó). */
export async function guardarMovimiento(m: MovimientoNuevo, id?: string): Promise<string> {
  if (id) {
    const { error } = await supabase.from('movimientos').update({ ...m, por_revisar: false }).eq('id', id);
    if (error) lanzar(error);
    return id;
  }
  const { data, error } = await supabase.from('movimientos').insert(m).select('id').single();
  if (error) lanzar(error);
  return String(data.id);
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

// ─── Gastos por revisar (Apple Pay) ───────────────────────────

export async function cargarPorRevisar(): Promise<Movimiento[]> {
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .eq('por_revisar', true)
    .order('fecha', { ascending: false });
  if (error) lanzar(error);
  return (data ?? []).map(aMovimiento);
}

export async function contarPorRevisar(): Promise<number> {
  const { count, error } = await supabase.from('movimientos').select('id', { count: 'exact', head: true }).eq('por_revisar', true);
  if (error) lanzar(error);
  return count ?? 0;
}

/** Asigna la categoría (o la deja igual si es null) y quita la marca de pendiente. */
export async function marcarRevisados(ids: string[], categoria_id: string | null) {
  if (!ids.length) return;
  const cambios = categoria_id ? { categoria_id, por_revisar: false } : { por_revisar: false };
  const { error } = await supabase.from('movimientos').update(cambios).in('id', ids);
  if (error) lanzar(error);
}

// ─── Meses sin intereses ──────────────────────────────────────

export async function cargarComprasMsi(): Promise<CompraMsi[]> {
  const { data, error } = await supabase
    .from('compras_msi')
    .select('id, fecha, descripcion, importe_total, meses, categoria_id, cuenta, pagos:movimientos(fecha, importe)')
    .order('fecha', { ascending: false });
  if (error) lanzar(error);
  return (data ?? []).map((r) => ({
    ...(r as unknown as CompraMsi),
    importe_total: num(r.importe_total),
    pagos: ((r.pagos ?? []) as Array<{ fecha: string; importe: unknown }>).map((p) => ({ fecha: p.fecha, importe: num(p.importe) })),
  }));
}

/** Regresa el id de la primera mensualidad (la que cae en el mes de la compra). */
export async function crearCompraMsi(c: Omit<CompraMsi, 'id' | 'pagos'>): Promise<string | null> {
  const { data: compraId, error } = await supabase.rpc('crear_compra_msi', {
    p_fecha: c.fecha,
    p_descripcion: c.descripcion,
    p_importe_total: c.importe_total,
    p_meses: c.meses,
    p_categoria_id: c.categoria_id,
    p_cuenta: c.cuenta,
  });
  if (error) lanzar(error);
  const { data } = await supabase.from('movimientos').select('id').eq('compra_msi_id', compraId).eq('numero_pago', 1).maybeSingle();
  return data ? String(data.id) : null;
}

/** Borra la compra y todas sus mensualidades. */
export async function borrarCompraMsi(id: string) {
  const { error } = await supabase.from('compras_msi').delete().eq('id', id);
  if (error) lanzar(error);
}

// ─── Gastos e ingresos fijos ──────────────────────────────────

export async function cargarRecurrentes(): Promise<Recurrente[]> {
  const { data, error } = await supabase
    .from('recurrentes')
    .select('id, tipo, descripcion, importe, categoria_id, dia, medio_pago, cuenta, activo, desde, aplicado_hasta')
    .order('dia');
  if (error) lanzar(error);
  return (data ?? []).map((r) => ({ ...(r as Recurrente), importe: num(r.importe) }));
}

export type RecurrenteNuevo = Omit<Recurrente, 'id' | 'desde' | 'aplicado_hasta'>;

export async function guardarRecurrente(r: RecurrenteNuevo, id?: string) {
  const { error } = id
    ? await supabase.from('recurrentes').update(r).eq('id', id)
    : await supabase.from('recurrentes').insert(r);
  if (error) lanzar(error);
}

export async function borrarRecurrente(id: string) {
  const { error } = await supabase.from('recurrentes').delete().eq('id', id);
  if (error) lanzar(error);
}

/** Registra los fijos que ya vencieron. Devuelve cuántos movimientos creó (0 si falla: no bloquea la pantalla). */
export async function aplicarRecurrentes(): Promise<number> {
  const { data, error } = await supabase.rpc('aplicar_recurrentes');
  return error ? 0 : Number(data ?? 0);
}

/** Texto de la alerta si ese gasto cruzó el 80% o el 100% de un presupuesto del mes; si no, null. */
export async function alertaPresupuesto(movimientoId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('alerta_presupuesto', { movimiento: movimientoId });
  if (error) lanzar(error);
  return data ? String(data) : null;
}

// ─── Cuenta del usuario ──────────────────────────────────────

export interface ResumenDatosUsuario {
  movimientos: number;
  operaciones: number;
  presupuestos: number;
  dividendos: number;
  fijos: number;
  comprasMsi: number;
  metas: number;
}

/** Cantidades visibles para la sesión actual; RLS impide contar datos ajenos. */
export async function cargarResumenDatosUsuario(): Promise<ResumenDatosUsuario> {
  const contar = (tabla: string) => supabase.from(tabla).select('id', { count: 'exact', head: true });
  const tablas = ['movimientos', 'operaciones', 'presupuestos', 'dividendos', 'recurrentes', 'compras_msi', 'metas_ahorro'];
  const r = await Promise.all(tablas.map(contar));
  const error = r.find((x) => x.error)?.error;
  if (error) lanzar(error);
  const [movimientos, operaciones, presupuestos, dividendos, fijos, comprasMsi, metas] = r.map((x) => x.count ?? 0);
  return { movimientos, operaciones, presupuestos, dividendos, fijos, comprasMsi, metas };
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
  const filas = await todas((desde, hasta) =>
    supabase.from('operaciones').select('*').order('fecha').order('created_at').order('id').range(desde, hasta),
  );
  return filas.map(aOperacion);
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

// ─── Dividendos ───────────────────────────────────────────────

const aDividendo = (r: Record<string, unknown>): Dividendo => ({
  ...(r as unknown as Dividendo),
  importe: num(r.importe),
  retencion: num(r.retencion),
  tipo_cambio: numONull(r.tipo_cambio),
});

export async function cargarDividendos(): Promise<Dividendo[]> {
  const filas = await todas((desde, hasta) =>
    supabase.from('dividendos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }).order('id').range(desde, hasta),
  );
  return filas.map(aDividendo);
}

export type DividendoNuevo = Omit<Dividendo, 'id' | 'created_at'>;

export async function guardarDividendo(d: DividendoNuevo, id?: string) {
  const { error } = id ? await supabase.from('dividendos').update(d).eq('id', id) : await supabase.from('dividendos').insert(d);
  if (error) lanzar(error);
}

export async function borrarDividendo(id: string) {
  const { error } = await supabase.from('dividendos').delete().eq('id', id);
  if (error) lanzar(error);
}

// ─── Metas de ahorro ──────────────────────────────────────────

export async function cargarMetas(): Promise<{ metas: MetaAhorro[]; aportaciones: Aportacion[] }> {
  const [metas, aportaciones] = await Promise.all([
    supabase.from('metas_ahorro').select('id, nombre, objetivo, fecha_limite, icono, created_at').order('created_at'),
    supabase.from('aportaciones_meta').select('id, meta_id, fecha, importe, created_at').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
  ]);
  const error = metas.error ?? aportaciones.error;
  if (error) lanzar(error);
  return {
    metas: (metas.data ?? []).map((m) => ({ ...(m as MetaAhorro), objetivo: num(m.objetivo) })),
    aportaciones: (aportaciones.data ?? []).map((a) => ({ ...(a as Aportacion), importe: num(a.importe) })),
  };
}

export type MetaNueva = Omit<MetaAhorro, 'id' | 'created_at'>;

export async function guardarMeta(m: MetaNueva, id?: string) {
  const fila = { ...m, nombre: m.nombre.trim() };
  const { error } = id ? await supabase.from('metas_ahorro').update(fila).eq('id', id) : await supabase.from('metas_ahorro').insert(fila);
  if (error) lanzar(error);
}

export async function borrarMeta(id: string) {
  const { error } = await supabase.from('metas_ahorro').delete().eq('id', id);
  if (error) lanzar(error);
}

/** `importe` negativo = retiro. */
export async function aportarAMeta(meta_id: string, importe: number, fecha: string) {
  const { error } = await supabase.from('aportaciones_meta').insert({ meta_id, importe, fecha });
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
