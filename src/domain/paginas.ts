/**
 * Supabase devuelve como máximo 1000 filas por consulta: pide páginas hasta traer todo.
 * La consulta debe tener un orden total (p. ej. terminar en .order('id')) para que las páginas no se crucen.
 * Si una página falla, lanza su error tal cual.
 */
export async function todasLasFilas<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  tamano = 1000,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await pagina(desde, desde + tamano - 1);
    if (error) throw error;
    filas.push(...(data ?? []));
    if (!data || data.length < tamano) return filas;
  }
}
