import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSesion } from '@/lib/sesion';
import { supabase } from '@/lib/supabase';
import { borrarTodosMisDatos, cargarResumenDatosUsuario, mensajeError } from '@/lib/datos';
import { useCarga } from '@/lib/useCarga';
import { Boton, Campo, MensajeError, Pantalla, Renglon, Seccion } from '@/components/ui';
import { colores, espacio, texto } from '@/lib/tema';

function fechaCuenta(fecha?: string) {
  if (!fecha) return 'No disponible';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(fecha));
}

export default function Usuario() {
  const { sesion } = useSesion();
  const { datos, error: errorCarga, recargar } = useCarga(cargarResumenDatosUsuario, []);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const usuario = sesion?.user;
  const nombre = usuario?.user_metadata?.full_name ?? usuario?.user_metadata?.name;
  const total = datos ? datos.movimientos + datos.operaciones + datos.presupuestos : 0;

  async function cerrarSesion() {
    setProcesando(true);
    setError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(mensajeError(error));
      setProcesando(false);
    }
  }

  function pedirBorradoFinal() {
    Alert.alert(
      'Borrar todos los datos',
      `Se eliminarán ${total} registros financieros. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar definitivamente', style: 'destructive', onPress: ejecutarBorrado },
      ],
    );
  }

  async function ejecutarBorrado() {
    setProcesando(true);
    setError(null);
    setAviso(null);
    try {
      await borrarTodosMisDatos();
      setConfirmando(false);
      setConfirmacion('');
      setAviso('Todos tus movimientos, presupuestos y operaciones fueron eliminados.');
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <Pantalla titulo="Usuario" conMes={false}>
      <Seccion titulo="Datos de la cuenta">
        {!!nombre && <Renglon izquierda="Nombre" derecha={String(nombre)} />}
        <Renglon izquierda="Correo" derecha={usuario?.email ?? 'No disponible'} />
        <Renglon izquierda="Cuenta creada" derecha={fechaCuenta(usuario?.created_at)} />
        <Renglon izquierda="Identificador" detalle={usuario?.id ?? 'No disponible'} />
      </Seccion>

      <Seccion titulo="Tus datos">
        <Renglon izquierda="Movimientos" derecha={String(datos?.movimientos ?? '…')} />
        <Renglon izquierda="Operaciones de acciones" derecha={String(datos?.operaciones ?? '…')} />
        <Renglon izquierda="Presupuestos" derecha={String(datos?.presupuestos ?? '…')} />
      </Seccion>

      {(errorCarga || error) && <MensajeError>{errorCarga ?? error}</MensajeError>}
      {!!aviso && <Text style={estilos.aviso}>{aviso}</Text>}

      <Seccion titulo="Sesión">
        <View style={{ paddingTop: espacio.m }}>
          <Boton titulo="Cerrar sesión" variante="secundario" onPress={cerrarSesion} deshabilitado={procesando} />
        </View>
      </Seccion>

      <Seccion titulo="Zona de peligro">
        <View style={estilos.peligro}>
          <Text style={texto.cuerpo}>Borrar todos mis datos financieros</Text>
          <Text style={[texto.nota, { marginTop: espacio.s }]}>
            Elimina movimientos, presupuestos y operaciones de acciones. Tu cuenta y categorías se conservan. No se puede deshacer.
          </Text>

          {!confirmando ? (
            <Boton
              titulo="Borrar todos mis datos"
              variante="peligro"
              onPress={() => {
                setConfirmando(true);
                setAviso(null);
              }}
              deshabilitado={procesando || total === 0}
              estilo={{ marginTop: espacio.l }}
            />
          ) : (
            <View style={{ marginTop: espacio.l }}>
              <Campo
                etiqueta='Escribe BORRAR para continuar'
                value={confirmacion}
                onChangeText={setConfirmacion}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="BORRAR"
              />
              <Boton
                titulo={procesando ? 'Borrando…' : 'Borrar definitivamente'}
                variante="peligro"
                onPress={pedirBorradoFinal}
                deshabilitado={procesando || confirmacion.trim().toUpperCase() !== 'BORRAR'}
              />
              <Boton
                titulo="Cancelar"
                variante="secundario"
                onPress={() => {
                  setConfirmando(false);
                  setConfirmacion('');
                }}
                deshabilitado={procesando}
                estilo={{ marginTop: espacio.s }}
              />
            </View>
          )}
        </View>
      </Seccion>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  peligro: {
    marginTop: espacio.m,
    padding: espacio.l,
    backgroundColor: colores.rojoClaro,
    borderWidth: 1,
    borderColor: colores.rojo,
    borderRadius: 10,
  },
  aviso: {
    marginTop: espacio.l,
    padding: espacio.m,
    color: colores.verde,
    backgroundColor: colores.verdeClaro,
    fontSize: 14,
  },
});
