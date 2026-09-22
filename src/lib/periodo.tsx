import { createContext, useContext, useState, type ReactNode } from 'react';

interface Contexto {
  anio: number;
  mes: number; // 1–12
  mover: (delta: number) => void;
}

const PeriodoContext = createContext<Contexto | null>(null);

/** Mes seleccionado, compartido por todas las pestañas (antes: celdas Año y Mes del Resumen). */
export function PeriodoProvider({ children }: { children: ReactNode }) {
  const ahora = new Date();
  const [periodo, setPeriodo] = useState({ anio: ahora.getFullYear(), mes: ahora.getMonth() + 1 });

  const mover = (delta: number) =>
    setPeriodo(({ anio, mes }) => {
      const indice = anio * 12 + (mes - 1) + delta;
      return { anio: Math.floor(indice / 12), mes: (indice % 12) + 1 };
    });

  return <PeriodoContext.Provider value={{ ...periodo, mover }}>{children}</PeriodoContext.Provider>;
}

export function usePeriodo() {
  const ctx = useContext(PeriodoContext);
  if (!ctx) throw new Error('usePeriodo debe usarse dentro de PeriodoProvider');
  return ctx;
}
