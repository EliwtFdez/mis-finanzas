import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colores, espacio, texto } from '@/lib/tema';
import { MESES, aPesos, fechaATexto, fechaLegible, textoAFecha } from '@/lib/formato';
import { usePeriodo } from '@/lib/periodo';
import { aparienciaCategoria, GRIS_CATEGORIA } from '@/domain/categorias';
import type { Categoria, SegmentoReparto } from '@/domain/finanzas';

// ─── Estructura de pantalla ───────────────────────────────────

export function Pantalla({
  titulo,
  conMes = true,
  children,
  pie,
  lista = false,
}: {
  titulo: string;
  conMes?: boolean;
  children: ReactNode;
  pie?: ReactNode;
  /** El contenido trae su propia lista virtualizada (usa `contenidoPantalla` como contentContainerStyle). */
  lista?: boolean;
}) {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <View style={estilos.encabezado}>
        <Text style={texto.titulo}>{titulo}</Text>
        {conMes && <SelectorMes />}
      </View>
      {lista ? (
        <View style={{ flex: 1 }}>{children}</View>
      ) : (
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      )}
      {pie}
    </SafeAreaView>
  );
}

export function SelectorMes() {
  const { anio, mes, mover } = usePeriodo();
  return (
    <View style={estilos.selectorMes}>
      <Pressable onPress={() => mover(-1)} hitSlop={12} accessibilityLabel="Mes anterior" style={estilos.flecha}>
        <Text style={estilos.flechaTexto}>‹</Text>
      </Pressable>
      <Text style={estilos.mesTexto}>
        {MESES[mes - 1]} {anio}
      </Text>
      <Pressable onPress={() => mover(1)} hitSlop={12} accessibilityLabel="Mes siguiente" style={estilos.flecha}>
        <Text style={estilos.flechaTexto}>›</Text>
      </Pressable>
    </View>
  );
}

export function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <View style={estilos.seccion}>
      <EncabezadoSeccion titulo={titulo} accion={accion} />
      {children}
    </View>
  );
}

/** El título subrayado de una Seccion; suelto sirve de encabezado en una SectionList. */
export function EncabezadoSeccion({ titulo, accion }: { titulo: string; accion?: ReactNode }) {
  return (
    <View style={estilos.seccionEncabezado}>
      <Text style={texto.seccion}>{titulo}</Text>
      {accion}
    </View>
  );
}

/** Fila tipo renglón de libro de cuentas. */
export function Renglon({
  izquierda,
  detalle,
  derecha,
  derechaColor,
  onPress,
  aviso,
  icono,
}: {
  izquierda: string;
  detalle?: string;
  derecha?: string;
  derechaColor?: string;
  onPress?: () => void;
  aviso?: string;
  /** Va a la izquierda, p. ej. <IconoCategoria />. */
  icono?: ReactNode;
}) {
  const contenido = (
    <View style={estilos.renglon}>
      {icono}
      <View style={{ flex: 1 }}>
        <Text style={texto.cuerpo} numberOfLines={1}>
          {izquierda}
        </Text>
        {!!detalle && (
          <Text style={texto.nota} numberOfLines={1}>
            {detalle}
          </Text>
        )}
        {!!aviso && <Text style={estilos.aviso}>{aviso}</Text>}
      </View>
      {!!derecha && <Text style={[texto.cifra, derechaColor ? { color: derechaColor } : null]}>{derecha}</Text>}
    </View>
  );
  if (!onPress) return contenido;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { backgroundColor: colores.verdeClaro } : null)}>
      {contenido}
    </Pressable>
  );
}

