import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { calcularCartera, resumenAnual, resumenMes } from '@/domain/finanzas';
import { cargarCategorias, cargarMovimientosDelAnio, cargarOperaciones, cargarPresupuestos, contarPorRevisar } from '@/lib/datos';
import { aPesos, aPesosCortos, MESES_CORTOS } from '@/lib/formato';
import { usePeriodo } from '@/lib/periodo';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Barra, BotonFlotante, Cifra, MensajeError, Pantalla, Renglon, Seccion, Vacio } from '@/components/ui';

export default function Resumen() {
  const router = useRouter();
  const { anio, mes } = usePeriodo();

  const { datos, error } = useCarga(async () => {
    const [categorias, movimientos, operaciones, presupuestos, porRevisar] = await Promise.all([
      cargarCategorias({ todas: true }),
      cargarMovimientosDelAnio(anio),
      cargarOperaciones(),
      cargarPresupuestos(anio, mes),
      contarPorRevisar().catch(() => 0),
    ]);
    const cartera = calcularCartera(operaciones);
    return {
      mesActual: resumenMes({ anio, mes, movimientos, categorias, presupuestos, operaciones: cartera.operaciones }),
      anual: resumenAnual(anio, movimientos),
      porRevisar,
    };
  }, [anio, mes]);

  const r = datos?.mesActual;
  const lineas = r?.porCategoria.filter((l) => l.gastado > 0 || l.presupuesto !== null) ?? [];
  const hayAcciones = !!r && (r.comprasAcciones > 0 || r.ventasAcciones > 0);
  const maxAnual = Math.max(1, ...(datos?.anual.flatMap((m) => [m.ingresos, m.gastos]) ?? [1]));

  return (
    <Pantalla titulo="Resumen" pie={<BotonFlotante titulo="+ Registrar" onPress={() => router.push('/movimiento')} />}>
      {error && <MensajeError>{error}</MensajeError>}

      {!!datos?.porRevisar && (
        <Pressable onPress={() => router.push('/revisar')} style={estilos.aviso} accessibilityRole="button">
          <Text style={estilos.avisoTexto}>
            {datos.porRevisar === 1 ? '1 gasto de Apple Pay por revisar' : `${datos.porRevisar} gastos de Apple Pay por revisar`}
          </Text>
          <Text style={estilos.avisoTexto}>›</Text>
        </Pressable>
      )}

      {r && (
        <>
          {/* Lo más importante del mes: cuánto queda del presupuesto */}
          <View style={estilos.cabeza}>
            {r.presupuesto !== null ? (
              <>
                <Text style={texto.nota}>{r.presupuestoRestante! >= 0 ? 'Te queda del presupuesto' : 'Te pasaste del presupuesto por'}</Text>
                <Text style={[texto.cifraGrande, { color: r.presupuestoRestante! >= 0 ? colores.tinta : colores.rojo }]}>
                  {aPesos(Math.abs(r.presupuestoRestante!))}
                </Text>
                <View style={{ marginTop: espacio.m }}>
                  <Barra valor={r.gastos} maximo={r.presupuesto} alto={10} />
                </View>
                <Text style={[texto.nota, { marginTop: espacio.s }]}>
                  Gastado {aPesos(r.gastos)} de {aPesos(r.presupuesto)}
                </Text>
              </>
            ) : (
              <>
                <Text style={texto.nota}>Gastado este mes</Text>
                <Text style={texto.cifraGrande}>{aPesos(r.gastos)}</Text>
                <Text style={[texto.nota, { marginTop: espacio.s }]}>
                  Define un presupuesto en la pestaña Presupuesto para ver cuánto te queda.
                </Text>
              </>
            )}
          </View>

          <View style={estilos.tresCifras}>
            <Cifra etiqueta="Ingresos" valor={r.ingresos} />
            <Cifra etiqueta="Gastos" valor={r.gastos} />
            <Cifra etiqueta="Diferencia" valor={r.diferencia} color={r.diferencia < 0 ? colores.rojo : colores.verde} />
          </View>

          <Seccion titulo="Gastos por categoría">
            {lineas.length === 0 && <Vacio>Aún no hay gastos este mes.</Vacio>}
            {lineas.map((l) => {
              const excedido = l.presupuesto !== null && l.gastado > l.presupuesto;
              return (
                <View key={l.categoria.id} style={estilos.categoria}>
                  <View style={estilos.categoriaFila}>
                    <Text style={texto.cuerpo}>{l.categoria.nombre}</Text>
                    <Text style={[texto.cifra, excedido && { color: colores.rojo }]}>
                      {aPesos(l.gastado)}
                      {l.presupuesto !== null && <Text style={texto.nota}> / {aPesosCortos(l.presupuesto)}</Text>}
                    </Text>
                  </View>
                  {l.presupuesto !== null && <Barra valor={l.gastado} maximo={l.presupuesto} />}
                </View>
              );
            })}
          </Seccion>

          {hayAcciones && (
            <Seccion titulo="Acciones este mes">
              <Renglon izquierda="Compras" derecha={aPesos(r.comprasAcciones)} />
              <Renglon izquierda="Ventas" derecha={aPesos(r.ventasAcciones)} />
              <Renglon
                izquierda="Ganancia de ventas"
                detalle="Antes de impuestos"
                derecha={aPesos(r.gananciaVentas)}
                derechaColor={r.gananciaVentas < 0 ? colores.rojo : colores.verde}
              />
            </Seccion>
          )}

          <Seccion titulo={`Año ${anio}`}>
            <View style={estilos.leyenda}>
              <View style={[estilos.punto, { backgroundColor: colores.verde }]} />
              <Text style={texto.nota}>Ingresos</Text>
              <View style={[estilos.punto, { backgroundColor: colores.rojo, marginLeft: espacio.m }]} />
              <Text style={texto.nota}>Gastos</Text>
            </View>
            {datos!.anual.map((m) => (
              <View key={m.mes} style={[estilos.mesFila, m.mes === mes && estilos.mesActual]}>
                <Text style={[texto.nota, { width: 32, color: colores.tinta }]}>{MESES_CORTOS[m.mes - 1]}</Text>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={[estilos.barraMes, { width: `${(m.ingresos / maxAnual) * 100}%`, backgroundColor: colores.verde }]} />
                  <View style={[estilos.barraMes, { width: `${(m.gastos / maxAnual) * 100}%`, backgroundColor: colores.rojo }]} />
                </View>
                <Text style={[texto.cifra, { width: 96, textAlign: 'right', fontSize: 13 }, m.diferencia < 0 && { color: colores.rojo }]}>
                  {m.ingresos || m.gastos ? aPesosCortos(m.diferencia) : '—'}
                </Text>
              </View>
            ))}
          </Seccion>
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: espacio.m,
    padding: espacio.m,
    backgroundColor: colores.ambarClaro,
    borderRadius: 8,
  },
  avisoTexto: { color: colores.tinta, fontWeight: '600', fontSize: 14 },
  cabeza: { paddingVertical: espacio.l },
  tresCifras: {
    flexDirection: 'row',
    gap: espacio.m,
    paddingVertical: espacio.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colores.linea,
  },
  categoria: { paddingVertical: espacio.m, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.linea },
  categoriaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: espacio.s },
  punto: { width: 8, height: 8, borderRadius: 4 },
  mesFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: 6, paddingHorizontal: 4 },
  mesActual: { backgroundColor: colores.verdeClaro },
  barraMes: { height: 5, borderRadius: 3, minWidth: 0 },
});
