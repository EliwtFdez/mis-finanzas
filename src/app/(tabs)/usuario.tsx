import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSesion } from '@/lib/sesion';
import { useBloqueo } from '@/lib/bloqueo';
import { supabase } from '@/lib/supabase';
import { borrarTodosMisDatos, cargarResumenDatosUsuario, guardarPerfil, mensajeError, perfilDe } from '@/lib/datos';
import { useCarga } from '@/lib/useCarga';
import { Boton, Campo, MensajeError, Pantalla, Renglon, Seccion } from '@/components/ui';
import { colores, espacio, texto } from '@/lib/tema';

function fechaCuenta(fecha?: string) {
  if (!fecha) return 'No disponible';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(fecha));
}

export default function Usuario() {
  const router = useRouter();
  const { sesion } = useSesion();
  const bloqueo = useBloqueo();
  const { datos, error: errorCarga, recargar } = useCarga(cargarResumenDatosUsuario, []);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const usuario = sesion?.user;
  const perfil = perfilDe(usuario?.user_metadata);
  const [nombre, setNombre] = useState(perfil.nombre);
  const [edad, setEdad] = useState(perfil.edad?.toString() ?? '');
  const [ocupacion, setOcupacion] = useState(perfil.ocupacion);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const [avisoPerfil, setAvisoPerfil] = useState<string | null>(null);

  // Si el perfil cambia desde otro dispositivo, refleja lo guardado.
  useEffect(() => {
    setNombre(perfil.nombre);
    setEdad(perfil.edad?.toString() ?? '');
    setOcupacion(perfil.ocupacion);
  }, [perfil.nombre, perfil.edad, perfil.ocupacion]);

  const edadNum = edad.trim() === '' ? null : Number(edad);
  const edadValida = edadNum === null || (Number.isInteger(edadNum) && edadNum > 0 && edadNum < 130);
  const perfilCambio = nombre.trim() !== perfil.nombre || edadNum !== perfil.edad || ocupacion.trim() !== perfil.ocupacion;
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

  async function enviarPerfil() {
    setGuardandoPerfil(true);
    setErrorPerfil(null);
    setAvisoPerfil(null);
    try {
      await guardarPerfil({ nombre, edad: edadNum, ocupacion });
      setAvisoPerfil('Perfil guardado.');
    } catch (e) {
      setErrorPerfil(mensajeError(e));
    } finally {
      setGuardandoPerfil(false);
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
      <Seccion titulo="Perfil">
        <View style={{ paddingTop: espacio.m }}>
          <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} autoComplete="name" placeholder="Tu nombre" />
          <Campo
            etiqueta="Edad"
            value={edad}
            onChangeText={(v) => setEdad(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="Años"
            ayuda={edadValida ? undefined : 'Escribe una edad válida.'}
          />
          <Campo etiqueta="Ocupación" value={ocupacion} onChangeText={setOcupacion} placeholder="Ej. Ingeniero, estudiante…" />
          <Boton
            titulo={guardandoPerfil ? 'Guardando…' : 'Guardar perfil'}
            onPress={enviarPerfil}
            deshabilitado={guardandoPerfil || !perfilCambio || !edadValida}
          />
          {errorPerfil && <MensajeError>{errorPerfil}</MensajeError>}
          {!!avisoPerfil && !perfilCambio && <Text style={estilos.aviso}>{avisoPerfil}</Text>}
        </View>
      </Seccion>

      <Seccion titulo="Datos de la cuenta">
        <Renglon izquierda="Correo" derecha={usuario?.email ?? 'No disponible'} />
        <Renglon izquierda="Cuenta creada" derecha={fechaCuenta(usuario?.created_at)} />
        <Renglon izquierda="Identificador" detalle={usuario?.id ?? 'No disponible'} />
      </Seccion>

      <Seccion titulo="Tus datos">
        <Renglon izquierda="Movimientos" derecha={String(datos?.movimientos ?? '…')} />
        <Renglon izquierda="Operaciones de acciones" derecha={String(datos?.operaciones ?? '…')} />
        <Renglon izquierda="Presupuestos" derecha={String(datos?.presupuestos ?? '…')} />
      </Seccion>

      <Seccion titulo="Organización">
        <Renglon izquierda="Categorías ›" detalle="Agrega, renombra, ordena u oculta" onPress={() => router.push('/categorias')} />
      </Seccion>

      <Seccion titulo="Registro automático">
        <Renglon
          izquierda="Apple Pay con Atajos ›"
          detalle="Registra cada pago del iPhone como gasto"
          onPress={() => router.push('/atajos')}
        />
      </Seccion>

      {(errorCarga || error) && <MensajeError>{errorCarga ?? error}</MensajeError>}
      {!!aviso && <Text style={estilos.aviso}>{aviso}</Text>}

      <Seccion titulo="Seguridad">
        {bloqueo.disponible ? (
          <View style={estilos.interruptor}>
            <View style={{ flex: 1 }}>
              <Text style={texto.cuerpo}>Bloquear con Face ID o huella</Text>
              <Text style={texto.nota}>Se pide al abrir la app y al volver después de 30 segundos.</Text>
            </View>
            <Switch
              value={bloqueo.activo}
              onValueChange={(v) => void bloqueo.cambiar(v)}
              trackColor={{ false: colores.linea, true: colores.verdeClaro }}
              thumbColor={bloqueo.activo ? colores.verde : '#FFFFFF'}
            />
          </View>
        ) : (
          <Text style={[texto.nota, { paddingVertical: espacio.m }]}>
            Configura Face ID o huella en tu teléfono para poder bloquear la app.
          </Text>
        )}
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
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.m },
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
