import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { alertaPresupuesto } from './datos';

const CANAL = 'presupuesto';
const disponibles = Platform.OS !== 'web';

// La alerta sale como notificación del sistema aunque la app esté abierta, sin sonido.
// La app no dibuja avisos propios: la pantalla queda para ver las cifras.
if (disponibles) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function permitidas() {
  // Android 13+ pide que el canal exista antes de solicitar el permiso.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Alertas de presupuesto',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted || !actual.canAskAgain) return actual.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Notifica si el gasto recién registrado cruzó el 80% o el 100% de un presupuesto del mes.
 * El permiso se pide la primera vez que hay algo que avisar. Nunca lanza: una alerta
 * que no sale no debe impedir registrar el gasto.
 */
export async function avisarPresupuesto(movimientoId: string) {
  if (!disponibles) return;
  try {
    const texto = await alertaPresupuesto(movimientoId);
    if (!texto || !(await permitidas())) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Presupuesto', body: texto },
      trigger: Platform.OS === 'android' ? { channelId: CANAL } : null,
    });
  } catch {
    // Sin conexión o sin permiso: el gasto ya quedó guardado.
  }
}
