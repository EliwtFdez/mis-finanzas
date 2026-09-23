import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import type { TipoMovimiento } from '@/domain/finanzas';
import { proximaFecha, type Recurrente } from '@/domain/recurrentes';
import { borrarRecurrente, cargarCategorias, cargarRecurrentes, guardarRecurrente, mensajeError } from '@/lib/datos';
import { aPesos, fechaLegible, leerNumero } from '@/lib/formato';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, Campo, MensajeError, Opciones, Renglon, Seccion, Vacio } from '@/components/ui';

const TIPOS = ['Gasto', 'Ingreso'] as const;
const MEDIOS = ['Efectivo', 'Debito', 'Credito', 'Transferencia'] as const;
const nombreMedio = (m: string) => ({ Debito: 'Débito', Credito: 'Crédito' })[m] ?? m;

export default function Fijos() {
  const { datos, error: errorCarga, recargar } = useCarga(async () => {
    const [categorias, recurrentes] = await Promise.all([cargarCategorias(), cargarRecurrentes()]);
    return { categorias, recurrentes };
  }, []);

  const [editando, setEditando] = useState<string | 'nuevo' | null>(null);
  const [tipo, setTipo] = useState<TipoMovimiento>('Gasto');
  const [descripcion, setDescripcion] = useState('');
  const [importe, setImporte] = useState('');
  const [dia, setDia] = useState('1');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [medio, setMedio] = useState<(typeof MEDIOS)[number] | null>(null);
  const [cuenta, setCuenta] = useState('');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delTipo = (datos?.categorias ?? []).filter((c) => c.tipo === tipo);
  const monto = leerNumero(importe);
  const diaNum = Number(dia);
  const faltante = !descripcion.trim()
    ? 'Escribe una descripción.'
    : !monto || monto <= 0
      ? 'Escribe un importe mayor que cero.'
      : !Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31
        ? 'El día debe ser de 1 a 31.'
        : !categoriaId
          ? 'Elige una categoría.'
          : null;

  function abrir(r?: Recurrente) {
    setError(null);
    setEditando(r?.id ?? 'nuevo');
    setTipo(r?.tipo ?? 'Gasto');
    setDescripcion(r?.descripcion ?? '');
    setImporte(r ? String(r.importe) : '');
    setDia(String(r?.dia ?? 1));
    setCategoriaId(r?.categoria_id ?? null);
    setMedio((r?.medio_pago as (typeof MEDIOS)[number]) ?? null);
    setCuenta(r?.cuenta ?? '');
    setActivo(r?.activo ?? true);
  }

  async function guardar() {
    if (faltante) return setError(faltante);
    setGuardando(true);
    setError(null);
    try {
      await guardarRecurrente(
        { tipo, descripcion: descripcion.trim(), importe: monto!, dia: diaNum, categoria_id: categoriaId!, medio_pago: medio, cuenta: cuenta.trim() || null, activo },
        editando === 'nuevo' ? undefined : editando!,
      );
      setEditando(null);
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  function borrar() {
    Alert.alert('Borrar fijo', 'Dejará de registrarse. Los movimientos que ya creó se conservan.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await borrarRecurrente(editando!);
            setEditando(null);
            recargar();
          } catch (e) {
            setError(mensajeError(e));
          }
        },
      },
    ]);
  }

  const lista = datos?.recurrentes ?? [];
  const nombreCategoria = (id: string) => datos?.categorias.find((c) => c.id === id)?.nombre ?? '';
  const gastoMensual = lista.filter((r) => r.activo && r.tipo === 'Gasto').reduce((s, r) => s + r.importe, 0);
  const ingresoMensual = lista.filter((r) => r.activo && r.tipo === 'Ingreso').reduce((s, r) => s + r.importe, 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colores.papel }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Gastos e ingresos fijos' }} />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text style={texto.nota}>
          Renta, suscripciones, sueldo… Se registran solos cada mes en su día cuando abres la app. Si borras uno de esos movimientos, no se
          vuelve a crear.
        </Text>
        {(errorCarga || error) && <MensajeError>{errorCarga ?? error}</MensajeError>}

        {editando ? (
          <View style={estilos.formulario}>
            <Opciones opciones={TIPOS} valor={tipo} onCambio={(t) => { setTipo(t); setCategoriaId(null); }} />
            <Campo etiqueta="Descripción" value={descripcion} onChangeText={setDescripcion} placeholder={tipo === 'Gasto' ? 'Ej. Renta' : 'Ej. Sueldo'} />
            <Campo etiqueta="Importe en MXN" value={importe} onChangeText={setImporte} keyboardType="decimal-pad" placeholder="0.00" />
            <Campo
              etiqueta="Día del mes"
              value={dia}
              onChangeText={(v) => setDia(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
              ayuda="Si el mes tiene menos días, se registra el último día."
            />
            <Opciones
              etiqueta="Categoría"
              opciones={delTipo.map((c) => c.id)}
              valor={categoriaId}
              onCambio={setCategoriaId}
              etiquetaDe={(id) => delTipo.find((c) => c.id === id)?.nombre ?? ''}
            />
            <Opciones etiqueta="Medio de pago" opciones={MEDIOS} valor={medio} onCambio={setMedio} etiquetaDe={nombreMedio} />
            <Campo etiqueta="Cuenta" value={cuenta} onChangeText={setCuenta} placeholder="Opcional" />
            {editando !== 'nuevo' && (
              <View style={estilos.interruptor}>
                <Text style={[texto.cuerpo, { flex: 1 }]}>Activo</Text>
                <Switch value={activo} onValueChange={setActivo} trackColor={{ false: colores.linea, true: colores.verdeClaro }} thumbColor={activo ? colores.verde : '#FFFFFF'} />
              </View>
            )}
            <Boton titulo={guardando ? 'Guardando…' : 'Guardar'} onPress={guardar} deshabilitado={guardando || !!faltante} />
            <Boton titulo="Cancelar" variante="secundario" onPress={() => setEditando(null)} estilo={{ marginTop: espacio.s }} />
            {editando !== 'nuevo' && <Boton titulo="Borrar" variante="peligro" onPress={borrar} estilo={{ marginTop: espacio.s }} />}
          </View>
        ) : (
          <Boton titulo="+ Nuevo fijo" onPress={() => abrir()} estilo={{ marginTop: espacio.m }} />
        )}

        <Seccion titulo="Tus fijos">
          {datos && lista.length === 0 && <Vacio>Aún no tienes gastos ni ingresos fijos.</Vacio>}
          {lista.map((r) => (
            <Renglon
              key={r.id}
              izquierda={r.descripcion}
              detalle={`${r.activo ? `Próximo: ${fechaLegible(proximaFecha(r), true)}` : 'Pausado'} · ${nombreCategoria(r.categoria_id)}`}
              derecha={(r.tipo === 'Gasto' ? '−' : '+') + aPesos(r.importe)}
              derechaColor={r.tipo === 'Gasto' ? colores.tinta : colores.verde}
              onPress={() => abrir(r)}
            />
          ))}
        </Seccion>
        {lista.length > 0 && (
          <Text style={[texto.nota, { marginTop: espacio.l }]}>
            Al mes: {aPesos(gastoMensual)} en gastos fijos{ingresoMensual ? ` y ${aPesos(ingresoMensual)} de ingresos fijos` : ''}.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, paddingBottom: 48 },
  formulario: { marginTop: espacio.m, padding: espacio.l, backgroundColor: colores.hoja, borderRadius: 10, borderWidth: 1, borderColor: colores.linea },
  interruptor: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.l },
});
