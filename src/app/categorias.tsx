import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import type { Categoria, TipoMovimiento } from '@/domain/finanzas';
import { colorSugerido, GRIS_CATEGORIA, ICONOS_CATEGORIAS, NOMBRES_COLOR, moverCategoria, PALETA_CATEGORIAS, siguienteOrden, validarNombreCategoria } from '@/domain/categorias';
import { actualizarCategoria, borrarCategoria, cargarCategorias, crearCategoria, mensajeError } from '@/lib/datos';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, Campo, IconoCategoria, MensajeError, Opciones, Vacio } from '@/components/ui';

const TIPOS = ['Gasto', 'Ingreso'] as const;


export default function Categorias() {
  const { datos: categorias, error: errorCarga, recargar } = useCarga(() => cargarCategorias({ todas: true }), []);
  const [tipo, setTipo] = useState<TipoMovimiento>('Gasto');
  const [nueva, setNueva] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [iconoEditado, setIconoEditado] = useState<string | null>(null);
  const [colorEditado, setColorEditado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todas = categorias ?? [];
  const delTipo = todas.filter((c) => c.tipo === tipo).sort((a, b) => a.orden - b.orden);
  const problemaNueva = nueva.trim() ? validarNombreCategoria(nueva, todas) : null;

  async function ejecutar(accion: () => Promise<unknown>) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      recargar();
      return true;
    } catch (e) {
      setError(mensajeError(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function agregar() {
    const problema = validarNombreCategoria(nueva, todas);
    if (problema) return setError(problema);
    if (await ejecutar(() => crearCategoria({ nombre: nueva, tipo, orden: siguienteOrden(todas), icono: null, color: colorSugerido(todas, tipo) }))) setNueva('');
  }

  function empezarEdicion(c: Categoria) {
    setEditando(c.id);
    setNombreEditado(c.nombre);
    setIconoEditado(c.icono ?? null);
    setColorEditado(c.color ?? null);
    setError(null);
  }

  async function guardarEdicion(c: Categoria) {
    const problema = validarNombreCategoria(nombreEditado, todas, c.id);
    if (problema) return setError(problema);
    const cambios = { nombre: nombreEditado, icono: iconoEditado, color: colorEditado };
    if (await ejecutar(() => actualizarCategoria(c.id, cambios))) setEditando(null);
  }

  function mover(c: Categoria, direccion: -1 | 1) {
    const cambios = moverCategoria(todas, c.id, direccion);
    if (cambios.length) ejecutar(() => Promise.all(cambios.map((x) => actualizarCategoria(x.id, { orden: x.orden }))));
  }

  function borrar(c: Categoria) {
    Alert.alert('Borrar categoría', `¿Borrar «${c.nombre}»? Si tiene movimientos no se podrá; en ese caso ocúltala.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          if (await ejecutar(() => borrarCategoria(c.id))) setEditando(null);
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colores.papel }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Categorías' }} />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Opciones opciones={TIPOS} valor={tipo} onCambio={(t) => { setTipo(t); setEditando(null); }} etiquetaDe={(t) => (t === 'Gasto' ? 'Gastos' : 'Ingresos')} />
        <Text style={[texto.nota, { marginBottom: espacio.m }]}>
          Toca una categoría para cambiar su nombre, ícono o color, ocultarla o borrarla. Las ocultas no aparecen al registrar, pero conservan sus movimientos.
        </Text>

        {(errorCarga || error) && <MensajeError>{errorCarga ?? error}</MensajeError>}
        {categorias && delTipo.length === 0 && <Vacio>No tienes categorías de este tipo.</Vacio>}

        {delTipo.map((c, i) => (
          <View key={c.id} style={estilos.fila}>
            {editando === c.id ? (
              <View style={{ flex: 1, paddingVertical: espacio.s }}>
                <Campo etiqueta="Nombre" value={nombreEditado} onChangeText={setNombreEditado} maxLength={40} />
                <Text style={estilos.etiqueta}>Ícono</Text>
                <View style={estilos.rejilla}>
                  {[null, ...ICONOS_CATEGORIAS].map((icono) => (
                    <Pressable
                      key={icono ?? 'inicial'}
                      onPress={() => setIconoEditado(icono)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: iconoEditado === icono }}
                      accessibilityLabel={icono ?? 'Inicial del nombre'}
                      style={[estilos.celda, iconoEditado === icono && estilos.celdaActiva]}
                    >
                      <IconoCategoria categoria={{ nombre: nombreEditado || c.nombre, icono, color: colorEditado }} tamano={32} />
                    </Pressable>
                  ))}
                </View>
                <Text style={estilos.etiqueta}>Color</Text>
                <View style={[estilos.rejilla, { marginBottom: espacio.l }]}>
                  {[null, ...PALETA_CATEGORIAS].map((color) => (
                    <Pressable
                      key={color ?? 'sin-color'}
                      onPress={() => setColorEditado(color)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: colorEditado === color }}
                      accessibilityLabel={color ? `Color ${NOMBRES_COLOR[color] ?? color}` : 'Sin color'}
                      style={[estilos.celda, colorEditado === color && estilos.celdaActiva]}
                    >
                      <View style={[estilos.muestra, { backgroundColor: color ?? GRIS_CATEGORIA }]} />
                    </Pressable>
                  ))}
                </View>
                <View style={estilos.acciones}>
                  <Boton titulo="Guardar" onPress={() => guardarEdicion(c)} deshabilitado={ocupado} estilo={{ flex: 1 }} />
                  <Boton titulo="Cancelar" variante="secundario" onPress={() => setEditando(null)} estilo={{ flex: 1 }} />
                </View>
                <View style={[estilos.acciones, { marginTop: espacio.s }]}>
                  <Boton
                    titulo={c.activa === false ? 'Mostrar' : 'Ocultar'}
                    variante="secundario"
                    onPress={() => ejecutar(() => actualizarCategoria(c.id, { activa: c.activa === false }))}
                    deshabilitado={ocupado}
                    estilo={{ flex: 1 }}
                  />
                  <Boton titulo="Borrar" variante="peligro" onPress={() => borrar(c)} deshabilitado={ocupado} estilo={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <>
                <Pressable style={estilos.nombre} onPress={() => empezarEdicion(c)} accessibilityRole="button">
                  <IconoCategoria categoria={c} />
                  <View style={{ flex: 1 }}>
                    <Text style={[texto.cuerpo, c.activa === false && estilos.oculta]}>{c.nombre}</Text>
                    {c.activa === false && <Text style={texto.nota}>Oculta</Text>}
                  </View>
                </Pressable>
                <Flecha texto="↑" deshabilitada={ocupado || i === 0} onPress={() => mover(c, -1)} etiqueta={`Subir ${c.nombre}`} />
                <Flecha texto="↓" deshabilitada={ocupado || i === delTipo.length - 1} onPress={() => mover(c, 1)} etiqueta={`Bajar ${c.nombre}`} />
              </>
            )}
          </View>
        ))}

        <Text style={[texto.seccion, { marginTop: espacio.xl, marginBottom: espacio.s }]}>
          Nueva categoría de {tipo === 'Gasto' ? 'gasto' : 'ingreso'}
        </Text>
        <Campo
          etiqueta="Nombre"
          value={nueva}
          onChangeText={setNueva}
          placeholder={tipo === 'Gasto' ? 'Ej. Mascotas' : 'Ej. Freelance'}
          maxLength={40}
          ayuda={problemaNueva ?? undefined}
          onSubmitEditing={agregar}
        />
        <Boton titulo="Agregar" onPress={agregar} deshabilitado={ocupado || !nueva.trim() || !!problemaNueva} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Flecha({ texto: t, onPress, deshabilitada, etiqueta }: { texto: string; onPress: () => void; deshabilitada: boolean; etiqueta: string }) {
  return (
    <Pressable onPress={onPress} disabled={deshabilitada} hitSlop={6} accessibilityLabel={etiqueta} style={[estilos.flecha, deshabilitada && { opacity: 0.25 }]}>
      <Text style={estilos.flechaTexto}>{t}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: 48 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.linea },
  nombre: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.m },
  oculta: { color: colores.tintaSuave, textDecorationLine: 'line-through' },
  etiqueta: { fontSize: 13, fontWeight: '600', color: colores.tintaSuave, marginBottom: 6 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs, marginBottom: espacio.m },
  celda: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  celdaActiva: { borderColor: colores.tinta },
  muestra: { width: 28, height: 28, borderRadius: 14 },
  acciones: { flexDirection: 'row', gap: espacio.s },
  flecha: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colores.hoja, borderWidth: 1, borderColor: colores.linea },
  flechaTexto: { fontSize: 16, color: colores.verde, fontWeight: '700' },
});
