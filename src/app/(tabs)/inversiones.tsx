import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { calcularCartera } from '@/domain/finanzas';
import { monedaPorTicker, valuarPosiciones } from '@/domain/valuacion';
import { preciosDisponibles, preciosEnPesos } from '@/lib/precios';
import { cargarOperaciones } from '@/lib/datos';
import { aNumero, aPesos, fechaLegible } from '@/lib/formato';
import { useCarga } from '@/lib/useCarga';
import { colores, espacio, texto } from '@/lib/tema';
import { BotonFlotante, Cifra, MensajeError, Pantalla, Renglon, Seccion, Vacio } from '@/components/ui';

export default function Inversiones() {
  const router = useRouter();
  const { datos, error } = useCarga(async () => {
    const operaciones = await cargarOperaciones();
    return { ...calcularCartera(operaciones), monedas: monedaPorTicker(operaciones) };
  }, []);

  // Precios de mercado aparte: la pantalla no espera a Yahoo Finance.
  const [precios, setPrecios] = useState<{ mapa: Map<string, number | null>; hora: Date | null } | null>(null);
  const [consultando, setConsultando] = useState(false);
  const clave = datos?.posiciones.filter((p) => p.titulos > 0).map((p) => p.ticker).join(',') ?? '';
  useEffect(() => {
    if (!datos || !clave || !preciosDisponibles) return;
    let vigente = true;
    setConsultando(true);
    preciosEnPesos(clave.split(',').map((ticker) => ({ ticker, moneda: datos.monedas.get(ticker) ?? 'MXN' })))
      .then((r) => vigente && setPrecios({ mapa: r.precios, hora: r.hora }))
      .finally(() => vigente && setConsultando(false));
    return () => {
      vigente = false;
    };
  }, [clave, datos]);

  const mercado = datos ? valuarPosiciones(datos.posiciones, precios?.mapa ?? new Map()) : null;
  const abiertas = mercado?.posiciones.filter((p) => p.titulos > 0) ?? [];
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
          {mercado && mercado.valor > 0 && (
            <View style={[estilos.totales, { paddingTop: 0 }]}>
              <Cifra etiqueta="Valor de mercado" valor={mercado.valor} />
              <Cifra
                etiqueta="Ganancia no realizada"
                valor={mercado.gananciaNoRealizada}
                color={mercado.gananciaNoRealizada < 0 ? colores.rojo : colores.verde}
              />
            </View>
          )}
          <Text style={texto.nota}>
            Costo en pesos por costo promedio; ganancias antes de impuestos.{' '}
            {!preciosDisponibles
              ? 'Los precios de mercado solo se consultan en la app del teléfono.'
              : consultando
                ? 'Consultando precios…'
                : precios?.hora
                  ? `Precios de Yahoo Finance al ${precios.hora.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} (pueden tener retraso).`
                  : ''}
          </Text>
          {!!precios && !!mercado?.sinPrecio.length && (
            <Text style={[texto.nota, { marginTop: espacio.s }]}>Sin precio para {mercado.sinPrecio.join(', ')}: no se incluyen en el valor de mercado.</Text>
          )}

          {conProblemas > 0 && (
            <MensajeError>
              {conProblemas === 1 ? 'Una venta supera' : `${conProblemas} ventas superan`} los títulos que tenías en esa fecha y
              no se incluye en los cálculos. Revisa el historial.
            </MensajeError>
          )}

          <Seccion titulo="En cartera">
            {abiertas.length === 0 && <Vacio>No tienes posiciones abiertas. Registra tu primera compra.</Vacio>}
            {abiertas.map((p) => {
              const g = p.gananciaNoRealizada;
              const avisos = [
                p.precio !== null && g !== null
                  ? `Hoy ${aPesos(p.precio)} · ${g >= 0 ? '+' : ''}${aPesos(g)}${p.rendimiento !== null ? ` (${(p.rendimiento * 100).toFixed(1)} %)` : ''}`
                  : null,
                p.gananciaRealizada !== 0 ? `Ganancia realizada: ${aPesos(p.gananciaRealizada)}` : null,
              ].filter(Boolean);
              return (
                <Renglon
                  key={p.ticker}
                  izquierda={p.ticker}
                  detalle={`${aNumero(p.titulos)} títulos a ${aPesos(p.costoMedio)} promedio · costo ${aPesos(p.costo)}`}
                  derecha={aPesos(p.valor ?? p.costo)}
                  derechaColor={g === null ? undefined : g < 0 ? colores.rojo : colores.verde}
                  aviso={avisos.length ? avisos.join('\n') : undefined}
                />
              );
            })}
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
