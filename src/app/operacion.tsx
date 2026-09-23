import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { calcularCartera, type Moneda, type Operacion, type TipoOperacion } from '@/domain/finanzas';
import { borrarOperacion, cargarOperaciones, guardarOperacion } from '@/lib/datos';
import { aNumero, aPesos, hoy, leerNumero } from '@/lib/formato';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, Campo, CampoFecha, Cargando, MensajeError, Opciones } from '@/components/ui';

const TIPOS = ['Compra', 'Venta'] as const;
const MONEDAS = ['MXN', 'USD'] as const;

export default function FormularioOperacion() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [todas, setTodas] = useState<Operacion[] | null>(null);
  const [tipo, setTipo] = useState<TipoOperacion>('Compra');
  const [ticker, setTicker] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precio, setPrecio] = useState('');
  const [comision, setComision] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('MXN');
  const [tipoCambio, setTipoCambio] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarOperaciones()
      .then((ops) => {
        setTodas(ops);
        const o = id ? ops.find((x) => x.id === id) : undefined;
        if (o) {
          setTipo(o.tipo);
          setTicker(o.ticker);
          setCantidad(String(o.cantidad));
          setPrecio(String(o.precio));
          setComision(o.comision ? String(o.comision) : '');
          setMoneda(o.moneda);
          setTipoCambio(o.tipo_cambio ? String(o.tipo_cambio) : '');
          setFecha(o.fecha);
          setNotas(o.notas ?? '');
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const t = ticker.trim().toUpperCase().replace(/\s+/g, '');
  const cant = leerNumero(cantidad);
  const prec = leerNumero(precio);
  const com = leerNumero(comision) ?? 0;
  const tc = moneda === 'USD' ? leerNumero(tipoCambio) : null;

  const faltante = !t
    ? 'Escribe el ticker.'
    : !cant || cant <= 0
      ? 'La cantidad debe ser mayor que cero.'
      : !prec || prec <= 0
        ? 'El precio debe ser mayor que cero.'
        : com < 0
          ? 'La comisión no puede ser negativa.'
          : moneda === 'USD' && (!tc || tc <= 0)
            ? 'Escribe cuántos pesos costaba cada dólar ese día.'
            : null;

  const tickers = useMemo(() => [...new Set((todas ?? []).map((o) => o.ticker))].slice(0, 8), [todas]);

  // Vista previa: recalcula la cartera como si esta operación ya estuviera guardada.
  const vista = useMemo(() => {
    if (!todas || faltante) return null;
    const original = id ? todas.find((o) => o.id === id) : undefined;
    const borrador: Operacion = {
      id: 'borrador',
      fecha,
      ticker: t,
      tipo,
      cantidad: cant!,
      precio: prec!,
      comision: com,
      moneda,
      tipo_cambio: tc,
      notas: null,
      created_at: original?.created_at ?? '9999', // las nuevas van al final de su día
    };
    const r = calcularCartera([...todas.filter((o) => o.id !== id), borrador]);
    return r.operaciones.find((o) => o.id === 'borrador') ?? null;
  }, [todas, faltante, id, fecha, t, tipo, cant, prec, com, moneda, tc]);

  if (!todas) return error ? <MensajeError>{error}</MensajeError> : <Cargando />;

  async function guardar() {
    if (faltante) return setError(faltante);
    setGuardando(true);
    setError(null);
    try {
      await guardarOperacion(
        { fecha, ticker: t, tipo, cantidad: cant!, precio: prec!, comision: com, moneda, tipo_cambio: tc, notas: notas.trim() || null },
        id,
      );
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  function confirmarBorrado() {
    Alert.alert(
      'Borrar operación',
      'Si borras una compra, las ventas posteriores de ese ticker podrían quedar sin títulos suficientes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await borrarOperacion(id!);
              router.back();
            } catch (e) {
              setError((e as Error).message);
            }
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id ? 'Editar operación' : 'Nueva operación' }} />
      <ScrollView contentContainerStyle={{ padding: espacio.l, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Opciones opciones={TIPOS} valor={tipo} onCambio={setTipo} />

        <Campo
          etiqueta="Ticker"
          value={ticker}
          onChangeText={setTicker}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Ej. VOO-US, WALMEX-MX"
          ayuda="Usa siempre el mismo identificador. Si cotiza en dos mercados, distínguelos."
        />
        {tickers.length > 0 && (
          <View style={{ marginTop: -espacio.s }}>
            <Opciones opciones={tickers} valor={t} onCambio={setTicker} />
          </View>
        )}

        <View style={estilos.dosColumnas}>
          <View style={{ flex: 1 }}>
            <Campo etiqueta="Cantidad" value={cantidad} onChangeText={setCantidad} keyboardType="decimal-pad" placeholder="0" />
          </View>
          <View style={{ flex: 1 }}>
            <Campo etiqueta={`Precio (${moneda})`} value={precio} onChangeText={setPrecio} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
        </View>

        <Opciones etiqueta="Moneda" opciones={MONEDAS} valor={moneda} onCambio={setMoneda} />

        <View style={estilos.dosColumnas}>
          <View style={{ flex: 1 }}>
            <Campo etiqueta={`Comisión total (${moneda})`} value={comision} onChangeText={setComision} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
          {moneda === 'USD' && (
            <View style={{ flex: 1 }}>
              <Campo etiqueta="Pesos por dólar" value={tipoCambio} onChangeText={setTipoCambio} keyboardType="decimal-pad" placeholder="Ej. 18.25" />
            </View>
          )}
        </View>

        <CampoFecha etiqueta="Fecha" valor={fecha} onCambio={setFecha} />
        <Campo etiqueta="Notas" value={notas} onChangeText={setNotas} multiline />

        {vista && (
          <View style={[estilos.vista, vista.estado !== 'OK' && { backgroundColor: colores.rojoClaro }]}>
            {vista.estado !== 'OK' ? (
              <Text style={[texto.cuerpo, { color: colores.rojo }]}>
                En esa fecha tenías {aNumero(vista.titulosDespues)} títulos de {t}. No puedes vender {aNumero(cant!)}.
              </Text>
            ) : (
              <>
                <Fila etiqueta={tipo === 'Compra' ? 'Pagas en total' : 'Recibes en total'} valor={aPesos(Math.abs(vista.flujo))} />
                {tipo === 'Venta' && (
                  <>
                    <Fila etiqueta="Costo promedio antes de vender" valor={aPesos(vista.costoMedioPrevio)} />
                    <Fila
                      etiqueta="Ganancia de esta venta"
                      valor={aPesos(vista.ganancia)}
                      color={vista.ganancia < 0 ? colores.rojo : colores.verde}
                    />
                  </>
                )}
                <Fila etiqueta={`Títulos de ${t} después`} valor={aNumero(vista.titulosDespues)} />
              </>
            )}
          </View>
        )}

        {error && <MensajeError>{error}</MensajeError>}
        <Boton
          titulo={id ? 'Guardar cambios' : `Registrar ${tipo.toLowerCase()}`}
          onPress={guardar}
          deshabilitado={guardando || vista?.estado === 'Venta excede saldo'}
          estilo={{ marginTop: espacio.m }}
        />
        {id && <Boton titulo="Borrar operación" variante="peligro" onPress={confirmarBorrado} estilo={{ marginTop: espacio.m }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Fila({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <View style={estilos.fila}>
      <Text style={texto.nota}>{etiqueta}</Text>
      <Text style={[texto.cifra, { fontWeight: '600' }, color ? { color } : null]}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  dosColumnas: { flexDirection: 'row', gap: espacio.m },
  vista: { backgroundColor: colores.verdeClaro, padding: espacio.m, borderRadius: 8, gap: 6, marginBottom: espacio.m },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
