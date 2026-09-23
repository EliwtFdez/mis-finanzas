const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pesosCortos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 });

export const aPesos = (n: number) => pesos.format(n);
export const aPesosCortos = (n: number) => pesosCortos.format(n);
export const aNumero = (n: number) => numero.format(n);

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** "1,234.50" o "$1234" → 1234.5; texto vacío o inválido → null */
export function leerNumero(s: string): number | null {
  const limpio = s.replace(/[\s,$]/g, '');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

export const fechaATexto = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const textoAFecha = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
};

export const hoy = () => fechaATexto(new Date());

/** Hoy si el mes elegido es el actual; si no, el último día de ese mes. */
export function fechaDeCorte(anio: number, mes: number) {
  const hoyTexto = hoy();
  if (hoyTexto.startsWith(`${anio}-${String(mes).padStart(2, '0')}`)) return hoyTexto;
  return fechaATexto(new Date(anio, mes, 0));
}

/** "2026-09-21" → "21 sep 2026" */
export function fechaLegible(s: string, conAnio = false) {
  const [a, m, d] = s.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1].toLowerCase()}${conAnio ? ` ${a}` : ''}`;
}
