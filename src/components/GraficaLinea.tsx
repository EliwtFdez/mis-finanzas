import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { escalaGrafica, netoDeFoto, puntoCercano, type FotoPatrimonio } from '@/domain/patrimonio';
import { aPesos, aPesosCortos, fechaLegible } from '@/lib/formato';
import { colores, espacio, texto } from '@/lib/tema';

const ALTO = 150;
const EJE = 56; // ancho reservado para las etiquetas del eje Y
const ARRIBA = 8; // aire arriba y abajo para que el punto no se corte
const LADO = 8; // aire a cada lado para que los puntos de los extremos no se corten
const COLOR = colores.verde;

/**
 * Patrimonio en el tiempo: una sola serie (sin leyenda), línea de 2px, relleno al 10%,
 * cuadrícula fina y el valor final rotulado. Tocar o arrastrar elige un día y su valor queda arriba
 * (en el teléfono no hay «hover»: la selección se mantiene al soltar).
 */
export function GraficaLinea({ fotos }: { fotos: FotoPatrimonio[] }) {
  const [ancho, setAncho] = useState(0);
  // Se guarda la fecha, no el punto: si cambian los datos o la escala, el punto se recalcula.
  const [fechaElegida, setFechaElegida] = useState<string | null>(null);

  const lienzo = Math.max(0, ancho - EJE);
  const { puntos, marcas } = escalaGrafica(fotos, Math.max(0, lienzo - LADO * 2), ALTO);
  const ultimo = puntos[puntos.length - 1];
  const elegido = puntos.find((p) => p.fecha === fechaElegida) ?? null;
  const mostrado = elegido ?? ultimo;
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${(p.x + LADO).toFixed(1)},${(p.y + ARRIBA).toFixed(1)}`).join(' ');
  const area = puntos.length ? `${linea} L${(ultimo.x + LADO).toFixed(1)},${ALTO + ARRIBA} L${LADO},${ALTO + ARRIBA} Z` : '';

  // locationX es relativo al contenedor: los hijos no reciben toques (pointerEvents="none").
  const inspeccionar = (x: number) => setFechaElegida(puntoCercano(puntos, x - EJE - LADO)?.fecha ?? null);

  return (
    <View
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => inspeccionar(e.nativeEvent.locationX)}
      onResponderMove={(e) => inspeccionar(e.nativeEvent.locationX)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Patrimonio neto: de ${aPesos(netoDeFoto(fotos[0]))} el ${fechaLegible(fotos[0].fecha, true)} a ${aPesos(netoDeFoto(fotos[fotos.length - 1]))} el ${fechaLegible(fotos[fotos.length - 1].fecha, true)}`}
    >
      {mostrado && (
        <Text style={[texto.nota, { marginBottom: espacio.xs }]} pointerEvents="none">
          {fechaLegible(mostrado.fecha, true)} · <Text style={estilos.valor}>{aPesos(mostrado.valor)}</Text>
        </Text>
      )}
      {ancho > 0 && (
        <View style={{ height: ALTO + ARRIBA * 2 }} pointerEvents="none">
          {marcas.map((m) => (
            <Text key={m.valor} style={[estilos.marca, { top: m.y + ARRIBA - 7 }]} numberOfLines={1}>
              {aPesosCortos(m.valor)}
            </Text>
          ))}
          <Svg width={lienzo} height={ALTO + ARRIBA * 2} style={{ marginLeft: EJE }}>
            {marcas.map((m) => (
              <Line key={m.valor} x1={0} x2={lienzo} y1={m.y + ARRIBA} y2={m.y + ARRIBA} stroke={colores.linea} strokeWidth={1} />
            ))}
            <Path d={area} fill={COLOR} fillOpacity={0.1} />
            <Path d={linea} stroke={COLOR} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {elegido && <Line x1={elegido.x + LADO} x2={elegido.x + LADO} y1={0} y2={ALTO + ARRIBA * 2} stroke={colores.tintaSuave} strokeWidth={1} />}
            {mostrado && <Circle cx={mostrado.x + LADO} cy={mostrado.y + ARRIBA} r={5} fill={COLOR} stroke={colores.papel} strokeWidth={2} />}
          </Svg>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  valor: { color: colores.tinta, fontWeight: '600', fontVariant: ['tabular-nums'] },
  marca: { position: 'absolute', left: 0, width: EJE - 6, textAlign: 'right', fontSize: 11, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
});
