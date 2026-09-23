import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { netoDividendoMXN, type Moneda } from '@/domain/finanzas';
import { monedaPorTicker } from '@/domain/valuacion';
import { borrarDividendo, cargarDividendos, cargarOperaciones, guardarDividendo } from '@/lib/datos';
import { aPesos, hoy, leerNumero } from '@/lib/formato';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, Campo, CampoFecha, Cargando, MensajeError, Opciones } from '@/components/ui';

const MONEDAS = ['MXN', 'USD'] as const;

export default function FormularioDividendo() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [monedas, setMonedas] = useState<Map<string, Moneda> | null>(null);
  const [ticker, setTicker] = useState('');
  const [importe, setImporte] = useState('');
  const [retencion, setRetencion] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('MXN');
  const [tipoCambio, setTipoCambio] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    Promise.all([cargarOperaciones(), id ? cargarDividendos() : Promise.resolve([])])
      .then(([ops, dividendos]) => {
        setMonedas(monedaPorTicker(ops));
        const d = dividendos.find((x) => x.id === id);
        if (d) {
          setTicker(d.ticker);
          setImporte(String(d.importe));
          setRetencion(d.retencion ? String(d.retencion) : '');
          setMoneda(d.moneda);
          setTipoCambio(d.tipo_cambio ? String(d.tipo_cambio) : '');
          setFecha(d.fecha);
          setNotas(d.notas ?? '');
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (!monedas) return error ? <MensajeError>{error}</MensajeError> : <Cargando />;

  const t = ticker.trim().toUpperCase().replace(/\s+/g, '');
  const bruto = leerNumero(importe);
  const ret = leerNumero(retencion) ?? 0;
  const tc = moneda === 'USD' ? leerNumero(tipoCambio) : null;
  const tickers = [...monedas.keys()].slice(-8).reverse();

  const faltante = !t
    ? 'Escribe el ticker.'
    : !bruto || bruto <= 0
      ? 'El importe debe ser mayor que cero.'
      : ret < 0 || ret >= bruto
        ? 'La retención debe ser menor que el importe bruto.'
        : moneda === 'USD' && (!tc || tc <= 0)
          ? 'Escribe cuántos pesos valía cada dólar ese día.'
          : null;
  const neto = faltante ? null : netoDividendoMXN({ importe: bruto!, retencion: ret, moneda, tipo_cambio: tc });

  function elegirTicker(nuevo: string) {
    setTicker(nuevo);
    // La moneda del dividendo suele ser la misma en la que compraste.
    const m = monedas!.get(nuevo);
    if (m && !id) setMoneda(m);
  }

  async function guardar() {
    if (faltante) return setError(faltante);
    setGuardando(true);
    setError(null);
    try {
      await guardarDividendo(
        { fecha, ticker: t, importe: bruto!, retencion: ret, moneda, tipo_cambio: tc, notas: notas.trim() || null },
        id,
      );
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  function confirmarBorrado() {
    Alert.alert('Borrar dividendo', '¿Borrar este dividendo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await borrarDividendo(id!);
            router.back();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id ? 'Editar dividendo' : 'Nuevo dividendo' }} />
      <ScrollView contentContainerStyle={{ padding: espacio.l, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Campo
          etiqueta="Ticker"
          value={ticker}
          onChangeText={elegirTicker}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Ej. VOO-US, WALMEX-MX"
        />
        {tickers.length > 0 && (
          <View style={{ marginTop: -espacio.s }}>
            <Opciones opciones={tickers} valor={t} onCambio={elegirTicker} />
          </View>
        )}

        <Opciones etiqueta="Moneda del pago" opciones={MONEDAS} valor={moneda} onCambio={setMoneda} />

        <View style={estilos.dosColumnas}>
          <View style={{ flex: 1 }}>
            <Campo etiqueta={`Importe bruto (${moneda})`} value={importe} onChangeText={setImporte} keyboardType="decimal-pad" placeholder="0.00" autoFocus={!id} />
          </View>
          <View style={{ flex: 1 }}>
            <Campo etiqueta={`Retención (${moneda})`} value={retencion} onChangeText={setRetencion} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
        </View>
        {moneda === 'USD' && (
          <Campo etiqueta="Pesos por dólar" value={tipoCambio} onChangeText={setTipoCambio} keyboardType="decimal-pad" placeholder="Ej. 18.25" />
        )}

        <CampoFecha etiqueta="Fecha de pago" valor={fecha} onCambio={setFecha} />
        <Campo etiqueta="Notas" value={notas} onChangeText={setNotas} multiline />

        {neto !== null && (
          <View style={estilos.vista}>
            <Text style={texto.nota}>Recibes netos</Text>
            <Text style={[texto.cifra, { fontWeight: '600', color: colores.verde }]}>{aPesos(neto)}</Text>
          </View>
        )}

        {error && <MensajeError>{error}</MensajeError>}
        <Boton titulo={id ? 'Guardar cambios' : 'Registrar dividendo'} onPress={guardar} deshabilitado={guardando} estilo={{ marginTop: espacio.m }} />
        {id && <Boton titulo="Borrar dividendo" variante="peligro" onPress={confirmarBorrado} estilo={{ marginTop: espacio.m }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  dosColumnas: { flexDirection: 'row', gap: espacio.m },
  vista: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    backgroundColor: colores.verdeClaro,
    padding: espacio.m,
    borderRadius: 8,
    marginBottom: espacio.m,
  },
});
