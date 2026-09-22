export interface FragmentoTextoPdf {
  str: string;
  x: number;
  y: number;
}

/** Une fragmentos cercanos en el mismo renglón sin depender de límites de redondeo. */
export function reconstruirTextoPdf(paginas: FragmentoTextoPdf[][]): string {
  const paginasAgrupadas = paginas.map((pagina) => {
    const renglones: Array<{ y: number; items: FragmentoTextoPdf[] }> = [];
    const items = [...pagina].sort((a, b) => b.y - a.y || a.x - b.x);

    for (const item of items) {
      const renglon = renglones.find((r) => Math.abs(r.y - item.y) <= 3);
      if (renglon) {
        renglon.items.push(item);
        renglon.y = (renglon.y * (renglon.items.length - 1) + item.y) / renglon.items.length;
      } else {
        renglones.push({ y: item.y, items: [item] });
      }
    }

    return renglones.sort((a, b) => b.y - a.y);
  });

  // En estados de débito con columnas CARGOS/ABONOS, la descripción puede ser
  // idéntica en ambas (p. ej. "PAGO CUENTA DE TERCERO"). Conservamos la
  // semántica de la columna para que un abono nunca se importe como gasto.
  let xLimiteAbono: number | null = null;
  for (const pagina of paginasAgrupadas) {
    for (const renglon of pagina) {
      const cargo = renglon.items.find((i) => /^CARGOS$/i.test(i.str.trim()));
      const abono = renglon.items.find((i) => /^ABONOS(?:\s|$)/i.test(i.str.trim()));
      if (cargo && abono && cargo.x < abono.x) {
        xLimiteAbono = (cargo.x + abono.x) / 2;
        break;
      }
    }
    if (xLimiteAbono !== null) break;
  }

  return paginasAgrupadas.map((pagina) => pagina
    .map((r) => {
      const items = r.items.sort((a, b) => a.x - b.x);
      let linea = items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (xLimiteAbono !== null && /^\d{1,2}\/[A-ZÁÉÍÓÚ]{3}\b/i.test(linea)) {
        const primerImporte = items.find((i) => /^[+-]?\s*\$?\s*[\d,]+\.\d{2}$/.test(i.str.trim()));
        if (primerImporte && primerImporte.x >= xLimiteAbono) linea += ' [ABONO]';
      }
      return linea;
    })
    .filter(Boolean)
    .join('\n')).join('\n');
}
