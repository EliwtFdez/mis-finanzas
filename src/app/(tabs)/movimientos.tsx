import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { enMes, type Movimiento } from '@/domain/finanzas';
import { buscarMovimientos } from '@/domain/busqueda';
import { cargarCategorias, cargarMovimientosDelAnio } from '@/lib/datos';
import { aPesos, fechaLegible } from '@/lib/formato';
import { usePeriodo } from '@/lib/periodo';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, BotonFlotante, MensajeError, Opciones, Pantalla, Renglon, Seccion, Vacio } from '@/components/ui';

const FILTROS = ['Todos', 'Gastos', 'Ingresos'] as const;

export default function Movimientos() {
  const router = useRouter();
  const { anio, mes } = usePeriodo();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('Todos');
  const [consulta, setConsulta] = useState('');
  const buscando = consulta.trim().length > 0;

  const { datos, error } = useCarga(async () => {
    const [categorias, movimientos] = await Promise.all([cargarCategorias({ todas: true }), cargarMovimientosDelAnio(anio)]);
    return { categorias: new Map(categorias.map((c) => [c.id, c.nombre])), movimientos };
  }, [anio]);

  // Al buscar se recorre todo el año, no solo el mes elegido.
  const delMes = buscarMovimientos(
    (datos?.movimientos ?? [])
      .filter((m) => buscando || enMes(m.fecha, anio, mes))
      .filter((m) => filtro === 'Todos' || (filtro === 'Gastos' ? m.tipo === 'Gasto' : m.tipo === 'Ingreso')),
    consulta,
    (id) => datos?.categorias.get(id) ?? '',
  );
  const totalBusqueda = delMes.reduce((s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe), 0);

  // Agrupa por día, del más reciente al más antiguo
  const porDia = new Map<string, Movimiento[]>();
  for (const m of delMes) porDia.set(m.fecha, [...(porDia.get(m.fecha) ?? []), m]);

  return (
    <Pantalla titulo="Movimientos" pie={<BotonFlotante titulo="+ Registrar" onPress={() => router.push('/movimiento')} />}>
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

      <Boton
        titulo="Cargar estado de cuenta PDF"
        variante="secundario"
        onPress={() => router.push('/importar-estado')}
      />

      {datos && buscando && delMes.length === 0 && <Vacio>Nada coincide con «{consulta.trim()}» en {anio}.</Vacio>}
      {datos && !buscando && delMes.length === 0 && (
        <Vacio>No hay movimientos en este mes. Registra tu primer gasto o ingreso con el botón de abajo.</Vacio>
      )}

      {[...porDia.entries()].map(([fecha, lista]) => {
        const neto = lista.reduce((s, m) => s + (m.tipo === 'Ingreso' ? m.importe : -m.importe), 0);
        return (
          <Seccion
            key={fecha}
            titulo={fechaLegible(fecha)}
            accion={<Text style={[texto.nota, { fontVariant: ['tabular-nums'] }]}>{aPesos(neto)}</Text>}
          >
            {lista.map((m) => {
              const categoria = datos!.categorias.get(m.categoria_id) ?? '';
              const detalle = [m.descripcion ? categoria : null, m.medio_pago, m.cuenta].filter(Boolean).join(', ');
              return (
                <Renglon
                  key={m.id}
                  izquierda={m.descripcion || categoria}
                  detalle={detalle}
                  derecha={(m.tipo === 'Gasto' ? '−' : '+') + aPesos(m.importe)}
                  derechaColor={m.tipo === 'Gasto' ? colores.tinta : colores.verde}
                  aviso={m.por_revisar ? 'Por revisar: elige su categoría' : undefined}
                  onPress={() => router.push({ pathname: '/movimiento', params: { id: m.id } })}
                />
              );
            })}
          </Seccion>
        );
      })}
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
  buscadorTexto: { flex: 1, paddingVertical: 10, fontSize: 15, color: colores.tinta },
});
