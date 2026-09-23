// Cálculos del Excel "Mis finanzas y acciones", como funciones puras.
// No dependen de React ni de Supabase, así se pueden probar con `npm test`.

export type TipoMovimiento = 'Ingreso' | 'Gasto';
export type TipoOperacion = 'Compra' | 'Venta';
export type Moneda = 'MXN' | 'USD';

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoMovimiento;
  orden: number;
  activa?: boolean;
}

export interface Movimiento {
  id: string;
  fecha: string; // AAAA-MM-DD
  tipo: TipoMovimiento;
  categoria_id: string;
  descripcion: string | null;
  importe: number;
  medio_pago: string | null;
  cuenta: string | null;
  notas: string | null;
  /** Llegó de Apple Pay sin categoría conocida y espera que el usuario la elija. */
  por_revisar?: boolean;
  /** Mensualidad de una compra a meses sin intereses. */
  compra_msi_id?: string | null;
  numero_pago?: number | null;
  created_at?: string;
}

export interface Operacion {
  id: string;
  fecha: string; // AAAA-MM-DD
  ticker: string;
  tipo: TipoOperacion;
  cantidad: number;
  precio: number;
  comision: number;
  moneda: Moneda;
  tipo_cambio: number | null;
  notas: string | null;
  created_at?: string;
}

export interface Presupuesto {
  id?: string;
  anio: number;
  mes: number;
  categoria_id: string | null; // null = total del mes
  monto: number;
}

const EPS = 1e-8;

export const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─────────────────────────────────────────────────────────────
// Cartera: costo promedio ponderado en MXN (hoja Acciones)
// ─────────────────────────────────────────────────────────────

export type EstadoOperacion = 'OK' | 'Venta excede saldo';

export interface OperacionCalculada extends Operacion {
  estado: EstadoOperacion;
  /** Negativo en compras (sale dinero), positivo en ventas. En MXN. */
  flujo: number;
  /** Solo ventas: flujo menos costo vendido. En MXN. */
  ganancia: number;
  costoMedioPrevio: number;
  titulosDespues: number;
}

export interface Posicion {
  ticker: string;
  titulos: number;
  costo: number;
  costoMedio: number;
  gananciaRealizada: number;
}

/** Orden cronológico estable: fecha y, si empatan, momento de captura. */
export function ordenarOperaciones<T extends Operacion>(ops: T[]): T[] {
  return [...ops].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    const ca = a.created_at ?? '';
    const cb = b.created_at ?? '';
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });
}

export function flujoMXN(op: Operacion): number {
  const tc = op.moneda === 'MXN' ? 1 : op.tipo_cambio ?? 0;
  const bruto = op.cantidad * op.precio;
  return op.tipo === 'Compra' ? -(bruto + op.comision) * tc : (bruto - op.comision) * tc;
}

export function calcularCartera(operaciones: Operacion[]): {
  operaciones: OperacionCalculada[];
  posiciones: Posicion[];
  costoTotal: number;
  gananciaTotal: number;
} {
  const estado = new Map<string, { titulos: number; costo: number; ganancia: number }>();
  const calculadas: OperacionCalculada[] = [];

  for (const op of ordenarOperaciones(operaciones)) {
    const pos = estado.get(op.ticker) ?? { titulos: 0, costo: 0, ganancia: 0 };
    const costoMedioPrevio = pos.titulos > EPS ? pos.costo / pos.titulos : 0;
    const flujo = flujoMXN(op);

    if (op.tipo === 'Venta' && op.cantidad > pos.titulos + EPS) {
      // Igual que en Excel: la fila queda fuera del cálculo y se marca.
      calculadas.push({ ...op, estado: 'Venta excede saldo', flujo: 0, ganancia: 0, costoMedioPrevio, titulosDespues: pos.titulos });
      estado.set(op.ticker, pos);
      continue;
    }

    let ganancia = 0;
    if (op.tipo === 'Compra') {
      pos.titulos += op.cantidad;
      pos.costo += -flujo;
    } else {
      const costoVendido = op.cantidad * costoMedioPrevio;
      ganancia = flujo - costoVendido;
      pos.titulos -= op.cantidad;
      pos.costo -= costoVendido;
      pos.ganancia += ganancia;
      if (pos.titulos < EPS) {
        pos.titulos = 0;
        pos.costo = 0; // evita residuos de redondeo al cerrar la posición
      }
    }

    estado.set(op.ticker, pos);
    calculadas.push({ ...op, estado: 'OK', flujo, ganancia, costoMedioPrevio, titulosDespues: pos.titulos });
  }

  const posiciones: Posicion[] = [...estado.entries()]
    .map(([ticker, p]) => ({
      ticker,
      titulos: p.titulos,
      costo: redondear(p.costo),
      costoMedio: p.titulos > EPS ? redondear(p.costo / p.titulos) : 0,
      gananciaRealizada: redondear(p.ganancia),
    }))
    .sort((a, b) => b.costo - a.costo || a.ticker.localeCompare(b.ticker));

  return {
    operaciones: calculadas,
    posiciones,
    costoTotal: redondear(posiciones.reduce((s, p) => s + p.costo, 0)),
    gananciaTotal: redondear(posiciones.reduce((s, p) => s + p.gananciaRealizada, 0)),
  };
}

