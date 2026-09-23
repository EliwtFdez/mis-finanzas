import { Platform } from 'react-native';
import type { Moneda } from '@/domain/finanzas';
import { leerCotizacionYahoo, precioEnPesos, simbolosYahoo, type Cotizacion } from '@/domain/valuacion';

const VIGENCIA_MS = 5 * 60_000;
const cache = new Map<string, { cuando: number; cotizacion: Cotizacion | null }>();

/** En web el navegador bloquea la consulta (Yahoo no permite CORS). */
export const preciosDisponibles = Platform.OS !== 'web';

async function cotizar(simbolo: string): Promise<Cotizacion | null> {
  const guardada = cache.get(simbolo);
  if (guardada && Date.now() - guardada.cuando < VIGENCIA_MS) return guardada.cotizacion;
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 8_000);
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=1d&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MisFinanzas/1.0)' },
      signal: control.signal,
    });
    // 404 = el símbolo no existe; se guarda para no preguntar de nuevo en 5 min.
    const cotizacion = r.ok || r.status === 404 ? leerCotizacionYahoo(await r.json()) : null;
    if (r.ok || r.status === 404) cache.set(simbolo, { cuando: Date.now(), cotizacion });
    return cotizacion;
  } catch {
    return null;
  } finally {
    clearTimeout(limite);
  }
}

async function primeraCotizacion(simbolos: string[]) {
  for (const s of simbolos) {
    const c = await cotizar(s);
    if (c) return c;
  }
  return null;
}

/** Precio actual en pesos de cada ticker (null si no se encontró). */
export async function preciosEnPesos(tickers: Array<{ ticker: string; moneda: Moneda }>) {
  const [tipoCambio, ...cotizaciones] = await Promise.all([
    cotizar('MXN=X').then((c) => c?.precio ?? null),
    ...tickers.map((t) => primeraCotizacion(simbolosYahoo(t.ticker, t.moneda))),
  ]);
  const precios = new Map<string, number | null>();
  let hora = 0;
  tickers.forEach((t, i) => {
    const c = cotizaciones[i];
    precios.set(t.ticker, c ? precioEnPesos(c, tipoCambio) : null);
    if (c) hora = Math.max(hora, c.hora);
  });
  return { precios, tipoCambio, hora: hora ? new Date(hora * 1000) : null };
}
