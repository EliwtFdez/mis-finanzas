import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider, useSesion } from '@/lib/sesion';
import { BloqueoProvider } from '@/lib/bloqueo';
import { PeriodoProvider } from '@/lib/periodo';
import { Cargando } from '@/components/ui';
import { colores } from '@/lib/tema';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BloqueoProvider>
        <SesionProvider>
          <PeriodoProvider>
            <StatusBar style="dark" />
            <Navegacion />
          </PeriodoProvider>
        </SesionProvider>
      </BloqueoProvider>
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
        <Stack.Screen name="importar-estado" options={{ presentation: 'modal', headerShown: true, title: 'Importar estado de cuenta' }} />
        <Stack.Screen name="operacion" options={{ presentation: 'modal', headerShown: true }} />
        <Stack.Screen name="msi" options={{ presentation: 'modal', headerShown: true, title: 'Meses sin intereses' }} />
        <Stack.Screen name="revisar" options={{ presentation: 'modal', headerShown: true, title: 'Gastos por revisar' }} />
        <Stack.Screen name="categorias" options={{ presentation: 'modal', headerShown: true, title: 'Categorías' }} />
        <Stack.Screen name="atajos" options={{ presentation: 'modal', headerShown: true, title: 'Apple Pay con Atajos' }} />
      </Stack.Protected>
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="acceso" />
      </Stack.Protected>
    </Stack>
  );
}
