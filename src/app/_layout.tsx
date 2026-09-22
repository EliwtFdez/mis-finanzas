import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider, useSesion } from '@/lib/sesion';
import { PeriodoProvider } from '@/lib/periodo';
import { Cargando } from '@/components/ui';
import { colores } from '@/lib/tema';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SesionProvider>
        <PeriodoProvider>
          <StatusBar style="dark" />
          <Navegacion />
        </PeriodoProvider>
      </SesionProvider>
    </SafeAreaProvider>
  );
}

function Navegacion() {
  const { sesion, cargando } = useSesion();
  if (cargando) return <Cargando />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colores.papel },
        headerStyle: { backgroundColor: colores.papel },
        headerTintColor: colores.verde,
        headerTitleStyle: { color: colores.tinta },
        headerShadowVisible: false,
      }}
    >
      <Stack.Protected guard={!!sesion}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="movimiento" options={{ presentation: 'modal', headerShown: true }} />
        <Stack.Screen name="operacion" options={{ presentation: 'modal', headerShown: true }} />
      </Stack.Protected>
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="acceso" />
      </Stack.Protected>
    </Stack>
  );
}
