import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { estadoMetas, ICONOS_METAS, type EstadoMeta } from '@/domain/metas';
import { aportarAMeta, borrarMeta, cargarMetas, guardarMeta, mensajeError } from '@/lib/datos';
import { aPesos, fechaLegible, hoy, leerNumero } from '@/lib/formato';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Barra, Boton, Campo, CampoFecha, IconoCategoria, MensajeError, Opciones, Seccion, Vacio } from '@/components/ui';

const PLAZO = ['Sin fecha', 'Con fecha'] as const;

export default function Metas() {
  const { datos, error: errorCarga, recargar } = useCarga(async () => {
    const { metas, aportaciones } = await cargarMetas();
    return { estados: estadoMetas(metas, aportaciones, hoy()), aportaciones };
  }, []);

  // Formulario de meta: null = cerrado, '' = nueva, id = editando
  const [formulario, setFormulario] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [plazo, setPlazo] = useState<(typeof PLAZO)[number]>('Sin fecha');
  const [fechaLimite, setFechaLimite] = useState(hoy());
  const [icono, setIcono] = useState<string | null>(ICONOS_METAS[0]);

  const [abierta, setAbierta] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function abrirFormulario(e?: EstadoMeta) {
    setFormulario(e?.meta.id ?? '');
    setNombre(e?.meta.nombre ?? '');
    setObjetivo(e ? String(e.meta.objetivo) : '');
    setPlazo(e?.meta.fecha_limite ? 'Con fecha' : 'Sin fecha');
    setFechaLimite(e?.meta.fecha_limite ?? hoy());
    setIcono(e ? e.meta.icono : ICONOS_METAS[0]);
    setError(null);
  }

  const meta = leerNumero(objetivo);
  const faltante = !nombre.trim() ? 'Escribe para qué ahorras.' : !meta || meta <= 0 ? 'Escribe cuánto quieres juntar.' : null;

  async function guardar() {
    if (faltante) return setError(faltante);
    const datosMeta = { nombre, objetivo: meta!, fecha_limite: plazo === 'Con fecha' ? fechaLimite : null, icono };
    if (await ejecutar(() => guardarMeta(datosMeta, formulario || undefined))) setFormulario(null);
  }

  async function mover(e: EstadoMeta, signo: 1 | -1) {
    const importe = leerNumero(monto);
    if (!importe || importe <= 0) return setError('Escribe un monto mayor que cero.');
    if (await ejecutar(() => aportarAMeta(e.meta.id, signo * importe, hoy()))) setMonto('');
  }

  function borrar(e: EstadoMeta) {
    Alert.alert('Borrar meta', `¿Borrar «${e.meta.nombre}» y su historial de aportaciones? El dinero no se mueve, solo el registro.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => ejecutar(() => borrarMeta(e.meta.id)) },
    ]);
  }

  const pendientes = datos?.estados.filter((e) => !e.completada) ?? [];
  const completadas = datos?.estados.filter((e) => e.completada) ?? [];

  // Función y no componente: un componente declarado aquí se volvería a montar en cada tecla y cerraría el teclado.
  function tarjeta(e: EstadoMeta) {
    const estaAbierta = abierta === e.meta.id;
    const historial = estaAbierta ? datos!.aportaciones.filter((a) => a.meta_id === e.meta.id).slice(0, 5) : [];
    return (
      <View key={e.meta.id} style={estilos.tarjeta}>
        <Pressable
          onPress={() => {
            setAbierta(estaAbierta ? null : e.meta.id);
            setMonto('');
            setError(null);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: estaAbierta }}
          style={{ gap: 6 }}
        >
          <View style={estilos.encabezado}>
            <IconoCategoria categoria={{ nombre: e.meta.nombre, icono: e.meta.icono, color: colores.verde }} />
            <Text style={[texto.cuerpo, { flex: 1, fontWeight: '600' }]} numberOfLines={1}>
              {e.meta.nombre}
            </Text>
            <Text style={texto.cifra}>
              {aPesos(e.ahorrado)}
              <Text style={texto.nota}> / {aPesos(e.meta.objetivo)}</Text>
            </Text>
          </View>
          <Barra valor={e.ahorrado} maximo={e.meta.objetivo} />
          <Text style={[texto.nota, e.vencida && { color: colores.rojo }]}>
            {e.completada
              ? '¡Meta cumplida!'
              : e.vencida
                ? `La fecha límite pasó el ${fechaLegible(e.meta.fecha_limite!, true)}; faltan ${aPesos(e.falta)}.`
                : e.alMes !== null
                  ? `Aparta ${aPesos(e.alMes)} al mes hasta el ${fechaLegible(e.meta.fecha_limite!, true)}.`
                  : `Faltan ${aPesos(e.falta)}.`}
          </Text>
        </Pressable>

        {estaAbierta && (
          <View style={estilos.detalle}>
            <Campo etiqueta="Monto" value={monto} onChangeText={setMonto} keyboardType="decimal-pad" placeholder="0.00" autoFocus />
            <View style={estilos.fila}>
              <Boton titulo="Aportar" onPress={() => mover(e, 1)} deshabilitado={ocupado} estilo={{ flex: 1 }} />
              <Boton titulo="Retirar" variante="secundario" onPress={() => mover(e, -1)} deshabilitado={ocupado || e.ahorrado <= 0} estilo={{ flex: 1 }} />
            </View>
            {historial.map((a) => (
              <View key={a.id} style={estilos.movimiento}>
                <Text style={texto.nota}>{fechaLegible(a.fecha, true)}</Text>
                <Text style={[texto.cifra, { fontSize: 14, color: a.importe < 0 ? colores.tinta : colores.verde }]}>
                  {a.importe < 0 ? '−' : '+'}
                  {aPesos(Math.abs(a.importe))}
                </Text>
              </View>
            ))}
            <View style={[estilos.fila, { marginTop: espacio.m }]}>
              <Boton titulo="Editar meta" variante="secundario" onPress={() => abrirFormulario(e)} estilo={{ flex: 1 }} />
              <Boton titulo="Borrar" variante="peligro" onPress={() => borrar(e)} estilo={{ flex: 1 }} />
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colores.papel }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Metas de ahorro' }} />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={texto.nota}>Aparta dinero para algo concreto. Las aportaciones no cuentan como gasto ni mueven tu presupuesto.</Text>
        {(errorCarga || error) && <MensajeError>{errorCarga ?? error}</MensajeError>}

        {formulario === null ? (
          <Boton titulo="+ Nueva meta" onPress={() => abrirFormulario()} estilo={{ marginTop: espacio.l }} />
        ) : (
          <View style={estilos.formulario}>
            <Campo etiqueta="¿Para qué ahorras?" value={nombre} onChangeText={setNombre} placeholder="Ej. Fondo de emergencia" maxLength={60} autoFocus={!formulario} />
            <Campo etiqueta="Cuánto quieres juntar (MXN)" value={objetivo} onChangeText={setObjetivo} keyboardType="decimal-pad" placeholder="0.00" />
            <Opciones etiqueta="Fecha límite" opciones={PLAZO} valor={plazo} onCambio={setPlazo} />
            {plazo === 'Con fecha' && <CampoFecha etiqueta="Quiero tenerlo el" valor={fechaLimite} onCambio={setFechaLimite} />}
            <View style={[estilos.iconos, { marginBottom: espacio.l }]}>
              {ICONOS_METAS.map((i) => (
                <Pressable
                  key={i}
                  onPress={() => setIcono(i)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: icono === i }}
                  accessibilityLabel={i}
                  style={[estilos.celda, icono === i && estilos.celdaActiva]}
                >
                  <Text style={{ fontSize: 20 }}>{i}</Text>
                </Pressable>
              ))}
            </View>
            <Boton titulo={formulario ? 'Guardar cambios' : 'Crear meta'} onPress={guardar} deshabilitado={ocupado || !!faltante} />
            <Boton titulo="Cancelar" variante="secundario" onPress={() => setFormulario(null)} estilo={{ marginTop: espacio.s }} />
          </View>
        )}

        <Seccion titulo="En progreso">
          {datos && pendientes.length === 0 && <Vacio>No tienes metas pendientes.</Vacio>}
          {pendientes.map(tarjeta)}
        </Seccion>

        {completadas.length > 0 && (
          <Seccion titulo="Cumplidas">
            {completadas.map(tarjeta)}
          </Seccion>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: 48 },
  formulario: { marginTop: espacio.l, padding: espacio.l, backgroundColor: colores.hoja, borderRadius: 10, borderWidth: 1, borderColor: colores.linea },
  tarjeta: { paddingVertical: espacio.m, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.linea },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  detalle: { marginTop: espacio.m },
  fila: { flexDirection: 'row', gap: espacio.s },
  movimiento: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  iconos: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
  celda: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  celdaActiva: { borderColor: colores.tinta },
});
