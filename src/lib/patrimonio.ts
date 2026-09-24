import { calcularCartera } from '@/domain/finanzas';
import { valorInversiones, type FotoPatrimonio } from '@/domain/patrimonio';
import { monedaPorTicker, valuarPosiciones } from '@/domain/valuacion';
import { cargarEfectivoYDeudas, cargarOperaciones, guardarFotoPatrimonio } from './datos';
import { hoy } from './formato';
import { preciosDisponibles, preciosEnPesos } from './precios';

export interface PatrimonioActual {
  /** false = la persona aún no dice cuánto tiene; el efectivo no significa nada todavía. */
  conSaldo: boolean;
  foto: FotoPatrimonio;
  /** Tickers valuados a costo porque no hubo precio. */
  sinPrecio: string[];
}

/**
 * Patrimonio de hoy con precios de mercado cuando se pueden consultar. Si ya hay saldo inicial,
 * guarda la foto del día (sin esperar ni fallar por ello).
 */
export async function calcularPatrimonioActual(): Promise<PatrimonioActual> {
  const [base, operaciones] = await Promise.all([cargarEfectivoYDeudas(), cargarOperaciones()]);
  const cartera = calcularCartera(operaciones);
  const monedas = monedaPorTicker(operaciones);
  const abiertas = cartera.posiciones.filter((p) => p.titulos > 0);
  const precios =
    preciosDisponibles && abiertas.length
      ? (await preciosEnPesos(abiertas.map((p) => ({ ticker: p.ticker, moneda: monedas.get(p.ticker) ?? 'MXN' })))).precios
      : new Map<string, number | null>();
  const mercado = valuarPosiciones(cartera.posiciones, precios);
  const foto: FotoPatrimonio = { fecha: hoy(), efectivo: base.efectivo, inversiones: valorInversiones(mercado.posiciones), deudas: base.deudas };
  if (base.conSaldo) guardarFotoPatrimonio(foto).catch(() => {});
  return { conSaldo: base.conSaldo, foto, sinPrecio: mercado.sinPrecio };
}
