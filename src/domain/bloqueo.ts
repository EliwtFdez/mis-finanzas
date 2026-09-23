/** Tiempo en segundo plano tras el cual se vuelve a pedir Face ID / huella. */
export const GRACIA_BLOQUEO_MS = 30_000;

/**
 * ¿Hay que pedir autenticación al volver a la app?
 * `salida` es cuándo pasó a segundo plano (null = recién abierta).
 */
export function debeBloquear(activo: boolean, salida: number | null, ahora: number, gracia = GRACIA_BLOQUEO_MS): boolean {
  if (!activo) return false;
  if (salida === null) return true;
  return ahora - salida >= gracia;
}
