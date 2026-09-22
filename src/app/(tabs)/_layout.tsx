import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { colores } from '@/lib/tema';

export default function PestanasLayout() {
  return (
    <Tabs tabBar={(props) => <BarraPestanas {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Resumen' }} />
      <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="inversiones" options={{ title: 'Acciones' }} />
      <Tabs.Screen name="presupuesto" options={{ title: 'Presupuesto' }} />
    </Tabs>
  );
}

/** Pestañas como separadores de un libro de cuentas: texto, sin íconos. */
function BarraPestanas({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[estilos.barra, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((ruta, i) => {
        const activa = state.index === i;
        const titulo = descriptors[ruta.key].options.title ?? ruta.name;
        return (
          <Pressable
            key={ruta.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            onPress={() => {
              const evento = navigation.emit({ type: 'tabPress', target: ruta.key, canPreventDefault: true });
              if (!activa && !evento.defaultPrevented) navigation.navigate(ruta.name);
            }}
            style={[estilos.pestana, activa && estilos.pestanaActiva]}
          >
            <Text style={[estilos.texto, activa && estilos.textoActivo]} numberOfLines={1}>
              {titulo}
            </Text>
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
  },
  pestana: { flex: 1, alignItems: 'center', paddingTop: 14, paddingBottom: 6, borderTopWidth: 3, borderTopColor: 'transparent' },
  pestanaActiva: { borderTopColor: colores.verde },
  texto: { fontSize: 13, color: colores.tintaSuave },
  textoActivo: { color: colores.tinta, fontWeight: '700' },
});
