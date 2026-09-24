// Patrimonio neto = efectivo + inversiones − deudas, y su historial diario.
import type { PosicionValuada } from './valuacion';

export interface FotoPatrimonio {
  fecha: string; // AAAA-MM-DD
  efectivo: number;
  inversiones: number;
  deudas: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const netoDeFoto = (f: Omit<FotoPatrimonio, 'fecha'>) => r2(f.efectivo + f.inversiones - f.deudas);

const dias = (fecha: string) => Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) / 86_400_000;

/**
 * Cambio del patrimonio contra hace `n` días: se compara con la última foto de ese día o anterior;
 * si el historial es más corto, con la primera. Null si solo hay una foto.
 */
export function cambioDesde(fotos: FotoPatrimonio[], n: number): { monto: number; desde: string } | null {
  if (fotos.length < 2) return null;
  const orden = [...fotos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultima = orden[orden.length - 1];
  const limite = dias(ultima.fecha) - n;
  const base = [...orden].reverse().find((f) => dias(f.fecha) <= limite) ?? orden[0];
  if (base.fecha === ultima.fecha) return null;
  return { monto: r2(netoDeFoto(ultima) - netoDeFoto(base)), desde: base.fecha };
}

/**
 * Marcas de eje «redondas» (paso de 1, 2 o 5 × 10ⁿ) que cubren [min, max]: el paso más fino
 * que no pase de `cuantas + 1` marcas, para no dejar la gráfica con espacio vacío.
 */
export function marcasEje(min: number, max: number, cuantas = 3): number[] {
  if (min === max) {
    const holgura = Math.abs(min) * 0.1 || 1;
    return marcasEje(min - holgura, max + holgura, cuantas);
  }
  const redondo = (v: number) => Math.round(v * 1e6) / 1e6;
  for (let k = Math.floor(Math.log10(max - min)) - 1; ; k++) {
    for (const m of [1, 2, 5]) {
      const paso = m * 10 ** k;
      const desde = Math.floor(redondo(min / paso));
      const hasta = Math.ceil(redondo(max / paso));
      if (hasta - desde + 1 <= cuantas + 1) {
        return Array.from({ length: hasta - desde + 1 }, (_, i) => redondo((desde + i) * paso));
      }
    }
  }
}

export interface PuntoGrafica {
  x: number;
  y: number;
  fecha: string;
  valor: number;
}

/**
 * Coordenadas de la línea en un lienzo de `ancho` × `alto`. X es proporcional al tiempo (los días
 * sin foto no se inventan, la línea los une); Y va de la marca más baja a la más alta.
 */
export function escalaGrafica(fotos: FotoPatrimonio[], ancho: number, alto: number) {
  const orden = [...fotos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const valores = orden.map(netoDeFoto);
  const marcas = marcasEje(Math.min(...valores), Math.max(...valores));
  const [yMin, yMax] = [marcas[0], marcas[marcas.length - 1]];
  const t0 = dias(orden[0].fecha);
  const rango = Math.max(1, dias(orden[orden.length - 1].fecha) - t0);
  const y = (v: number) => alto - ((v - yMin) / (yMax - yMin)) * alto;
  const puntos: PuntoGrafica[] = orden.map((f, i) => ({
    x: orden.length === 1 ? ancho : ((dias(f.fecha) - t0) / rango) * ancho,
    y: y(valores[i]),
    fecha: f.fecha,
    valor: valores[i],
  }));
  return { puntos, marcas: marcas.map((valor) => ({ valor, y: y(valor) })) };
}

/** El punto más cercano a una x (para inspeccionar tocando la gráfica). */
export function puntoCercano(puntos: PuntoGrafica[], x: number): PuntoGrafica | null {
  return puntos.reduce<PuntoGrafica | null>((mejor, p) => (!mejor || Math.abs(p.x - x) < Math.abs(mejor.x - x) ? p : mejor), null);
}

/** Posiciones abiertas a valor de mercado; las que no tienen precio, a su costo. */
export function valorInversiones(posiciones: Pick<PosicionValuada, 'titulos' | 'costo' | 'valor'>[]): number {
  return r2(posiciones.filter((p) => p.titulos > 0).reduce((s, p) => s + (p.valor ?? p.costo), 0));
}
