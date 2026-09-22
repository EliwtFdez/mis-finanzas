import type { Categoria } from './finanzas';

export interface GastoExtraido {
  id: string;
  fecha: string;
  descripcion: string;
  importe: number;
  categoria_id: string;
  origen: string;
}

const MESES: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
};

const PALABRAS_INGRESO = /\b(abono|deposito|dep[oó]sito|nomina|n[oó]mina|spei\s*recibido\w*|recibidostp|pago recibido|transferencia recibida|reembolso|cashback|intereses a favor)\b/i;
const PALABRAS_NO_MOVIMIENTO = /\b(saldo (anterior|inicial|final|promedio)|total (de )?(pagos|compras|cargos|abonos)|fecha descripci[oó]n|pago para no generar|l[ií]mite de cr[eé]dito|resumen de movimientos)\b/i;

function sinAcentos(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function fechaISO(dia: number, mes: number, anio: number): string | null {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function leerFecha(linea: string, anioPredeterminado: number): { fecha: string; fin: number } | null {
  const numerica = linea.match(/^\s*(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (numerica) {
    let anio = numerica[3] ? Number(numerica[3]) : anioPredeterminado;
    if (anio < 100) anio += 2000;
    const fecha = fechaISO(Number(numerica[1]), Number(numerica[2]), anio);
    return fecha ? { fecha, fin: numerica[0].length } : null;
  }

  // Acepta "18 ago 2026", "18 de agosto de 2026", "18-ago-2026" y "18/AGO".
  const texto = linea.match(/^\s*(\d{1,2})(?:\s+(?:de\s+)?|\s*[-/]\s*)([a-záéíóú]{3,12})(?:(?:\s+(?:de\s+)?|\s*[-/]\s*)(\d{4}))?\b/i);
  if (!texto) return null;
  const mes = MESES[sinAcentos(texto[2])];
  if (!mes) return null;
  let anio = texto[3] ? Number(texto[3]) : anioPredeterminado;
  if (anio < 100) anio += 2000;
  const fecha = fechaISO(Number(texto[1]), mes, anio);
  return fecha ? { fecha, fin: texto[0].length } : null;
}

function leerImporte(linea: string): { importe: number; inicio: number; negativo: boolean } | null {
  // Exige centavos, separador de miles o signo de moneda para no confundir folios con importes.
  const patron = /[+-]?\s*(?:\$|MXN\s*)?\s*\(?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?/gi;
  const hallados = [...linea.matchAll(patron)].filter((m) => m.index !== undefined);
  if (!hallados.length) return null;

  // En cuentas de débito suele haber "cargo, abono, saldo": el primer importe es el movimiento.
  // En tarjetas normalmente solo hay uno. La revisión previa permite corregir casos atípicos.
  const elegido = hallados[0];
  const limpio = elegido[0].replace(/[\s,$()]/g, '');
  const importe = Math.abs(Number(limpio));
  const negativo = elegido[0].trimStart().startsWith('-') || /\(.*\)/.test(elegido[0]);
  return Number.isFinite(importe) && importe > 0 ? { importe, inicio: elegido.index!, negativo } : null;
}

function categoriaSugerida(descripcion: string, categorias: Categoria[]): string {
  const d = sinAcentos(descripcion);
  const reglas: Array<[RegExp, string[]]> = [
    [/\bfarm(?:acia)?\b|medic|hospital|doctor|laborator|clinica/, ['Salud']],
    [/uber|didi|gasolin|pemex|metro|autobus|estacionamiento|caseta/, ['Transporte']],
    [/super|wal\s*mart|soriana|chedraui|oxxo|restaur|\brest\b|\bmcd\b|subway|cafe|comida|rappi|uber eats|didi food/, ['Comida']],
    [/cfe|telmex|izzi|totalplay|internet|telefon|agua|gas natural|netflix|spotify/, ['Servicios']],
    [/renta|hipoteca|mantenimiento|condominio|inmobili/, ['Vivienda']],
    [/cine|teatro|juego|steam|ticketmaster|entretenimiento/, ['Entretenimiento']],
    [/escuela|colegio|universidad|curso|libro|papeleria/, ['Educación']],
    [/interes|comision|anualidad|iva com|cargo financiero/, ['Deudas e intereses']],
    [/amazon|mercado libre|liverpool|palacio|costco|compra/, ['Compras']],
  ];
  for (const [patron, nombres] of reglas) {
    if (!patron.test(d)) continue;
    const categoria = categorias.find((c) => nombres.includes(c.nombre));
    if (categoria) return categoria.id;
  }
  return categorias.find((c) => c.nombre === 'Otros')?.id ?? categorias[0]?.id ?? '';
}

/**
 * Extrae candidatos conservadores de texto ya obtenido de un estado de cuenta.
 * Solo devuelve gastos; depósitos, pagos recibidos, totales y saldos se excluyen.
 */
export function extraerGastosDeTexto(texto: string, categorias: Categoria[], anioPredeterminado: number): GastoExtraido[] {
  const gastos: GastoExtraido[] = [];
  const lineas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const aniosMencionados = [...texto.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  const anioDetectado = aniosMencionados.length
    ? [...new Set(aniosMencionados)].sort((a, b) => aniosMencionados.filter((x) => x === b).length - aniosMencionados.filter((x) => x === a).length)[0]
    : anioPredeterminado;
  const esEstadoTarjetaCredito = /tarjeta de cr[eé]dito|cargos\s*,?\s*compras y abonos regulares/i.test(texto);

  lineas.forEach((linea, indice) => {
    const fecha = leerFecha(linea, anioDetectado);
    if (!fecha || PALABRAS_NO_MOVIMIENTO.test(linea) || PALABRAS_INGRESO.test(linea)) return;
    let resto = linea.slice(fecha.fin);
    // Algunos estados incluyen fecha de operación y fecha de cargo antes del comercio.
    const segundaFecha = leerFecha(resto, anioDetectado);
    if (segundaFecha) resto = resto.slice(segundaFecha.fin);
    const monto = leerImporte(resto);
    if (!monto) return;
    // En tarjetas de crédito BBVA, '+' es una compra y '-' es pago/abono.
    if (esEstadoTarjetaCredito && monto.negativo) return;
    const descripcion = resto.slice(0, monto.inicio)
      .replace(/^\s*[-|:]\s*/, '')
      .replace(/\s+[+-]\s*$/, '')
      .trim();
    if (descripcion.length < 2) return;
    gastos.push({
      id: `${fecha.fecha}-${indice}-${monto.importe}`,
      fecha: fecha.fecha,
      descripcion: descripcion.slice(0, 160),
      importe: Math.round((monto.importe + Number.EPSILON) * 100) / 100,
      categoria_id: categoriaSugerida(descripcion, categorias),
      origen: linea,
    });
  });

  return gastos.sort((a, b) =>
    a.categoria_id.localeCompare(b.categoria_id) || b.importe - a.importe || b.fecha.localeCompare(a.fecha),
  );
}

export function esDuplicado(gasto: Pick<GastoExtraido, 'fecha' | 'importe' | 'descripcion'>, existentes: Array<{ fecha: string; importe: number; descripcion: string | null }>) {
  const descripcion = sinAcentos(gasto.descripcion).replace(/\W/g, '');
  return existentes.some((m) => {
    const otra = sinAcentos(m.descripcion ?? '').replace(/\W/g, '');
    return m.fecha === gasto.fecha && Math.abs(m.importe - gasto.importe) < 0.005 && (!!descripcion && descripcion === otra);
  });
}
