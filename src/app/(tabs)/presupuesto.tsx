import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { resumenMes } from '@/domain/finanzas';
import { cargarCategorias, cargarMovimientosDelAnio, cargarPresupuestos, guardarPresupuestos } from '@/lib/datos';
import { aPesos, leerNumero, MESES } from '@/lib/formato';
import { usePeriodo } from '@/lib/periodo';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { Boton, MensajeError, Pantalla, Seccion } from '@/components/ui';

export default function PresupuestoPantalla() {
  const { anio, mes } = usePeriodo();
  const mesAnterior = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };

  const { datos, error, recargar } = useCarga(async () => {
    const [categorias, movimientos, presupuestos, anteriores] = await Promise.all([
      cargarCategorias(),
      cargarMovimientosDelAnio(anio),
      cargarPresupuestos(anio, mes),
      cargarPresupuestos(mesAnterior.anio, mesAnterior.mes),
    ]);
    return {
      resumen: resumenMes({ anio, mes, movimientos, categorias, presupuestos, operaciones: [] }),
      anteriores,
    };
  }, [anio, mes]);

  // Texto de cada campo; clave '' = presupuesto total del mes
  const [valores, setValores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!datos) return;
    const r = datos.resumen;
    const inicial: Record<string, string> = { '': r.presupuesto ? String(r.presupuesto) : '' };
    for (const l of r.porCategoria) inicial[l.categoria.id] = l.presupuesto ? String(l.presupuesto) : '';
    setValores(inicial);
    setMensaje(null);
    setErrorGuardar(null);
  }, [datos]);

  const r = datos?.resumen;
  const sumaCategorias = Object.entries(valores)
    .filter(([k]) => k !== '')
    .reduce((s, [, v]) => s + (leerNumero(v) ?? 0), 0);
  const total = leerNumero(valores[''] ?? '') ?? 0;

  function copiarAnterior() {
    const nuevo: Record<string, string> = Object.fromEntries(Object.keys(valores).map((k) => [k, '']));
    for (const p of datos!.anteriores) nuevo[p.categoria_id ?? ''] = String(p.monto);
    setValores(nuevo);
    setMensaje(`Copiado de ${MESES[mesAnterior.mes - 1]}. Revisa y guarda.`);
  }

  async function guardar() {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await guardarPresupuestos(anio, mes, Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, leerNumero(v)])));
      setMensaje('Presupuesto guardado.');
      recargar();
    } catch (e) {
      setErrorGuardar((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Pantalla titulo="Presupuesto">
      {error && <MensajeError>{error}</MensajeError>}
      {r && (
        <>
          <View style={estilos.total}>
            <Text style={texto.nota}>Presupuesto total del mes</Text>
            <TextInput
              value={valores[''] ?? ''}
              onChangeText={(v) => setValores({ ...valores, '': v })}
              keyboardType="decimal-pad"
              placeholder="Sin presupuesto"
              placeholderTextColor={colores.tintaSuave}
              style={[texto.cifraGrande, { color: colores.tinta, paddingVertical: 4 }]}
              accessibilityLabel="Presupuesto total del mes"
            />
            <Text style={texto.nota}>
              Ingresos del mes: {aPesos(r.ingresos)}. Gastado: {aPesos(r.gastos)}.
            </Text>
            {total > 0 && r.ingresos > 0 && total > r.ingresos && (
              <Text style={[texto.nota, { color: colores.rojo, marginTop: 4 }]}>
                El presupuesto es mayor que tus ingresos registrados por {aPesos(total - r.ingresos)}.
              </Text>
            )}
          </View>

          <Seccion
            titulo="Por categoría"
            accion={<Text style={[texto.nota, { fontVariant: ['tabular-nums'] }]}>Suma {aPesos(sumaCategorias)}</Text>}
          >
            {total > 0 && sumaCategorias > total && (
              <Text style={[texto.nota, { color: colores.rojo, paddingTop: espacio.s }]}>
                Las categorías suman más que el total por {aPesos(sumaCategorias - total)}.
              </Text>
            )}
            {r.porCategoria.map((l) => (
              <View key={l.categoria.id} style={estilos.fila}>
                <View style={{ flex: 1 }}>
                  <Text style={texto.cuerpo}>{l.categoria.nombre}</Text>
                  <Text style={texto.nota}>Gastado {aPesos(l.gastado)}</Text>
                </View>
                <TextInput
                  value={valores[l.categoria.id] ?? ''}
                  onChangeText={(v) => setValores({ ...valores, [l.categoria.id]: v })}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colores.tintaSuave}
                  style={estilos.campo}
                  accessibilityLabel={`Presupuesto de ${l.categoria.nombre}`}
                />
              </View>
            ))}
          </Seccion>

          {mensaje && <Text style={[texto.nota, { marginTop: espacio.l }]}>{mensaje}</Text>}
          {errorGuardar && <MensajeError>{errorGuardar}</MensajeError>}
          <Boton titulo="Guardar presupuesto" onPress={guardar} deshabilitado={guardando} estilo={{ marginTop: espacio.l }} />
          {datos!.anteriores.length > 0 && (
            <Boton
              titulo={`Copiar de ${MESES[mesAnterior.mes - 1]}`}
              variante="secundario"
              onPress={copiarAnterior}
              estilo={{ marginTop: espacio.m }}
            />
          )}
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  total: { paddingVertical: espacio.l },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingVertical: espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.linea,
  },
  campo: {
    width: 120,
    textAlign: 'right',
    backgroundColor: colores.ambarClaro, // amarillo = "aquí escribes", como en tu Excel
    borderRadius: 6,
    paddingHorizontal: espacio.m,
    paddingVertical: 10,
    fontSize: 16,
    color: colores.tinta,
    fontVariant: ['tabular-nums'],
  },
});
