// Valor de mercado de la cartera con precios de Yahoo Finance (gratis, sin API key).
import type { Moneda, Operacion, Posicion } from './finanzas';

export interface Cotizacion {
  simbolo: string;
  precio: number;
  moneda: string;
  /** Segundos Unix de la última operación. */
  hora: number;
}

/**
 * Símbolos de Yahoo a probar en orden. Lo que compras en pesos (BMV o SIC) cotiza como "TICKER.MX";
 * lo comprado en dólares, en su bolsa de origen. Se quita el "*" de series como "WALMEX*" y el sufijo
 * de mercado que usa la app ("WALMEX-MX", "VOO-US"): Yahoo no lo conoce.
 */
export function simbolosYahoo(ticker: string, moneda: Moneda): string[] {
  const sufijo = ticker.trim().toUpperCase().match(/^(.+?)(?:-(MX|US))?$/)!;
  const base = sufijo[1].replace(/\*+$/, '');
  if (sufijo[2] === 'MX') return [`${base}.MX`];
  return moneda === 'MXN' ? [`${base}.MX`, base] : [base, `${base}.MX`];
}

/** Lee la respuesta de /v8/finance/chart; null si no hay precio. */
export function leerCotizacionYahoo(json: unknown): Cotizacion | null {
  const meta = (json as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } })?.chart?.result?.[0]?.meta;
  const precio = Number(meta?.regularMarketPrice);
  if (!meta || !Number.isFinite(precio) || precio <= 0) return null;
  return { simbolo: String(meta.symbol), precio, moneda: String(meta.currency ?? ''), hora: Number(meta.regularMarketTime ?? 0) };
}

/** Precio en pesos: directo si cotiza en MXN, con el tipo de cambio si cotiza en USD. */
export function precioEnPesos(c: Cotizacion, tipoCambio: number | null): number | null {
  if (c.moneda === 'MXN') return c.precio;
  if (c.moneda === 'USD' && tipoCambio) return c.precio * tipoCambio;
  return null;
}

/** Moneda de la última operación de cada ticker (define dónde buscar el precio). */
export function monedaPorTicker(operaciones: Operacion[]): Map<string, Moneda> {
  const ordenadas = [...operaciones].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  return new Map(ordenadas.map((o) => [o.ticker, o.moneda]));
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PosicionValuada extends Posicion {
  precio: number | null;
  valor: number | null;
  gananciaNoRealizada: number | null;
  rendimiento: number | null; // 0.05 = 5 %
}

export function valuarPosiciones(posiciones: Posicion[], preciosMXN: Map<string, number | null>) {
  const valuadas: PosicionValuada[] = posiciones.map((p) => {
    const precio = preciosMXN.get(p.ticker) ?? null;
    if (precio === null || p.titulos <= 0) return { ...p, precio, valor: null, gananciaNoRealizada: null, rendimiento: null };
    const valor = r2(precio * p.titulos);
    const ganancia = r2(valor - p.costo);
    return { ...p, precio, valor, gananciaNoRealizada: ganancia, rendimiento: p.costo > 0 ? ganancia / p.costo : null };
  });
  const conPrecio = valuadas.filter((p) => p.valor !== null);
  const valor = r2(conPrecio.reduce((s, p) => s + p.valor!, 0));
  const costo = r2(conPrecio.reduce((s, p) => s + p.costo, 0));
  return {
    posiciones: valuadas,
    valor,
    gananciaNoRealizada: r2(valor - costo),
    sinPrecio: valuadas.filter((p) => p.titulos > 0 && p.valor === null).map((p) => p.ticker),
  };
}
