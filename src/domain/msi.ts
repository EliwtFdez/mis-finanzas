// Compras a meses sin intereses. El reparto debe coincidir con crear_compra_msi() en la migración.

export interface CompraMsi {
  id: string;
  fecha: string; // AAAA-MM-DD
  descripcion: string;
  importe_total: number;
  meses: number;
  categoria_id: string;
  cuenta: string | null;
  /** Mensualidades registradas (pueden haberse editado o borrado a mano). */
  pagos: Array<{ fecha: string; importe: number }>;
}

export interface PagoMsi {
  numero: number;
  fecha: string;
  importe: number;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Mensualidades: el total entre los meses truncado a centavos; el último pago absorbe el residuo. */
export function calendarioMsi(fecha: string, total: number, meses: number): PagoMsi[] {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / meses);
  return Array.from({ length: meses }, (_, k) => {
    const indice = mes - 1 + k;
    const a = anio + Math.floor(indice / 12);
    const m = (indice % 12) + 1;
    const diasDelMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const importe = k === meses - 1 ? centavos - base * (meses - 1) : base;
    return { numero: k + 1, fecha: `${a}-${dosDigitos(m)}-${dosDigitos(Math.min(dia, diasDelMes))}`, importe: importe / 100 };
  });
}

export interface EstadoCompraMsi {
  compra: CompraMsi;
  pagados: number;
  restantes: number;
  montoRestante: number;
  mensualidad: number;
  terminada: boolean;
  ultimaFecha: string | null;
}

/** Cuánto va pagado de cada compra a la fecha `hoy` y totales para el mes de `hoy`. */
export function estadoMsi(compras: CompraMsi[], hoy: string) {
  const mesHoy = hoy.slice(0, 7);
  const estados: EstadoCompraMsi[] = compras.map((compra) => {
    const pagos = [...compra.pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pendientes = pagos.filter((p) => p.fecha > hoy);
    const montoRestante = Math.round(pendientes.reduce((s, p) => s + p.importe, 0) * 100) / 100;
    return {
      compra,
      pagados: pagos.length - pendientes.length,
      restantes: pendientes.length,
      montoRestante,
      mensualidad: pagos[0]?.importe ?? 0,
      terminada: pendientes.length === 0,
      ultimaFecha: pagos.at(-1)?.fecha ?? null,
    };
  });
  const esteMes = compras.flatMap((c) => c.pagos).filter((p) => p.fecha.startsWith(mesHoy));
  return {
    estados: estados.sort((a, b) => Number(a.terminada) - Number(b.terminada) || b.montoRestante - a.montoRestante),
    esteMes: Math.round(esteMes.reduce((s, p) => s + p.importe, 0) * 100) / 100,
    deudaRestante: Math.round(estados.reduce((s, e) => s + e.montoRestante, 0) * 100) / 100,
    activas: estados.filter((e) => !e.terminada).length,
  };
}
