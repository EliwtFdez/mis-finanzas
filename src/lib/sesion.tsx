import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { claveSesion, supabase } from './supabase';

interface Contexto {
  sesion: Session | null;
  cargando: boolean;
}

const SesionContext = createContext<Contexto>({ sesion: null, cargando: true });

/** Sesión guardada en el dispositivo, aunque su token ya haya vencido. */
async function sesionGuardada(): Promise<Session | null> {
  try {
    const guardada = await AsyncStorage.getItem(claveSesion);
    return guardada ? (JSON.parse(guardada) as Session) : null;
  } catch {
    return null;
  }
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      let inicial = data.session;
      // Sin internet no se puede renovar un token vencido: seguimos con la sesión guardada
      // y Supabase la renovará sola en cuanto vuelva la conexión.
      if (!inicial && error && isAuthRetryableFetchError(error)) inicial = await sesionGuardada();
      if (activo) {
        setSesion(inicial);
        setCargando(false);
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      // La sesión inicial la resuelve getSession() arriba; solo un cierre explícito o
      // un token rechazado por el servidor sacan al usuario.
      if (evento === 'INITIAL_SESSION') return;
      setSesion(nueva);
    });

    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <SesionContext.Provider value={{ sesion, cargando }}>{children}</SesionContext.Provider>;
}

export const useSesion = () => useContext(SesionContext);
