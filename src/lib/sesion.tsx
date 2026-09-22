import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface Contexto {
  sesion: Session | null;
  cargando: boolean;
}

const SesionContext = createContext<Contexto>({ sesion: null, cargando: true });

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva));
    return () => data.subscription.unsubscribe();
  }, []);

  return <SesionContext.Provider value={{ sesion, cargando }}>{children}</SesionContext.Provider>;
}

export const useSesion = () => useContext(SesionContext);
