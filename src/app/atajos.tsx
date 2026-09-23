import { useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSesion } from '@/lib/sesion';
import { clavePublica, urlSupabase } from '@/lib/supabase';
import { cargarEstadoAtajos, desconectarAtajos, generarCodigoAtajos, mensajeError } from '@/lib/datos';
import { useCarga } from '@/lib/useCarga';
import { Boton, MensajeError } from '@/components/ui';
import { colores, espacio, texto } from '@/lib/tema';

const URL_ATAJO = `${urlSupabase}/rest/v1/rpc/registrar_gasto_atajo`;

function fechaHora(fecha: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(fecha));
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ marginTop: espacio.m }}>
      <Text style={texto.nota}>{etiqueta}</Text>
      <Text selectable style={estilos.valor}>{valor}</Text>
    </View>
  );
}

function Paso({ n, children }: { n: number; children: string }) {
  return (
    <View style={estilos.paso}>
      <Text style={estilos.pasoNumero}>{n}</Text>
      <Text style={[texto.cuerpo, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

export default function Atajos() {
  const { sesion } = useSesion();
  const { datos: estado, error: errorCarga, recargar } = useCarga(cargarEstadoAtajos, []);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setProcesando(true);
    setError(null);
    try {
      setCodigo(await generarCodigoAtajos());
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setProcesando(false);
    }
  }

  function pedirGenerar() {
    if (!estado) return generar();
    Alert.alert('Generar código nuevo', 'El atajo que ya tienes dejará de funcionar hasta que le pongas el código nuevo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Generar', onPress: generar },
    ]);
  }

  function pedirDesconectar() {
    Alert.alert('Desconectar Apple Pay', 'Tu atajo dejará de registrar pagos. Los gastos ya registrados se conservan.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          setProcesando(true);
          try {
            await desconectarAtajos(sesion!.user.id);
            setCodigo(null);
            recargar();
          } catch (e) {
            setError(mensajeError(e));
          } finally {
            setProcesando(false);
          }
        },
      },
    ]);
  }

  function compartir() {
    Share.share({
      message: `URL: ${URL_ATAJO}\n\nEncabezado apikey: ${clavePublica}\n\nCódigo (token): ${codigo}`,
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colores.papel }}>
      <Stack.Screen options={{ title: 'Apple Pay con Atajos' }} />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={texto.cuerpo}>
          Cada vez que pagues con Apple Pay, un atajo del iPhone manda el monto y el comercio a tu cuenta y queda registrado como gasto.
        </Text>
        <Text style={[texto.nota, { marginTop: espacio.s }]}>
          La categoría se copia del último gasto en el mismo comercio; si es nuevo, queda en «Otros» y puedes cambiarla después.
        </Text>

        <View style={estilos.estado}>
          <Text style={texto.seccion}>{estado ? 'Conectado' : 'Sin conectar'}</Text>
          {estado && (
            <Text style={[texto.nota, { marginTop: 3 }]}>
              {estado.ultimo_uso ? `Último pago registrado: ${fechaHora(estado.ultimo_uso)}` : 'Aún no llega ningún pago.'}
            </Text>
          )}
        </View>

        {(errorCarga || error) && <MensajeError>{errorCarga ?? error}</MensajeError>}

        {codigo ? (
          <View style={estilos.datos}>
            <Text style={texto.seccion}>Datos para tu atajo</Text>
            <Text style={[texto.nota, { marginTop: 3 }]}>
              El código solo se muestra ahora. Compártelo a Notas o cópialo directo en el atajo.
            </Text>
            <Dato etiqueta="URL" valor={URL_ATAJO} />
            <Dato etiqueta="Encabezado apikey" valor={clavePublica} />
            <Dato etiqueta="Código (token)" valor={codigo} />
            <Boton titulo="Compartir datos" variante="secundario" onPress={compartir} estilo={{ marginTop: espacio.l }} />
          </View>
        ) : (
          <Boton
            titulo={estado ? 'Generar código nuevo' : 'Generar código'}
            onPress={pedirGenerar}
            deshabilitado={procesando}
            estilo={{ marginTop: espacio.l }}
          />
        )}

        <Text style={[texto.seccion, { marginTop: espacio.xxl }]}>Cómo crear el atajo</Text>
        <Paso n={1}>Abre Atajos → Automatización → Nueva automatización → Transacción.</Paso>
        <Paso n={2}>Elige tus tarjetas de Apple Pay, marca «Al tocar» y elige «Ejecutar inmediatamente».</Paso>
        <Paso n={3}>Agrega la acción «Obtener contenido de URL» y pega la URL de arriba.</Paso>
        <Paso n={4}>Cambia el método a POST. En Encabezados agrega «apikey» con el valor de arriba.</Paso>
        <Paso n={5}>En Cuerpo de la solicitud elige JSON y agrega cuatro campos de texto: «token» con tu código; «monto» con Entrada del atajo → Monto; «comercio» con → Comercio; «tarjeta» con → Tarjeta o pase.</Paso>
        <Paso n={6}>Haz un pago de prueba y revisa que aparezca en Movimientos.</Paso>

        {estado && (
          <Boton titulo="Desconectar" variante="peligro" onPress={pedirDesconectar} deshabilitado={procesando} estilo={{ marginTop: espacio.xxl }} />
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: 48 },
  estado: { marginTop: espacio.xl, paddingVertical: espacio.m, borderTopWidth: 2, borderTopColor: colores.tinta },
  datos: { marginTop: espacio.l, padding: espacio.l, backgroundColor: colores.hoja, borderWidth: 1, borderColor: colores.linea, borderRadius: 10 },
  valor: { fontSize: 13, color: colores.tinta, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), marginTop: 2 },
  paso: { flexDirection: 'row', gap: espacio.m, marginTop: espacio.m },
  pasoNumero: { width: 22, height: 22, borderRadius: 11, backgroundColor: colores.verdeClaro, color: colores.verde, textAlign: 'center', lineHeight: 22, fontWeight: '700', fontSize: 13, overflow: 'hidden' },
});
