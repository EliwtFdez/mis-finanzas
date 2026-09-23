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
