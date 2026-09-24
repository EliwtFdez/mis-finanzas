import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cambioDesde, escalaGrafica, marcasEje, netoDeFoto, puntoCercano, valorInversiones, type FotoPatrimonio } from '../src/domain/patrimonio.ts';

const foto = (fecha: string, efectivo: number, inversiones = 0, deudas = 0): FotoPatrimonio => ({ fecha, efectivo, inversiones, deudas });

test('neto = efectivo + inversiones − deudas, sin centavos sueltos', () => {
  assert.equal(netoDeFoto({ efectivo: 14323.5, inversiones: 458.9, deudas: 1100 }), 13682.4);
  assert.equal(netoDeFoto({ efectivo: 0.1, inversiones: 0.2, deudas: 0 }), 0.3);
});

test('cambio contra hace 30 días usa la última foto de ese día o antes', () => {
  const fotos = [foto('2026-08-01', 1000), foto('2026-08-20', 1500), foto('2026-08-25', 1700), foto('2026-09-23', 2000)];
  assert.deepEqual(cambioDesde(fotos, 30), { monto: 500, desde: '2026-08-20' }); // 24 ago es el límite
});

test('con historial corto compara con la primera foto; con una sola no hay cambio', () => {
  assert.deepEqual(cambioDesde([foto('2026-09-20', 1000), foto('2026-09-23', 900)], 30), { monto: -100, desde: '2026-09-20' });
  assert.equal(cambioDesde([foto('2026-09-23', 1000)], 30), null);
  assert.equal(cambioDesde([], 30), null);
});

test('marcas de eje redondas que cubren el rango', () => {
  assert.deepEqual(marcasEje(13200, 14800), [13000, 14000, 15000]);
  assert.deepEqual(marcasEje(-250, 900), [-500, 0, 500, 1000]);
  assert.deepEqual(marcasEje(0.2, 0.9), [0, 0.5, 1]);
  const planas = marcasEje(1000, 1000);
  assert.ok(planas[0] < 1000 && planas[planas.length - 1] > 1000, 'un valor constante queda al centro');
});

test('escala: x proporcional al tiempo, y dentro del lienzo', () => {
  const { puntos, marcas } = escalaGrafica([foto('2026-09-01', 1000), foto('2026-09-11', 2000), foto('2026-09-03', 1500)], 300, 100);
  assert.deepEqual(puntos.map((p) => p.fecha), ['2026-09-01', '2026-09-03', '2026-09-11']);
  assert.deepEqual(puntos.map((p) => p.x), [0, 60, 300]);
  assert.equal(marcas[0].y, 100);
  assert.equal(marcas[marcas.length - 1].y, 0);
  assert.ok(puntos.every((p) => p.y >= 0 && p.y <= 100));
  assert.equal(puntoCercano(puntos, 250)?.fecha, '2026-09-11');
  assert.equal(puntoCercano(puntos, 40)?.fecha, '2026-09-03');
});

test('inversiones: valor de mercado, o el costo si no hay precio; las cerradas no cuentan', () => {
  assert.equal(
    valorInversiones([
      { titulos: 10, costo: 600, valor: 458.9 },
      { titulos: 2, costo: 3618, valor: null },
      { titulos: 0, costo: 0, valor: null },
    ]),
    4076.9,
  );
});
