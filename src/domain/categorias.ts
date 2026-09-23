import type { Categoria } from './finanzas';

const normalizar = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Devuelve el problema con el nombre, o null si se puede guardar. */
export function validarNombreCategoria(nombre: string, existentes: Pick<Categoria, 'id' | 'nombre'>[], idActual?: string): string | null {
  const limpio = normalizar(nombre);
  if (!limpio) return 'Escribe un nombre.';
  if (limpio.length > 40) return 'Usa un nombre de 40 caracteres o menos.';
  if (existentes.some((c) => c.id !== idActual && normalizar(c.nombre) === limpio)) return 'Ya tienes una categoría con ese nombre.';
  return null;
}

/**
 * Mueve una categoría un lugar arriba (-1) o abajo (+1) dentro de su tipo.
 * Devuelve los nuevos `orden` que cambiaron (vacío si ya está en el extremo).
 */
export function moverCategoria(categorias: Categoria[], id: string, direccion: -1 | 1): Array<{ id: string; orden: number }> {
  const actual = categorias.find((c) => c.id === id);
  if (!actual) return [];
  const delTipo = categorias.filter((c) => c.tipo === actual.tipo).sort((a, b) => a.orden - b.orden);
  const i = delTipo.findIndex((c) => c.id === id);
  const j = i + direccion;
  if (j < 0 || j >= delTipo.length) return [];
  [delTipo[i], delTipo[j]] = [delTipo[j], delTipo[i]];
  // Reenumera todo el tipo por si había órdenes repetidos.
  const base = Math.min(...delTipo.map((c) => c.orden));
  return delTipo
    .map((c, k) => ({ id: c.id, orden: base + k, antes: c.orden }))
    .filter((c) => c.orden !== c.antes)
    .map(({ id, orden }) => ({ id, orden }));
}

export const siguienteOrden = (categorias: Pick<Categoria, 'orden'>[]) => Math.max(0, ...categorias.map((c) => c.orden)) + 1;

// ─── Ícono y color ───────────────────────────────────────────

/**
 * Paleta categórica validada (skill dataviz, orden fijo): pasa separación para daltonismo y visión normal
 * entre vecinos. Sin rojo ni amarillo: en la app significan presupuesto al límite. Con 6 colores
 * no se distinguen todos los pares entre sí, así que el color nunca va solo: siempre con emoji y nombre.
 */
export const PALETA_CATEGORIAS = ['#2A78D6', '#EB6834', '#1BAF7A', '#E87BA4', '#008300', '#4A3AA7'] as const;

/** Neutro para categorías sin color y para «Otras». */
export const GRIS_CATEGORIA = '#8A948F';

export const ICONOS_CATEGORIAS = [
  '🏠', '🍽️', '🛒', '☕', '🚗', '⛽', '🚌', '✈️',
  '💡', '📱', '🩺', '💊', '🏋️', '💇', '🎬', '🎮',
  '🛍️', '👕', '🎁', '🐾', '👶', '📚', '🔧', '📦',
  '💳', '🏦', '💼', '💰', '📈', '✨',
] as const;

/** Lo que se dibuja para una categoría: su emoji o, si no tiene, la inicial del nombre. */
export function aparienciaCategoria(c: Pick<Categoria, 'nombre' | 'icono' | 'color'>) {
  const icono = c.icono?.trim();
  return {
    simbolo: icono || (c.nombre.trim()[0] ?? '?').toLocaleUpperCase('es-MX'),
    esEmoji: !!icono,
    color: c.color ?? GRIS_CATEGORIA,
  };
}

/** Para una categoría nueva: el color de la paleta que menos se repite entre las de su tipo. */
export function colorSugerido(categorias: Pick<Categoria, 'tipo' | 'color'>[], tipo: Categoria['tipo']): string {
  const usos = new Map<string, number>(PALETA_CATEGORIAS.map((c) => [c, 0]));
  for (const c of categorias) if (c.tipo === tipo && c.color && usos.has(c.color)) usos.set(c.color, usos.get(c.color)! + 1);
  // En empate gana el primero de la paleta, así el resultado es estable.
  return PALETA_CATEGORIAS.reduce((mejor, c) => (usos.get(c)! < usos.get(mejor)! ? c : mejor));
}
