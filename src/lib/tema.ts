// Paleta de "libro de cuentas": papel verdoso, tinta verde oscura,
// rojo para pérdidas y excesos, y el ámbar de las celdas "por revisar" del Excel.
export const colores = {
  papel: '#F2F4EF',
  hoja: '#FFFFFF',
  tinta: '#17332B',
  tintaSuave: '#5B6F66',
  linea: '#D6DDD5',
  verde: '#2F6B4F',
  verdeClaro: '#DCEADF',
  rojo: '#B3362B',
  rojoClaro: '#F6DEDA',
  ambar: '#C98E0A',
  ambarClaro: '#FBEFC9',
} as const;

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

export const texto = {
  cifraGrande: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -1, fontVariant: ['tabular-nums' as const] },
  titulo: { fontSize: 22, fontWeight: '700' as const, color: colores.tinta },
  seccion: { fontSize: 15, fontWeight: '700' as const, color: colores.tinta },
  cuerpo: { fontSize: 15, color: colores.tinta },
  nota: { fontSize: 13, color: colores.tintaSuave, lineHeight: 18 },
  cifra: { fontSize: 15, fontVariant: ['tabular-nums' as const], color: colores.tinta },
};
