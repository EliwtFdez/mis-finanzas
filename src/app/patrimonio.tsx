import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { cambioDesde, netoDeFoto } from '@/domain/patrimonio';
import { cargarFotosPatrimonio, guardarSaldoEfectivo, mensajeError } from '@/lib/datos';
import { aPesos, fechaLegible, hoy, leerNumero } from '@/lib/formato';
import { calcularPatrimonioActual } from '@/lib/patrimonio';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, Campo, Cargando, MensajeError, Renglon, Seccion } from '@/components/ui';
import { GraficaLinea } from '@/components/GraficaLinea';

export default function Patrimonio() {
  const { datos, error: errorCarga, recargar } = useCarga(async () => {
    const actual = await calcularPatrimonioActual();
    // La foto de hoy se guarda en segundo plano: la sumamos aquí para no esperar a que llegue.
    const fotos = (await cargarFotosPatrimonio()).filter((f) => f.fecha !== actual.foto.fecha);
    return { ...actual, fotos: actual.conSaldo ? [...fotos, actual.foto] : fotos };
  }, []);

  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const valor = leerNumero(monto);
    if (valor === null) return setError('Escribe cuánto tienes, aunque sea aproximado.');
    setGuardando(true);
    setError(null);
    try {
      await guardarSaldoEfectivo(valor, hoy());
      setEditando(false);
      setMonto('');
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  if (!datos) return errorCarga ? <MensajeError>{errorCarga}</MensajeError> : <Cargando />;

  const { foto } = datos;
  const neto = netoDeFoto(foto);
  const cambio = cambioDesde(datos.fotos, 30);
  const pideSaldo = !datos.conSaldo || editando;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colores.papel }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Patrimonio neto' }} />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {datos.conSaldo && (
          <>
            <Text style={texto.nota}>Lo que tienes menos lo que debes</Text>
            <Text style={[texto.cifraGrande, { color: neto < 0 ? colores.rojo : colores.tinta }]}>{aPesos(neto)}</Text>
            {cambio && (
              <Text style={[texto.nota, { marginTop: espacio.xs }]}>
                <Text style={{ color: cambio.monto < 0 ? colores.rojo : colores.verde, fontWeight: '600' }}>
                  {cambio.monto >= 0 ? '+' : '−'}
                  {aPesos(Math.abs(cambio.monto))}
                </Text>{' '}
                desde el {fechaLegible(cambio.desde, true)}
              </Text>
            )}

            {datos.fotos.length >= 2 ? (
              <View style={{ marginTop: espacio.l }}>
                <GraficaLinea fotos={datos.fotos} />
              </View>
            ) : (
              <Text style={[texto.nota, { marginTop: espacio.l }]}>
                La app guarda una foto de tu patrimonio cada día que la abres. Mañana empezarás a ver cómo cambia.
              </Text>
            )}

            <Seccion titulo="Cómo se calcula">
              <Renglon izquierda="Efectivo" detalle="Tu saldo más lo que ha entrado y salido" derecha={aPesos(foto.efectivo)} />
              <Renglon
                izquierda="Inversiones"
                detalle={datos.sinPrecio.length ? `A costo sin precio: ${datos.sinPrecio.join(', ')}` : 'Valor de mercado'}
                derecha={aPesos(foto.inversiones)}
              />
              <Renglon izquierda="Deudas a meses" detalle="Mensualidades que faltan" derecha={foto.deudas > 0 ? `−${aPesos(foto.deudas)}` : aPesos(0)} />
            </Seccion>
          </>
        )}

        {pideSaldo ? (
          <View style={estilos.formulario}>
            <Text style={texto.seccion}>{datos.conSaldo ? 'Corregir tu efectivo' : '¿Cuánto tienes hoy?'}</Text>
            <Text style={[texto.nota, { marginTop: espacio.xs, marginBottom: espacio.m }]}>
              Suma tus cuentas de débito, ahorro y efectivo. Desde hoy la app lo mueve con cada ingreso, gasto, compra o venta de
              acciones y dividendo. Tus metas de ahorro ya están incluidas.
            </Text>
            <Campo etiqueta="Total en tus cuentas (MXN)" value={monto} onChangeText={setMonto} keyboardType="decimal-pad" placeholder="0.00" />
            {error && <MensajeError>{error}</MensajeError>}
            <Boton titulo={guardando ? 'Guardando…' : 'Guardar'} onPress={guardar} deshabilitado={guardando || !monto.trim()} />
            {datos.conSaldo && <Boton titulo="Cancelar" variante="secundario" onPress={() => setEditando(false)} estilo={{ marginTop: espacio.s }} />}
          </View>
        ) : (
          <Boton titulo="Corregir efectivo" variante="secundario" onPress={() => setEditando(true)} estilo={{ marginTop: espacio.xl }} />
        )}
        {errorCarga && <MensajeError>{errorCarga}</MensajeError>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: 48 },
  formulario: { marginTop: espacio.xl, padding: espacio.l, backgroundColor: colores.hoja, borderRadius: 10, borderWidth: 1, borderColor: colores.linea },
});
