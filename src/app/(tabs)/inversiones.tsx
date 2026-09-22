import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { calcularCartera } from '@/domain/finanzas';
import { cargarOperaciones } from '@/lib/datos';
import { aNumero, aPesos, fechaLegible } from '@/lib/formato';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { BotonFlotante, Cifra, MensajeError, Pantalla, Renglon, Seccion, Vacio } from '@/components/ui';

export default function Inversiones() {
  const router = useRouter();
  const { datos, error } = useCarga(async () => calcularCartera(await cargarOperaciones()), []);

  const abiertas = datos?.posiciones.filter((p) => p.titulos > 0) ?? [];
  const cerradas = datos?.posiciones.filter((p) => p.titulos === 0) ?? [];
  const historial = [...(datos?.operaciones ?? [])].reverse();
  const conProblemas = historial.filter((o) => o.estado !== 'OK').length;

  return (
    <Pantalla
      titulo="Acciones"
      conMes={false}
      pie={<BotonFlotante titulo="+ Operación" onPress={() => router.push('/operacion')} />}
    >
      {error && <MensajeError>{error}</MensajeError>}

      {datos && (
        <>
          <View style={estilos.totales}>
            <Cifra etiqueta="Costo de la cartera" valor={datos.costoTotal} />
            <Cifra
              etiqueta="Ganancia realizada"
              valor={datos.gananciaTotal}
              color={datos.gananciaTotal < 0 ? colores.rojo : colores.verde}
            />
          </View>
          <Text style={texto.nota}>
            Costo histórico en pesos, no valor de mercado. Ganancia antes de impuestos, por costo promedio.
          </Text>

          {conProblemas > 0 && (
            <MensajeError>
              {conProblemas === 1 ? 'Una venta supera' : `${conProblemas} ventas superan`} los títulos que tenías en esa fecha y
              no se incluye en los cálculos. Revisa el historial.
            </MensajeError>
          )}

          <Seccion titulo="En cartera">
            {abiertas.length === 0 && <Vacio>No tienes posiciones abiertas. Registra tu primera compra.</Vacio>}
            {abiertas.map((p) => (
              <Renglon
                key={p.ticker}
                izquierda={p.ticker}
                detalle={`${aNumero(p.titulos)} títulos a ${aPesos(p.costoMedio)} promedio`}
                derecha={aPesos(p.costo)}
                aviso={p.gananciaRealizada !== 0 ? `Ganancia realizada: ${aPesos(p.gananciaRealizada)}` : undefined}
              />
            ))}
          </Seccion>

          {cerradas.length > 0 && (
            <Seccion titulo="Posiciones cerradas">
              {cerradas.map((p) => (
                <Renglon
                  key={p.ticker}
                  izquierda={p.ticker}
                  detalle="Vendiste todos los títulos"
                  derecha={aPesos(p.gananciaRealizada)}
                  derechaColor={p.gananciaRealizada < 0 ? colores.rojo : colores.verde}
                />
              ))}
            </Seccion>
          )}

          <Seccion titulo="Historial">
            {historial.length === 0 && <Vacio>Sin operaciones todavía.</Vacio>}
            {historial.map((o) => {
              const precio = `${aNumero(o.cantidad)} × ${o.moneda === 'USD' ? 'US$' : '$'}${aNumero(o.precio)}`;
              const tc = o.moneda === 'USD' ? ` a ${aNumero(o.tipo_cambio ?? 0)} MXN/USD` : '';
              return (
                <Renglon
                  key={o.id}
                  izquierda={`${o.tipo} ${o.ticker}`}
                  detalle={`${fechaLegible(o.fecha, true)}, ${precio}${tc}`}
                  derecha={o.estado === 'OK' ? aPesos(o.flujo) : undefined}
                  derechaColor={o.flujo < 0 ? colores.tinta : colores.verde}
                  aviso={
                    o.estado !== 'OK'
                      ? 'Vende más títulos de los que tenías. Corrige la cantidad o registra la compra original.'
                      : o.tipo === 'Venta'
                        ? `Ganancia: ${aPesos(o.ganancia)}`
                        : undefined
                  }
                  onPress={() => router.push({ pathname: '/operacion', params: { id: o.id } })}
                />
              );
            })}
          </Seccion>
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  totales: { flexDirection: 'row', gap: espacio.l, paddingVertical: espacio.l },
});