export function Cifra({ etiqueta, valor, color }: { etiqueta: string; valor: number; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={texto.nota}>{etiqueta}</Text>
      <Text style={[texto.cifra, { fontWeight: '600', marginTop: 2 }, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {aPesos(valor)}
      </Text>
    </View>
  );
}

/** Barra de avance gastado/presupuesto. Se pone roja al pasarse. */
export function Barra({ valor, maximo, alto = 6, color }: { valor: number; maximo: number; alto?: number; color?: string }) {
  const proporcion = maximo > 0 ? Math.min(valor / maximo, 1) : 0;
  const excedido = valor > maximo;
  return (
    <View style={[estilos.barraFondo, { height: alto, borderRadius: alto / 2 }]}>
      <View
        style={{
          width: `${proporcion * 100}%`,
          height: '100%',
          borderRadius: alto / 2,
          backgroundColor: color ?? (excedido ? colores.rojo : colores.verde),
        }}
      />
    </View>
  );
}

/** Círculo con el emoji de la categoría (o su inicial) sobre un tinte de su color. */
export function IconoCategoria({ categoria, tamano = 28 }: { categoria: Pick<Categoria, 'nombre' | 'icono' | 'color'>; tamano?: number }) {
  const a = aparienciaCategoria(categoria);
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: a.color + '26', // ~15% de opacidad
      }}
      accessible={false}
    >
      <Text style={{ fontSize: tamano * (a.esEmoji ? 0.5 : 0.45), fontWeight: '700', color: colores.tinta }}>{a.simbolo}</Text>
    </View>
  );
}

const porcentaje = (p: number) => (p > 0 && p < 0.01 ? '<1' : String(Math.round(p * 100)));

/**
 * Barra apilada de parte-del-total con leyenda en el mismo orden. El color nunca va solo:
 * cada segmento se nombra con emoji, nombre y porcentaje (la paleta no separa todos los pares).
 */
