import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import type { Categoria, Movimiento } from '@/domain/finanzas';
import { emparejarApplePay, esDuplicado, extraerGastosDeTexto, type GastoExtraido } from '@/domain/estadoCuenta';
import { cargarCategorias, cargarMovimientosDelAnio, guardarMovimientos } from '@/lib/datos';
import { extraerTextoPdf } from '@/lib/lectorPdf';
import { aPesos, fechaLegible } from '@/lib/formato';
import { usePeriodo } from '@/lib/periodo';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, Cargando, MensajeError } from '@/components/ui';

// applePay: pago que parece ser el mismo, ya registrado por el atajo. Se deja sin marcar pero se puede importar.
type Candidato = GastoExtraido & { duplicado: boolean; applePay: Pick<Movimiento, 'fecha' | 'descripcion'> | null };

const importablePorDefecto = (g: Candidato) => !g.duplicado && !g.applePay;

export default function ImportarEstado() {
  const router = useRouter();
  const { anio } = usePeriodo();
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [archivoNombre, setArchivoNombre] = useState('');
  const [paginas, setPaginas] = useState(0);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editandoCategoria, setEditandoCategoria] = useState<string | null>(null);

  useEffect(() => {
    cargarCategorias()
      .then((cs) => setCategorias(cs.filter((c) => c.tipo === 'Gasto')))
      .catch((e: Error) => setError(e.message));
  }, []);

  const ordenados = useMemo(() => {
    const orden = new Map((categorias ?? []).map((c) => [c.id, c.orden]));
    return [...candidatos].sort((a, b) =>
      (orden.get(a.categoria_id) ?? 999) - (orden.get(b.categoria_id) ?? 999)
      || b.importe - a.importe
      || b.fecha.localeCompare(a.fecha),
    );
  }, [candidatos, categorias]);

  const elegidos = candidatos.filter((c) => seleccionados.has(c.id) && !c.duplicado);
  const total = elegidos.reduce((s, c) => s + c.importe, 0);

  async function elegirPdf() {
    if (!categorias) return;
    setError(null);
    const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (resultado.canceled) return;
    const archivo = resultado.assets[0];
    setLeyendo(true);
    setCandidatos([]);
    setSeleccionados(new Set());
    try {
      const extraido = await extraerTextoPdf(archivo);
      const gastos = extraerGastosDeTexto(extraido.texto, categorias, anio);
      if (!gastos.length) {
        throw new Error('No encontré gastos reconocibles. Si el PDF es una imagen escaneada, solicita al banco la versión digital con texto.');
      }

      const anios = [...new Set(gastos.map((g) => Number(g.fecha.slice(0, 4))))];
      const existentes = (await Promise.all(anios.map(cargarMovimientosDelAnio))).flat();
      const sinDuplicar = gastos.filter((g) => !esDuplicado(g, existentes));
      const applePay = emparejarApplePay(sinDuplicar, existentes);
      const revisados = gastos.map((g) => ({ ...g, duplicado: !sinDuplicar.includes(g), applePay: applePay.get(g.id) ?? null }));
      setCandidatos(revisados);
      setSeleccionados(new Set(revisados.filter(importablePorDefecto).map((g) => g.id)));
      setArchivoNombre(archivo.name);
      setPaginas(extraido.paginas);
    } catch (e) {
      const mensaje = (e as Error).message;
      setError(/password/i.test(mensaje) ? 'El PDF tiene contraseña. Descarga una copia sin contraseña para poder leerlo.' : mensaje);
    } finally {
      setLeyendo(false);
    }
  }

  function alternar(id: string) {
    setSeleccionados((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  }

  function cambiarCategoria(categoriaId: string) {
    if (!editandoCategoria) return;
    setCandidatos((actuales) => actuales.map((g) => g.id === editandoCategoria ? { ...g, categoria_id: categoriaId } : g));
    setEditandoCategoria(null);
  }

  async function importar() {
    if (!elegidos.length) return;
    setGuardando(true);
    setError(null);
    try {
      await guardarMovimientos(elegidos.map((g) => ({
        fecha: g.fecha,
        tipo: 'Gasto',
        categoria_id: g.categoria_id,
        descripcion: g.descripcion,
        importe: g.importe,
        medio_pago: null,
        cuenta: null,
        notas: `Importado de ${archivoNombre}`,
      })));
      Alert.alert('Importación terminada', `Se registraron ${elegidos.length} gastos por ${aPesos(total)}.`, [
        { text: 'Ver movimientos', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  if (!categorias && !error) return <Cargando />;

  return (
    <View style={estilos.pantalla}>
      <Stack.Screen options={{ title: 'Importar estado de cuenta' }} />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={texto.cuerpo}>Carga el PDF del banco. Primero podrás revisar los cargos y sus categorías; nada se guarda hasta que confirmes.</Text>
        <View style={estilos.privacidad}>
          <Text style={texto.nota}>El PDF se procesa en la app y no se guarda. Admite estados digitales con texto, hasta 20 MB y 40 páginas.</Text>
        </View>

        {error && <MensajeError>{error}</MensajeError>}
        <Boton
          titulo={leyendo ? 'Leyendo PDF…' : candidatos.length ? 'Elegir otro PDF' : 'Elegir PDF'}
          onPress={elegirPdf}
          deshabilitado={leyendo || !categorias}
          estilo={{ marginTop: espacio.l }}
        />

        {!!candidatos.length && (
          <>
            <View style={estilos.resumen}>
              <View style={{ flex: 1 }}>
                <Text style={texto.seccion}>{archivoNombre}</Text>
                <Text style={[texto.nota, { marginTop: 3 }]}>{paginas} {paginas === 1 ? 'página' : 'páginas'} · {candidatos.length} cargos encontrados</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={texto.nota}>Seleccionado</Text>
                <Text style={[texto.cifra, { fontWeight: '700' }]}>{aPesos(total)}</Text>
              </View>
            </View>

            <View style={estilos.accionesSeleccion}>
              <Text style={texto.nota}>Ordenados por categoría y monto</Text>
              <Pressable onPress={() => setSeleccionados(new Set(candidatos.filter(importablePorDefecto).map((g) => g.id)))}>
                <Text style={estilos.enlace}>Seleccionar todos</Text>
              </Pressable>
              <Pressable onPress={() => setSeleccionados(new Set())}>
                <Text style={estilos.enlace}>Ninguno</Text>
              </Pressable>
            </View>

            {ordenados.map((g) => {
              const categoria = categorias?.find((c) => c.id === g.categoria_id);
              return (
                <View key={g.id} style={[estilos.gasto, (g.duplicado || (g.applePay && !seleccionados.has(g.id))) && { opacity: 0.55 }]}>
                  <Switch
                    value={seleccionados.has(g.id) && !g.duplicado}
                    onValueChange={() => alternar(g.id)}
                    disabled={g.duplicado}
                    trackColor={{ false: colores.linea, true: colores.verdeClaro }}
                    thumbColor={seleccionados.has(g.id) ? colores.verde : '#FFFFFF'}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={estilos.fila}>
                      <Text style={[texto.cuerpo, { flex: 1 }]} numberOfLines={2}>{g.descripcion}</Text>
                      <Text style={[texto.cifra, { fontWeight: '700' }]}>{aPesos(g.importe)}</Text>
                    </View>
                    <View style={[estilos.fila, { marginTop: espacio.s }]}>
                      <Text style={texto.nota}>{fechaLegible(g.fecha)}</Text>
                      <Pressable onPress={() => setEditandoCategoria(g.id)} style={estilos.categoria}>
                        <Text style={estilos.categoriaTexto}>{categoria?.nombre ?? 'Elegir categoría'} ▾</Text>
                      </Pressable>
                    </View>
                    {g.duplicado && <Text style={estilos.duplicado}>Ya existe un movimiento igual; no se importará.</Text>}
                    {g.applePay && (
                      <Text style={estilos.duplicado}>
                        Parece el pago con Apple Pay «{g.applePay.descripcion}» del {fechaLegible(g.applePay.fecha)}, que ya está registrado.
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}

            <Boton
              titulo={guardando ? 'Importando…' : `Importar ${elegidos.length} gastos`}
              onPress={importar}
              deshabilitado={guardando || elegidos.length === 0}
              estilo={{ marginTop: espacio.xl }}
            />
            <Text style={[texto.nota, { marginTop: espacio.m }]}>Después de importar puedes editar cualquier movimiento desde la pestaña Movimientos.</Text>
          </>
        )}
      </ScrollView>

      <Modal visible={!!editandoCategoria} transparent animationType="fade" onRequestClose={() => setEditandoCategoria(null)}>
        <Pressable style={estilos.fondoModal} onPress={() => setEditandoCategoria(null)}>
          <View style={estilos.modal}>
            <Text style={texto.seccion}>Categoría del gasto</Text>
            {categorias?.map((c) => (
              <Pressable key={c.id} onPress={() => cambiarCategoria(c.id)} style={estilos.opcionCategoria}>
                <Text style={texto.cuerpo}>{c.nombre}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.papel },
  contenido: { padding: espacio.l, paddingBottom: 48 },
  privacidad: { backgroundColor: colores.verdeClaro, padding: espacio.m, marginTop: espacio.m, borderRadius: 8 },
  resumen: { flexDirection: 'row', gap: espacio.m, alignItems: 'center', marginTop: espacio.xl, paddingBottom: espacio.m, borderBottomWidth: 2, borderBottomColor: colores.tinta },
  accionesSeleccion: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m, alignItems: 'center', paddingVertical: espacio.m },
  enlace: { color: colores.verde, fontSize: 13, fontWeight: '700' },
  gasto: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s, paddingVertical: espacio.m, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.linea },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  categoria: { backgroundColor: colores.hoja, borderWidth: 1, borderColor: colores.linea, paddingHorizontal: espacio.s, paddingVertical: 5, borderRadius: 14 },
  categoriaTexto: { color: colores.tinta, fontSize: 12, fontWeight: '600' },
  duplicado: { color: colores.ambar, fontSize: 12, marginTop: espacio.s },
  fondoModal: { flex: 1, backgroundColor: 'rgba(23,51,43,0.45)', justifyContent: 'center', padding: espacio.xl },
  modal: { backgroundColor: colores.hoja, borderRadius: 12, padding: espacio.l, maxHeight: '80%' },
  opcionCategoria: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.linea },
});
