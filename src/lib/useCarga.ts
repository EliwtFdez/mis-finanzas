import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Carga datos cada vez que la pantalla recibe el foco
 * (así, al volver de un formulario, la lista ya está actualizada).
 */
export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const turno = useRef(0);

  const recargar = useCallback(() => {
    const miTurno = ++turno.current;
    setCargando(true);
    cargar()
      .then((d) => {
        if (miTurno !== turno.current) return;
        setDatos(d);
        setError(null);
      })
      .catch((e: Error) => {
        if (miTurno === turno.current) setError(e.message);
      })
      .finally(() => {
        if (miTurno === turno.current) setCargando(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(recargar);

  return { datos, error, cargando, recargar };
}