export function BarraReparto({ segmentos }: { segmentos: SegmentoReparto[] }) {
  const nombre = (s: SegmentoReparto) => s.categoria?.nombre ?? 'Otras';
  const color = (s: SegmentoReparto) => (s.categoria ? aparienciaCategoria(s.categoria).color : GRIS_CATEGORIA);
  return (
    <View style={{ paddingTop: espacio.m }}>
      <View
        style={estilos.reparto}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Reparto del gasto: ${segmentos.map((s) => `${nombre(s)} ${porcentaje(s.proporcion)}%`).join(', ')}`}
      >
        {segmentos.map((s) => (
          <View key={s.categoria?.id ?? 'otras'} style={{ flex: s.proporcion, minWidth: 3, backgroundColor: color(s) }} />
        ))}
      </View>
      <View style={estilos.repartoLeyenda} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {segmentos.map((s) => (
          <View key={s.categoria?.id ?? 'otras'} style={estilos.repartoEtiqueta}>
            <View style={[estilos.repartoMuestra, { backgroundColor: color(s) }]} />
            <Text style={texto.nota}>
              {s.categoria?.icono ? `${s.categoria.icono} ` : ''}
              {nombre(s)} <Text style={{ color: colores.tinta, fontWeight: '600' }}>{porcentaje(s.proporcion)}%</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <Text style={[texto.nota, { paddingVertical: espacio.l }]}>{children}</Text>;
}

export function Cargando() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.papel }}>
      <ActivityIndicator color={colores.verde} />
    </View>
  );
}

export function MensajeError({ children }: { children: ReactNode }) {
  return (
    <View style={estilos.error}>
      <Text style={{ color: colores.rojo, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

// ─── Controles ────────────────────────────────────────────────

export function Boton({
  titulo,
  onPress,
  variante = 'principal',
  deshabilitado,
  estilo,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'principal' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
  estilo?: ViewStyle;
}) {
  const fondo = variante === 'principal' ? colores.verde : 'transparent';
  const color = variante === 'principal' ? '#FFFFFF' : variante === 'peligro' ? colores.rojo : colores.verde;
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: fondo, opacity: deshabilitado ? 0.4 : pressed ? 0.75 : 1 },
        variante !== 'principal' && { borderWidth: 1, borderColor: color },
        estilo,
      ]}
    >
      <Text style={{ color, fontSize: 16, fontWeight: '600' }}>{titulo}</Text>
    </Pressable>
  );
}

/** Botón flotante para registrar rápido. */
export function BotonFlotante({ titulo, onPress }: { titulo: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [estilos.flotante, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{titulo}</Text>
    </Pressable>
  );
}

export function Campo({ etiqueta, ayuda, ...props }: TextInputProps & { etiqueta: string; ayuda?: string }) {
  return (
    <View style={{ marginBottom: espacio.l }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor={colores.tintaSuave} {...props} style={[estilos.campo, props.style]} />
      {!!ayuda && <Text style={[texto.nota, { marginTop: 4 }]}>{ayuda}</Text>}
    </View>
  );
}

export function Opciones<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  etiquetaDe = (o) => o,
}: {
  etiqueta?: string;
  opciones: readonly T[];
  valor: T | null;
  onCambio: (v: T) => void;
  etiquetaDe?: (o: T) => string;
}) {
  return (
    <View style={{ marginBottom: espacio.l }}>
      {!!etiqueta && <Text style={estilos.etiqueta}>{etiqueta}</Text>}
      <View style={estilos.opciones}>
        {opciones.map((o) => {
          const activo = o === valor;
          return (
            <Pressable
              key={o}
              onPress={() => onCambio(o)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              style={[estilos.opcion, activo && estilos.opcionActiva]}
            >
              <Text style={{ color: activo ? '#FFFFFF' : colores.tinta, fontSize: 14 }}>{etiquetaDe(o)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CampoFecha({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);

  if (Platform.OS === 'ios') {
    return (
      <View style={[{ marginBottom: espacio.l }, estilos.filaFecha]}>
        <Text style={estilos.etiqueta}>{etiqueta}</Text>
        <DateTimePicker
          value={textoAFecha(valor)}
          mode="date"
          display="compact"
          locale="es-MX"
          onChange={(_e, d) => d && onCambio(fechaATexto(d))}
        />
      </View>
    );
  }

  return (
    <View style={{ marginBottom: espacio.l }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Pressable onPress={() => setAbierto(true)} style={estilos.campo} accessibilityRole="button">
        <Text style={texto.cuerpo}>{fechaLegible(valor, true)}</Text>
      </Pressable>
      {abierto && (
        <DateTimePicker
          value={textoAFecha(valor)}
          mode="date"
          onChange={(_e, d) => {
            setAbierto(false);
            if (d) onCambio(fechaATexto(d));
          }}
        />
      )}
    </View>
  );
}

export const contenidoPantalla = { paddingHorizontal: espacio.l, paddingBottom: 120 } as const;

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.papel },
  encabezado: {
    paddingHorizontal: espacio.l,
    paddingTop: espacio.s,
    paddingBottom: espacio.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contenido: contenidoPantalla,
  selectorMes: { flexDirection: 'row', alignItems: 'center' },
  flecha: { paddingHorizontal: espacio.s },
  flechaTexto: { fontSize: 24, color: colores.verde, lineHeight: 26 },
  mesTexto: { fontSize: 15, fontWeight: '600', color: colores.tinta, minWidth: 116, textAlign: 'center' },
  seccion: { marginTop: espacio.xl },
  // 2px de separación entre segmentos y extremos redondeados de 4px (skill dataviz).
  reparto: { flexDirection: 'row', gap: 2, height: 12, borderRadius: 4, overflow: 'hidden' },
  repartoLeyenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.m, rowGap: 4, marginTop: espacio.s },
  repartoEtiqueta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repartoMuestra: { width: 10, height: 10, borderRadius: 2 },
  seccionEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: espacio.s,
    borderBottomWidth: 2,
    borderBottomColor: colores.tinta,
  },
  renglon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingVertical: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.linea,
  },
  aviso: {
    alignSelf: 'flex-start',
    marginTop: 4,
    fontSize: 12,
    color: colores.tinta,
    backgroundColor: colores.ambarClaro,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  barraFondo: { backgroundColor: colores.linea, overflow: 'hidden' },
  error: { backgroundColor: colores.rojoClaro, padding: espacio.m, marginTop: espacio.m },
  boton: { paddingVertical: 14, paddingHorizontal: espacio.l, alignItems: 'center', borderRadius: 10 },
  flotante: {
    position: 'absolute',
    right: espacio.l,
    bottom: espacio.l,
    backgroundColor: colores.verde,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
    elevation: 4,
    shadowColor: colores.tinta,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  etiqueta: { fontSize: 13, fontWeight: '600', color: colores.tintaSuave, marginBottom: 6 },
  campo: {
    backgroundColor: colores.hoja,
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: 8,
    paddingHorizontal: espacio.m,
    paddingVertical: 12,
    fontSize: 16,
    color: colores.tinta,
  },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  opcion: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colores.linea,
    backgroundColor: colores.hoja,
  },
  opcionActiva: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  filaFecha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