// ─────────────────────────────────────────────────────────────
// Resumen del mes (hoja Resumen)
// ─────────────────────────────────────────────────────────────

export const claveMes = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}`;
export const enMes = (fecha: string, anio: number, mes: number) => fecha.startsWith(claveMes(anio, mes));

export interface LineaCategoria {
  categoria: Categoria;
  gastado: number;
  presupuesto: number | null;
}

export interface ResumenMes {
  ingresos: number;
  gastos: number;
  diferencia: number;
  presupuesto: number | null;
  presupuestoRestante: number | null;
  comprasAcciones: number;
  ventasAcciones: number;
  gananciaVentas: number;
  porCategoria: LineaCategoria[];
}

export function resumenMes(params: {
  anio: number;
  mes: number;
  movimientos: Movimiento[];
  categorias: Categoria[];
  presupuestos: Presupuesto[];
  operaciones: OperacionCalculada[];
}): ResumenMes {
  const { anio, mes, categorias } = params;
  const movs = params.movimientos.filter((m) => enMes(m.fecha, anio, mes));
  const ops = params.operaciones.filter((o) => o.estado === 'OK' && enMes(o.fecha, anio, mes));
  const pres = params.presupuestos.filter((p) => p.anio === anio && p.mes === mes);

  const ingresos = redondear(movs.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + m.importe, 0));
  const gastos = redondear(movs.filter((m) => m.tipo === 'Gasto').reduce((s, m) => s + m.importe, 0));
  const presupuesto = pres.find((p) => p.categoria_id === null)?.monto ?? null;

  const porCategoria = categorias
    .filter((c) => c.tipo === 'Gasto')
    .sort((a, b) => a.orden - b.orden)
    .map((categoria) => ({
      categoria,
      gastado: redondear(movs.filter((m) => m.categoria_id === categoria.id).reduce((s, m) => s + m.importe, 0)),
      presupuesto: pres.find((p) => p.categoria_id === categoria.id)?.monto ?? null,
    }));

  return {
    ingresos,
    gastos,
    diferencia: redondear(ingresos - gastos),
    presupuesto,
    presupuestoRestante: presupuesto === null ? null : redondear(presupuesto - gastos),
    comprasAcciones: redondear(-ops.filter((o) => o.tipo === 'Compra').reduce((s, o) => s + o.flujo, 0)),
    ventasAcciones: redondear(ops.filter((o) => o.tipo === 'Venta').reduce((s, o) => s + o.flujo, 0)),
    gananciaVentas: redondear(ops.reduce((s, o) => s + o.ganancia, 0)),
    porCategoria,
  };
}

/** Tabla de 12 meses del Resumen. */
export function resumenAnual(anio: number, movimientos: Movimiento[]) {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const movs = movimientos.filter((m) => enMes(m.fecha, anio, mes));
    const ingresos = redondear(movs.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + m.importe, 0));
    const gastos = redondear(movs.filter((m) => m.tipo === 'Gasto').reduce((s, m) => s + m.importe, 0));
    return { mes, ingresos, gastos, diferencia: redondear(ingresos - gastos) };
  });
}
