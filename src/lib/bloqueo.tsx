import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { debeBloquear } from '@/domain/bloqueo';
import { Boton } from '@/components/ui';
import { colores, espacio, texto } from './tema';

const CLAVE = 'bloqueo-biometrico';

interface Contexto {
  /** El dispositivo tiene Face ID / huella configurados. */
  disponible: boolean;
  activo: boolean;
  /** Activa (pidiendo autenticación primero) o desactiva el bloqueo. Devuelve si quedó como se pidió. */
  cambiar: (activar: boolean) => Promise<boolean>;
}

const BloqueoContext = createContext<Contexto>({ disponible: false, activo: false, cambiar: async () => false });

async function autenticar() {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloquear Mis finanzas',
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar código',
  });
  return r.success;
}

/**
 * Pide Face ID o huella al abrir la app y al volver tras 30 s en segundo plano.
 * Mientras la app no está al frente, tapa el contenido (vista previa del selector de apps).
 */
export function BloqueoProvider({ children }: { children: ReactNode }) {
  const [disponible, setDisponible] = useState(false);
  const [activo, setActivo] = useState(false);
  const [bloqueada, setBloqueada] = useState(false);
  const [enFondo, setEnFondo] = useState(false);
  const [listo, setListo] = useState(Platform.OS === 'web');
  const salida = useRef<number | null>(null);
  const autenticando = useRef(false);
  // Solo se pide automáticamente una vez por bloqueo; si cancela, queda el botón.
  const pedidoAutomatico = useRef(false);

  const desbloquear = useCallback(async () => {
    if (autenticando.current) return;
    autenticando.current = true;
    try {
      if (await autenticar()) setBloqueada(false);
    } finally {
      autenticando.current = false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const [hardware, registrado, guardado] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        AsyncStorage.getItem(CLAVE).catch(() => null),
      ]);
      const puede = hardware && registrado;
      const encendido = puede && guardado === '1';
      setDisponible(puede);
      setActivo(encendido);
      setBloqueada(debeBloquear(encendido, null, Date.now()));
      setListo(true);
    })();
  }, []);

  useEffect(() => {
    if (!activo) return;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') {
        setEnFondo(false);
        // El diálogo de Face ID también pone la app en "inactive"; no cuenta como salida.
        if (debeBloquear(true, salida.current ?? Date.now(), Date.now())) {
          pedidoAutomatico.current = false;
          setBloqueada(true);
        }
        salida.current = null;
      } else {
        setEnFondo(true);
        if (estado === 'background' && salida.current === null && !autenticando.current) salida.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [activo]);

  useEffect(() => {
    if (!bloqueada || enFondo || pedidoAutomatico.current) return;
    pedidoAutomatico.current = true;
    desbloquear();
  }, [bloqueada, enFondo, desbloquear]);

  const cambiar = useCallback(async (activar: boolean) => {
    if (activar && !(await autenticar())) return false;
    await AsyncStorage.setItem(CLAVE, activar ? '1' : '0').catch(() => {});
    setActivo(activar);
    return true;
  }, []);

  if (!listo) return null;

  return (
    <BloqueoContext.Provider value={{ disponible, activo, cambiar }}>
      {children}
      {activo && (bloqueada || enFondo) && (
        <View style={estilos.cubierta}>
          <Text style={estilos.marca}>Mis finanzas</Text>
          {bloqueada && !enFondo && (
            <>
              <Text style={[texto.nota, { marginBottom: espacio.xl }]}>Protegida con Face ID o huella.</Text>
              <Boton titulo="Desbloquear" onPress={desbloquear} />
            </>
          )}
        </View>
      )}
    </BloqueoContext.Provider>
  );
}

export const useBloqueo = () => useContext(BloqueoContext);

const estilos = StyleSheet.create({
  cubierta: { ...StyleSheet.absoluteFill, backgroundColor: colores.papel, justifyContent: 'center', paddingHorizontal: espacio.xl },
  marca: { fontSize: 34, fontWeight: '800', color: colores.tinta, letterSpacing: -0.5, marginBottom: espacio.s },
});
