import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { enMes, type Movimiento } from '@/domain/finanzas';
import { buscarMovimientos } from '@/domain/busqueda';
import { aplicarRecurrentes, cargarCategorias, cargarMovimientosDelAnio } from '@/lib/datos';
import { aPesos, fechaLegible } from '@/lib/formato';
import { usePeriodo } from '@/lib/periodo';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, BotonFlotante, contenidoPantalla, EncabezadoSeccion, IconoCategoria, MensajeError, Opciones, Pantalla, Renglon, Vacio } from '@/components/ui';

const FILTROS = ['Todos', 'Gastos', 'Ingresos'] as const;

export default function Movimientos() {
  const router = useRouter();
  const { anio, mes } = usePeriodo();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('Todos');
  const [consulta, setConsulta] = useState('');
  const buscando = consulta.trim().length > 0;

  const { datos, error } = useCarga(async () => {
    await aplicarRecurrentes();
    const [categorias, movimientos] = await Promise.all([cargarCategorias({ todas: true }), cargarMovimientosDelAnio(anio)]);
    return { categorias: new Map(categorias.map((c) => [c.id, c])), movimientos };
  }, [anio]);

  // Al buscar se recorre todo el año, no solo el mes elegido.
  const delMes = buscarMovimientos(
    (datos?.movimientos ?? [])
      .filter((m) => buscando || enMes(m.fecha, anio, mes))
      .filter((m) => filtro === 'Todos' || (filtro === 'Gastos' ? m.tipo === 'Gasto' : m.tipo === 'Ingreso')),
    consulta,
    (id) => datos?.categorias.get(id)?.nombre ?? '',
  );
  const totalBusqueda = delMes.reduce((s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe), 0);

  // Agrupa por día, del más reciente al más antiguo
  const porDia = new Map<string, Movimiento[]>();
  for (const m of delMes) porDia.set(m.fecha, [...(porDia.get(m.fecha) ?? []), m]);
  const secciones = [...porDia].map(([fecha, data]) => ({
    fecha,
    neto: data.reduce((s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe), 0),
    data,
  }));

  function renglon(m: Movimiento) {
    const cat = datos!.categorias.get(m.categoria_id);
    const categoria = cat?.nombre ?? '';
    const detalle = [m.descripcion ? categoria : null, m.medio_pago, m.cuenta].filter(Boolean).join(', ');
    return (
      <Renglon
        icono={cat && <IconoCategoria categoria={cat} />}
        izquierda={m.descripcion || categoria}
        detalle={detalle}
        derecha={(m.tipo === 'Gasto' ? '−' : '+') + aPesos(m.importe)}
        derechaColor={m.tipo === 'Gasto' ? colores.tinta : colores.verde}
        aviso={
          m.por_revisar
            ? 'Por revisar: elige su categoría'
            : m.compra_msi_id
              ? 'Mensualidad a meses sin intereses'
              : m.recurrente_id
                ? 'Fijo mensual'
                : undefined
        }
        onPress={() => router.push({ pathname: '/movimiento', params: { id: m.id } })}
      />
    );
  }

  return (
    <Pantalla titulo="Movimientos" lista pie={<BotonFlotante titulo="+ Registrar" onPress={() => router.push('/movimiento')} />}>
      {/* Virtualizada: una búsqueda recorre todo el año y puede traer miles de movimientos. */}
      <SectionList
        sections={secciones}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => renglon(item)}
        renderSectionHeader={({ section }) => (
          <View style={{ marginTop: espacio.xl, backgroundColor: colores.papel }}>
            <EncabezadoSeccion
              titulo={fechaLegible(section.fecha)}
              accion={<Text style={[texto.nota, { fontVariant: ['tabular-nums'] }]}>{aPesos(section.neto)}</Text>}
            />
          </View>
        )}
        stickySectionHeadersEnabled={false}
        initialNumToRender={25}
        contentContainerStyle={contenidoPantalla}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {error && <MensajeError>{error}</MensajeError>}
            <View style={estilos.buscador}>
              <TextInput
                value={consulta}
                onChangeText={setConsulta}
                placeholder="Buscar comercio, categoría o monto"
                placeholderTextColor={colores.tintaSuave}
                style={estilos.buscadorTexto}
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel="Buscar movimientos"
              />
              {buscando && (
                <Pressable onPress={() => setConsulta('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
                  <Text style={{ color: colores.tintaSuave, fontSize: 16 }}>✕</Text>
                </Pressable>
              )}
            </View>
            {buscando && datos && (
              <Text style={[texto.nota, { marginTop: espacio.s }]}>
                {delMes.length === 1 ? '1 resultado' : `${delMes.length} resultados`} en {anio} · neto {aPesos(totalBusqueda)}
              </Text>
            )}

            <View style={{ marginTop: espacio.s }}>
              <Opciones opciones={FILTROS} valor={filtro} onCambio={setFiltro} />
            </View>

            <View style={estilos.acciones}>
              <Boton titulo="Cargar estado PDF" variante="secundario" onPress={() => router.push('/importar-estado')} estilo={{ flex: 1 }} />
              <Boton titulo="Meses sin intereses" variante="secundario" onPress={() => router.push('/msi')} estilo={{ flex: 1 }} />
            </View>

            {datos && buscando && delMes.length === 0 && <Vacio>Nada coincide con «{consulta.trim()}» en {anio}.</Vacio>}
            {datos && !buscando && delMes.length === 0 && (
              <Vacio>No hay movimientos en este mes. Registra tu primer gasto o ingreso con el botón de abajo.</Vacio>
            )}
          </>
        }
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    marginTop: espacio.m,
    paddingHorizontal: espacio.m,
    backgroundColor: colores.hoja,
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: 10,
  },
  acciones: { flexDirection: 'row', gap: espacio.s },
  buscadorTexto: { flex: 1, paddingVertical: 10, fontSize: 15, color: colores.tinta },
});
