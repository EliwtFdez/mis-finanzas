import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { colores } from '@/lib/tema';
import { IconoAcciones, IconoMovimientos, IconoPresupuesto, IconoResumen, IconoUsuario } from '@/components/iconosPestanas';

export default function PestanasLayout() {
  return (
    <Tabs tabBar={(props) => <BarraPestanas {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Resumen' }} />
      <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="inversiones" options={{ title: 'Acciones' }} />
      <Tabs.Screen name="presupuesto" options={{ title: 'Presupuesto' }} />
      <Tabs.Screen name="usuario" options={{ title: 'Usuario' }} />
    </Tabs>
  );
}

const ICONOS = {
  index: IconoResumen,
  movimientos: IconoMovimientos,
  inversiones: IconoAcciones,
  presupuesto: IconoPresupuesto,
  usuario: IconoUsuario,
} as const;

/** Pestañas con ícono y una píldora suave que marca la sección activa. */
function BarraPestanas({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[estilos.barra, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((ruta, i) => {
        const activa = state.index === i;
        const titulo = descriptors[ruta.key].options.title ?? ruta.name;
        const Icono = ICONOS[ruta.name as keyof typeof ICONOS] ?? IconoResumen;
        const color = activa ? colores.verde : colores.tintaSuave;
        return (
          <Pressable
            key={ruta.key}
            accessibilityRole="tab"
            accessibilityLabel={titulo}
            accessibilityState={{ selected: activa }}
            onPress={() => {
              const evento = navigation.emit({ type: 'tabPress', target: ruta.key, canPreventDefault: true });
              if (!activa && !evento.defaultPrevented) navigation.navigate(ruta.name);
            }}
            style={estilos.pestana}
          >
            {({ pressed }) => (
              <View style={[estilos.pildora, activa && estilos.pildoraActiva, pressed && estilos.presionada]}>
                <Icono color={color} />
                <Text style={[estilos.texto, activa && estilos.textoActivo]} numberOfLines={1}>
                  {titulo}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: colores.hoja,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  pestana: { flex: 1, alignItems: 'center' },
  pildora: { alignItems: 'center', gap: 2, paddingTop: 6, paddingBottom: 5, paddingHorizontal: 10, borderRadius: 16, minWidth: 64 },
  pildoraActiva: { backgroundColor: colores.verdeClaro },
  presionada: { opacity: 0.65 },
  texto: { fontSize: 11, color: colores.tintaSuave, marginTop: 1 },
  textoActivo: { color: colores.verde, fontWeight: '700' },
});
