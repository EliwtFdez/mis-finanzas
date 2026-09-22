import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { Categoria, TipoMovimiento } from '@/domain/finanzas';
import { borrarMovimiento, cargarCategorias, cargarMovimiento, cuentasUsadas, guardarMovimiento } from '@/lib/datos';
import { hoy, leerNumero } from '@/lib/formato';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, Campo, CampoFecha, Cargando, MensajeError, Opciones } from '@/components/ui';

const TIPOS = ['Gasto', 'Ingreso'] as const;
const MEDIOS = ['Efectivo', 'Debito', 'Credito', 'Transferencia'] as const;
const nombreMedio = (m: string) => ({ Debito: 'Débito', Credito: 'Crédito' })[m] ?? m;

export default function FormularioMovimiento() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [cuentas, setCuentas] = useState<string[]>([]);
  const [tipo, setTipo] = useState<TipoMovimiento>('Gasto');
  const [importe, setImporte] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoy());
  const [descripcion, setDescripcion] = useState('');
  const [medio, setMedio] = useState<(typeof MEDIOS)[number] | null>(null);
  const [cuenta, setCuenta] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cats, ctas] = await Promise.all([cargarCategorias(), cuentasUsadas()]);
        setCategorias(cats);
        setCuentas(ctas);
        if (id) {
          const m = await cargarMovimiento(id);
          setTipo(m.tipo);
          setImporte(String(m.importe));
          setCategoriaId(m.categoria_id);
          setFecha(m.fecha);
          setDescripcion(m.descripcion ?? '');
          setMedio((m.medio_pago as (typeof MEDIOS)[number]) ?? null);
          setCuenta(m.cuenta ?? '');
          setNotas(m.notas ?? '');
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [id]);

  if (!categorias) return error ? <MensajeError>{error}</MensajeError> : <Cargando />;

  const delTipo = categorias.filter((c) => c.tipo === tipo);
  const monto = leerNumero(importe);
  const faltante = !monto || monto <= 0 ? 'Escribe un importe mayor que cero.' : !categoriaId ? 'Elige una categoría.' : null;

  function cambiarTipo(t: TipoMovimiento) {
    setTipo(t);
    // La categoría debe ser del mismo tipo (Sueldo no puede ser un gasto)
    if (categoriaId && categorias!.find((c) => c.id === categoriaId)?.tipo !== t) setCategoriaId(null);
  }

  async function guardar() {
    if (faltante) return setError(faltante);
    setGuardando(true);
    setError(null);
    try {
      await guardarMovimiento(
        {
          tipo,
          fecha,
          categoria_id: categoriaId!,
          importe: monto!,
          descripcion: descripcion.trim() || null,
          medio_pago: medio,
          cuenta: cuenta.trim() || null,
          notas: notas.trim() || null,
        },
        id,
      );
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  function confirmarBorrado() {
    Alert.alert('Borrar movimiento', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await borrarMovimiento(id!);
            router.back();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id ? 'Editar movimiento' : 'Nuevo movimiento' }} />
      <ScrollView contentContainerStyle={{ padding: espacio.l, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Opciones opciones={TIPOS} valor={tipo} onCambio={cambiarTipo} />

        <Campo
          etiqueta="Importe en MXN"
          value={importe}
          onChangeText={setImporte}
          keyboardType="decimal-pad"
          placeholder="0.00"
          autoFocus={!id}
          style={{ fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}
        />

        <Opciones
          etiqueta="Categoría"
          opciones={delTipo.map((c) => c.id)}
          valor={categoriaId}
          onCambio={setCategoriaId}
          etiquetaDe={(cid) => delTipo.find((c) => c.id === cid)?.nombre ?? ''}
        />

        <CampoFecha etiqueta="Fecha" valor={fecha} onCambio={setFecha} />
        <Campo etiqueta="Descripción" value={descripcion} onChangeText={setDescripcion} placeholder="Ej. Supermercado" />
        <Opciones etiqueta="Medio de pago" opciones={MEDIOS} valor={medio} onCambio={setMedio} etiquetaDe={nombreMedio} />

        <Campo etiqueta="Cuenta" value={cuenta} onChangeText={setCuenta} placeholder="Ej. Nómina, tarjeta departamental" />
        {cuentas.length > 0 && (
          <View style={{ marginTop: -espacio.s, marginBottom: espacio.s }}>
            <Opciones opciones={cuentas} valor={cuenta} onCambio={setCuenta} />
          </View>
        )}

        <Campo etiqueta="Notas" value={notas} onChangeText={setNotas} multiline />

        {tipo === 'Gasto' && medio === 'Credito' && (
          <Text style={[texto.nota, { marginBottom: espacio.l, backgroundColor: colores.ambarClaro, padding: espacio.s }]}>
            Si registras cada compra con tarjeta, no registres también el pago de la tarjeta como gasto. Los intereses y
            comisiones sí son gastos.
          </Text>
        )}

        {error && <MensajeError>{error}</MensajeError>}
        <Boton titulo={id ? 'Guardar cambios' : 'Registrar'} onPress={guardar} deshabilitado={guardando} estilo={{ marginTop: espacio.m }} />
        {id && <Boton titulo="Borrar movimiento" variante="peligro" onPress={confirmarBorrado} estilo={{ marginTop: espacio.m }} />}

        <Text style={[texto.nota, { marginTop: espacio.xl }]}>
          Las compras y ventas de acciones se registran en la pestaña Acciones. Las transferencias entre tus cuentas no son
          gastos ni ingresos.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
