import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moverCategoria, siguienteOrden, validarNombreCategoria } from '../src/domain/categorias.ts';
import type { Categoria } from '../src/domain/finanzas.ts';

const categorias: Categoria[] = [
  { id: 'viv', nombre: 'Vivienda', tipo: 'Gasto', orden: 1 },
  { id: 'com', nombre: 'Comida', tipo: 'Gasto', orden: 2 },
  { id: 'tra', nombre: 'Transporte', tipo: 'Gasto', orden: 3 },
  { id: 'sue', nombre: 'Sueldo', tipo: 'Ingreso', orden: 11 },
];

test('valida nombres vacíos, largos y repetidos sin importar mayúsculas ni espacios', () => {
  assert.equal(validarNombreCategoria('   ', categorias), 'Escribe un nombre.');
  assert.equal(validarNombreCategoria('x'.repeat(41), categorias), 'Usa un nombre de 40 caracteres o menos.');
  assert.equal(validarNombreCategoria('  comida ', categorias), 'Ya tienes una categoría con ese nombre.');
  assert.equal(validarNombreCategoria('Mascotas', categorias), null);
  // Renombrar a sí misma (solo cambia mayúsculas) está permitido
  assert.equal(validarNombreCategoria('COMIDA', categorias, 'com'), null);
});

test('mueve dentro del mismo tipo y solo devuelve los órdenes que cambian', () => {
  assert.deepEqual(moverCategoria(categorias, 'com', -1), [
    { id: 'com', orden: 1 },
    { id: 'viv', orden: 2 },
  ]);
  assert.deepEqual(moverCategoria(categorias, 'viv', -1), []);
  assert.deepEqual(moverCategoria(categorias, 'tra', 1), []);
  assert.deepEqual(moverCategoria(categorias, 'sue', -1), [], 'no cruza a otro tipo');
});

test('reenumera cuando hay órdenes repetidos', () => {
  const repetidos: Categoria[] = [
    { id: 'a', nombre: 'A', tipo: 'Gasto', orden: 5 },
    { id: 'b', nombre: 'B', tipo: 'Gasto', orden: 5 },
    { id: 'c', nombre: 'C', tipo: 'Gasto', orden: 5 },
  ];
  const cambios = moverCategoria(repetidos, 'c', -1);
  const final = new Map(repetidos.map((c) => [c.id, c.orden]));
  for (const x of cambios) final.set(x.id, x.orden);
  assert.deepEqual(new Set(final.values()).size, 3, 'quedan órdenes distintos');
  assert.ok(final.get('c')! < final.get('b')!, 'C quedó antes que B');
});

test('siguiente orden va al final', () => {
  assert.equal(siguienteOrden(categorias), 12);
  assert.equal(siguienteOrden([]), 1);
});
