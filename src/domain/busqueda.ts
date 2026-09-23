import type { Movimiento } from './finanzas';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "$1,250.50" → 1250.5; null si la palabra no es un monto. */
function comoMonto(palabra: string): number | null {
  const limpio = palabra.replace(/[$,]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(limpio) ? Number(limpio) : null;
}

/**
 * Filtra movimientos que contengan todas las palabras buscadas en descripción, categoría,
 * cuenta, medio de pago o notas. Una palabra numérica también coincide con el importe
 * exacto o con su parte entera ("450" encuentra 450.00 y 450.90).
 */
export function buscarMovimientos<M extends Movimiento>(movimientos: M[], consulta: string, nombreCategoria: (id: string) => string): M[] {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return movimientos;
  return movimientos.filter((m) => {
    const texto = normalizar([m.descripcion, nombreCategoria(m.categoria_id), m.cuenta, m.medio_pago, m.notas].filter(Boolean).join(' '));
    return palabras.every((p) => {
      const monto = comoMonto(p);
      if (monto !== null && (Math.abs(m.importe - monto) < 0.005 || Math.floor(m.importe) === monto)) return true;
      return texto.includes(p);
    });
  });
}
