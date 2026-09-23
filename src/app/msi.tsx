import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { etiquetaCategoria } from '@/domain/categorias';
import { calendarioMsi, estadoMsi, type EstadoCompraMsi } from '@/domain/msi';
import { borrarCompraMsi, cargarCategorias, cargarComprasMsi, crearCompraMsi, mensajeError } from '@/lib/datos';
import { aPesos, fechaLegible, hoy, leerNumero } from '@/lib/formato';
import { avisarPresupuesto } from '@/lib/notificaciones';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Barra, Boton, Campo, CampoFecha, Cifra, MensajeError, Opciones, Renglon, Seccion, Vacio } from '@/components/ui';

const PLAZOS = ['3', '6', '9', '12', '18', '24'] as const;

export default function MesesSinIntereses() {
  const { datos, error: errorCarga, recargar } = useCarga(async () => {
    const [categorias, compras] = await Promise.all([cargarCategorias(), cargarComprasMsi()]);
    return { categorias: categorias.filter((c) => c.tipo === 'Gasto'), resumen: estadoMsi(compras, hoy()) };
  }, []);

  const [formulario, setFormulario] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [importe, setImporte] = useState('');
  const [plazo, setPlazo] = useState<(typeof PLAZOS)[number]>('12');
  const [fecha, setFecha] = useState(hoy());
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = leerNumero(importe);
  const meses = Number(plazo);
  const vista = total && total > 0 ? calendarioMsi(fecha, total, meses) : null;
  const categoriaElegida = categoriaId ?? datos?.categorias.find((c) => c.nombre === 'Compras')?.id ?? null;
  const faltante = !descripcion.trim()
    ? 'Escribe qué compraste.'
    : !total || total <= 0
      ? 'Escribe el importe total.'
      : !categoriaElegida
        ? 'Elige una categoría.'
        : null;

  async function guardar() {
    if (faltante) return setError(faltante);
    setGuardando(true);
    setError(null);
    try {
      const primerPago = await crearCompraMsi({
        fecha,
        descripcion: descripcion.trim(),
        importe_total: total!,
        meses,
        categoria_id: categoriaElegida!,
        cuenta: cuenta.trim() || null,
      });
      // La primera mensualidad es un gasto de este mes: puede cruzar un presupuesto.
      if (primerPago) avisarPresupuesto(primerPago, fecha);
      setFormulario(false);
      setDescripcion('');
      setImporte('');
      setCuenta('');
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  function borrar(e: EstadoCompraMsi) {
    Alert.alert('Borrar compra', `Se borrarán «${e.compra.descripcion}» y sus ${e.compra.pagos.length} mensualidades, incluidas las ya pagadas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await borrarCompraMsi(e.compra.id);
            recargar();
          } catch (err) {
            setError(mensajeError(err));
          }
        },
      },
    ]);
  }

  const r = datos?.resumen;
  const activas = r?.estados.filter((e) => !e.terminada) ?? [];
  const terminadas = r?.estados.filter((e) => e.terminada) ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colores.papel }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Meses sin intereses' }} />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text style={texto.nota}>
          Registra la compra una vez: la app crea una mensualidad en cada mes, así tu presupuesto cuenta solo lo que te toca pagar.
        </Text>
        {(errorCarga || error) && <MensajeError>{errorCarga ?? error}</MensajeError>}

        {r && (
          <View style={estilos.totales}>
            <Cifra etiqueta="Este mes" valor={r.esteMes} />
            <Cifra etiqueta="Por pagar" valor={r.deudaRestante} />
          </View>
        )}

        {!formulario ? (
          <Boton titulo="+ Nueva compra a meses" onPress={() => setFormulario(true)} estilo={{ marginTop: espacio.m }} />
        ) : (
          <View style={estilos.formulario}>
            <Campo etiqueta="¿Qué compraste?" value={descripcion} onChangeText={setDescripcion} placeholder="Ej. Laptop" autoFocus />
            <Campo etiqueta="Importe total en MXN" value={importe} onChangeText={setImporte} keyboardType="decimal-pad" placeholder="0.00" />
            <Opciones etiqueta="Meses" opciones={PLAZOS} valor={plazo} onCambio={setPlazo} />
            <CampoFecha etiqueta="Fecha de compra" valor={fecha} onCambio={setFecha} />
            {datos && (
              <Opciones
                etiqueta="Categoría"
                opciones={datos.categorias.map((c) => c.id)}
                valor={categoriaElegida}
                onCambio={setCategoriaId}
                etiquetaDe={(id) => { const c = datos.categorias.find((x) => x.id === id); return c ? etiquetaCategoria(c) : ''; }}
              />
            )}
            <Campo etiqueta="Tarjeta" value={cuenta} onChangeText={setCuenta} placeholder="Ej. BBVA Azul" />
            {vista && (
              <Text style={[texto.nota, estilos.vista]}>
                {meses} pagos de {aPesos(vista[0].importe)}
                {vista.at(-1)!.importe !== vista[0].importe ? ` (el último de ${aPesos(vista.at(-1)!.importe)})` : ''}, de{' '}
                {fechaLegible(vista[0].fecha, true)} a {fechaLegible(vista.at(-1)!.fecha, true)}.
              </Text>
            )}
            <Boton titulo={guardando ? 'Guardando…' : 'Guardar compra'} onPress={guardar} deshabilitado={guardando || !!faltante} />
            <Boton titulo="Cancelar" variante="secundario" onPress={() => setFormulario(false)} estilo={{ marginTop: espacio.s }} />
          </View>
        )}

        <Seccion titulo="En curso">
          {r && activas.length === 0 && <Vacio>No tienes compras a meses pendientes.</Vacio>}
          {activas.map((e) => (
            <View key={e.compra.id} style={estilos.compra}>
              <Renglon
                izquierda={e.compra.descripcion}
                detalle={`${e.pagados} de ${e.compra.pagos.length} pagos · ${aPesos(e.mensualidad)} al mes${e.compra.cuenta ? ` · ${e.compra.cuenta}` : ''}`}
                derecha={aPesos(e.montoRestante)}
                aviso={e.ultimaFecha ? `Te faltan ${e.restantes} ${e.restantes === 1 ? 'pago' : 'pagos'}; el último es el ${fechaLegible(e.ultimaFecha, true)}.` : undefined}
                onPress={() => borrar(e)}
              />
              <Barra valor={e.pagados} maximo={Math.max(1, e.compra.pagos.length)} />
            </View>
          ))}
        </Seccion>

        {terminadas.length > 0 && (
          <Seccion titulo="Liquidadas">
            {terminadas.map((e) => (
              <Renglon
                key={e.compra.id}
                izquierda={e.compra.descripcion}
                detalle={`${e.compra.meses} meses · desde ${fechaLegible(e.compra.fecha, true)}`}
                derecha={aPesos(e.compra.importe_total)}
                onPress={() => borrar(e)}
              />
            ))}
          </Seccion>
        )}
        {r && r.estados.length > 0 && <Text style={[texto.nota, { marginTop: espacio.l }]}>Toca una compra para borrarla con todas sus mensualidades.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: 48 },
  totales: { flexDirection: 'row', gap: espacio.l, paddingVertical: espacio.l },
  formulario: { marginTop: espacio.m, padding: espacio.l, backgroundColor: colores.hoja, borderRadius: 10, borderWidth: 1, borderColor: colores.linea },
  vista: { marginBottom: espacio.l, backgroundColor: colores.verdeClaro, padding: espacio.s },
  compra: { paddingBottom: espacio.s },
});
