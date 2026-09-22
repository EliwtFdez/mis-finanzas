import type { ReactNode } from 'react';
import { View } from 'react-native';

const TAMANO = 22;

function Caja({ children }: { children: ReactNode }) {
  return <View style={{ width: TAMANO, height: TAMANO, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

/** Mini gráfica de barras: resumen del mes. */
export function IconoResumen({ color }: { color: string }) {
  return (
    <Caja>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        <View style={{ width: 4, height: 8, borderRadius: 1.5, backgroundColor: color }} />
        <View style={{ width: 4, height: 16, borderRadius: 1.5, backgroundColor: color }} />
        <View style={{ width: 4, height: 12, borderRadius: 1.5, backgroundColor: color }} />
      </View>
    </Caja>
  );
}

/** Flechas de ida y vuelta: entradas y salidas de dinero. */
export function IconoMovimientos({ color }: { color: string }) {
  return (
    <Caja>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 3.5,
              borderRightWidth: 3.5,
              borderBottomWidth: 6,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: color,
            }}
          />
          <View style={{ width: 2, height: 7, backgroundColor: color, marginTop: 1, borderRadius: 1 }} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 2, height: 7, backgroundColor: color, marginBottom: 1, borderRadius: 1 }} />
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 3.5,
              borderRightWidth: 3.5,
              borderTopWidth: 6,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: color,
            }}
          />
        </View>
      </View>
    </Caja>
  );
}

function Vela({ color, altoMecha, altoCuerpo }: { color: string; altoMecha: number; altoCuerpo: number }) {
  const ancho = 6;
  const alto = 20;
  return (
    <View style={{ width: ancho, height: alto }}>
      <View
        style={{
          position: 'absolute',
          left: (ancho - 1.5) / 2,
          top: (alto - altoMecha) / 2,
          width: 1.5,
          height: altoMecha,
          borderRadius: 1,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: (alto - altoCuerpo) / 2,
          width: ancho,
          height: altoCuerpo,
          borderRadius: 1.5,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Par de velas: gráfica de acciones. */
export function IconoAcciones({ color }: { color: string }) {
  return (
    <Caja>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        <Vela color={color} altoMecha={18} altoCuerpo={7} />
        <Vela color={color} altoMecha={13} altoCuerpo={9} />
      </View>
    </Caja>
  );
}

/** Cartera con broche: presupuesto. */
export function IconoPresupuesto({ color }: { color: string }) {
  return (
    <Caja>
      <View
        style={{
          width: 19,
          height: 14,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 4,
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingRight: 2.5,
        }}
      >
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      </View>
    </Caja>
  );
}

/** Silueta de cabeza y hombros: usuario. */
export function IconoUsuario({ color }: { color: string }) {
  return (
    <Caja>
      <View style={{ width: 22, height: 19, alignItems: 'center', overflow: 'hidden' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color, marginTop: 2 }} />
      </View>
    </Caja>
  );
}
