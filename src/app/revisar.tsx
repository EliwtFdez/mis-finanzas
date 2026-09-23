import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { agruparPorComercio, type GrupoComercio } from '@/domain/revision';
import { cargarCategorias, cargarPorRevisar, marcarRevisados, mensajeError } from '@/lib/datos';
import { aPesos, fechaLegible } from '@/lib/formato';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, MensajeError, Vacio } from '@/components/ui';

export default function Revisar() {
  const router = useRouter();
  const { datos, error: errorCarga, recargar } = useCarga(async () => {
    const [categorias, pendientes] = await Promise.all([cargarCategorias(), cargarPorRevisar()]);
    return { categorias: categorias.filter((c) => c.tipo === 'Gasto'), grupos: agruparPorComercio(pendientes) };
  }, []);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolver(grupo: GrupoComercio, categoriaId: string | null) {
    setOcupado(grupo.clave);
    setError(null);
    try {
      await marcarRevisados(grupo.movimientos.map((m) => m.id), categoriaId);
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colores.papel }}>
      <Stack.Screen options={{ title: 'Gastos por revisar' }} />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={texto.nota}>
          Pagos de Apple Pay en comercios nuevos. Elige su categoría: se aplica a todos los pagos del mismo comercio y la app la recordará
          para los siguientes.
        </Text>
        {(errorCarga || error) && <MensajeError>{errorCarga ?? error}</MensajeError>}

        {datos && datos.grupos.length === 0 && (
          <>
            <Vacio>No tienes gastos por revisar.</Vacio>
            <Boton titulo="Listo" variante="secundario" onPress={() => router.back()} />
          </>
        )}

        {datos?.grupos.map((g) => {
          const actual = datos.categorias.find((c) => c.id === g.movimientos[0].categoria_id);
          return (
            <View key={g.clave} style={[estilos.grupo, ocupado === g.clave && { opacity: 0.5 }]}>
              <View style={estilos.encabezado}>
                <View style={{ flex: 1 }}>
                  <Text style={texto.seccion}>{g.descripcion}</Text>
                  <Text style={[texto.nota, { marginTop: 2 }]}>
                    {g.movimientos.length === 1
                      ? `${fechaLegible(g.movimientos[0].fecha)}${g.movimientos[0].cuenta ? ` · ${g.movimientos[0].cuenta}` : ''}`
                      : `${g.movimientos.length} pagos`}
                  </Text>
                </View>
                <Text style={[texto.cifra, { fontWeight: '700' }]}>{aPesos(g.total)}</Text>
              </View>
              <View style={estilos.chips}>
                {datos.categorias.map((c) => (
                  <Pressable
                    key={c.id}
                    disabled={!!ocupado}
                    onPress={() => resolver(g, c.id)}
                    style={({ pressed }) => [estilos.chip, pressed && { backgroundColor: colores.verdeClaro }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${g.descripcion}: ${c.nombre}`}
                  >
                    <Text style={estilos.chipTexto}>{c.nombre}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable disabled={!!ocupado} onPress={() => resolver(g, null)} hitSlop={6}>
                <Text style={estilos.dejar}>Dejar en {actual?.nombre ?? 'su categoría actual'}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: 48 },
  grupo: { marginTop: espacio.l, padding: espacio.l, backgroundColor: colores.hoja, borderRadius: 10, borderWidth: 1, borderColor: colores.linea },
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginTop: espacio.m },
  chip: { paddingHorizontal: espacio.m, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.papel },
  chipTexto: { fontSize: 13, color: colores.tinta, fontWeight: '600' },
  dejar: { marginTop: espacio.m, color: colores.verde, fontSize: 13, fontWeight: '700' },
});
