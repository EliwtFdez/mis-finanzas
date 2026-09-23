import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { enMes, type Movimiento } from '@/domain/finanzas';
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

  const { datos, error } = useCarga(async () => {
    const [categorias, movimientos] = await Promise.all([cargarCategorias({ todas: true }), cargarMovimientosDelAnio(anio)]);
    return { categorias: new Map(categorias.map((c) => [c.id, c.nombre])), movimientos };
  }, [anio]);

  const delMes = (datos?.movimientos ?? [])
    .filter((m) => enMes(m.fecha, anio, mes))
    .filter((m) => filtro === 'Todos' || (filtro === 'Gastos' ? m.tipo === 'Gasto' : m.tipo === 'Ingreso'));

  // Agrupa por día, del más reciente al más antiguo
  const porDia = new Map<string, Movimiento[]>();
  for (const m of delMes) porDia.set(m.fecha, [...(porDia.get(m.fecha) ?? []), m]);

  return (
    <Pantalla titulo="Movimientos" pie={<BotonFlotante titulo="+ Registrar" onPress={() => router.push('/movimiento')} />}>
      {error && <MensajeError>{error}</MensajeError>}
      <View style={{ marginTop: espacio.s }}>
        <Opciones opciones={FILTROS} valor={filtro} onCambio={setFiltro} />
      </View>

      <Boton
        titulo="Cargar estado de cuenta PDF"
        variante="secundario"
        onPress={() => router.push('/importar-estado')}
      />

      {datos && delMes.length === 0 && (
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
