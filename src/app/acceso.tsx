import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { mensajeError } from '@/lib/datos';
import { Boton, Campo, MensajeError } from '@/components/ui';
import { colores, espacio, texto } from '@/lib/tema';

export default function Acceso() {
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: correo.trim(), password: clave });
        if (error) throw error;
        if (!data.session) setAviso('Te enviamos un correo. Confírmalo y luego entra con tu contraseña.');
      }
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colores.papel }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={estilos.contenedor}>
        <Text style={estilos.marca}>Mis finanzas</Text>
        <Text style={[texto.nota, { marginBottom: espacio.xxl }]}>
          Tus gastos, presupuesto y acciones en pesos, en un solo lugar.
        </Text>

        <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Campo
          etiqueta="Contraseña"
          value={clave}
          onChangeText={setClave}
          secureTextEntry
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          ayuda={modo === 'registro' ? 'Mínimo 6 caracteres.' : undefined}
        />

        <Boton
          titulo={modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          onPress={enviar}
          deshabilitado={enviando || !correo || clave.length < 6}
        />
        {error && <MensajeError>{error}</MensajeError>}
        {aviso && <Text style={[texto.nota, { marginTop: espacio.m }]}>{aviso}</Text>}

        <View style={{ marginTop: espacio.xl }}>
          <Boton
            variante="secundario"
            titulo={modo === 'entrar' ? 'Crear una cuenta nueva' : 'Ya tengo cuenta'}
            onPress={() => setModo(modo === 'entrar' ? 'registro' : 'entrar')}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'center', paddingHorizontal: espacio.xl },
  marca: { fontSize: 34, fontWeight: '800', color: colores.tinta, letterSpacing: -0.5, marginBottom: espacio.s },
});
