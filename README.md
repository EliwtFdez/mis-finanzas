# Mis finanzas

App móvil para iOS y Android basada en el Excel *Mis finanzas y acciones*. Sirve para registrar gastos e ingresos, llevar un presupuesto mensual total y por categoría, y seguir una cartera de acciones a costo promedio en pesos.

Stack: **Expo SDK 57** (React Native + Expo Router + TypeScript) y **Supabase** (Postgres, autenticación y seguridad por fila).

## Puesta en marcha

**1. Crea el backend.** Crea un proyecto en [supabase.com](https://supabase.com). Abre *SQL Editor*, pega el contenido de `supabase/migrations/20260922000000_esquema_inicial.sql` y ejecútalo. Si usas la CLI de Supabase, basta con `supabase link` y `supabase db push`.

Para probar rápido, puedes desactivar la confirmación por correo en *Authentication → Providers → Email → Confirm email*. Así entras en cuanto creas la cuenta.

**2. Configura las variables.**

```bash
cp .env.example .env
# Pon la URL del proyecto y la clave publicable (Project Settings → API)
```

**3. Ejecuta la app.**

```bash
npm install
npx expo start
```

Escanea el código QR con **Expo Go** en tu teléfono. Todas las librerías que usa la app vienen incluidas en Expo Go, así que no necesitas compilar nada para desarrollar.

**4. Publica en las tiendas.** Cuando quieras distribuirla, usa EAS: `npx eas-cli@latest build -p all` y después `eas submit`. Antes, cambia `bundleIdentifier` y `package` en `app.json` por los tuyos.

## Del Excel a la app

| Excel | App |
| --- | --- |
| Hoja **Resumen** (año, mes, presupuesto, totales, tabla anual) | Pestaña **Resumen**. El mes se cambia con las flechas y se comparte entre pestañas. |
| Hoja **Gastos** | Pestaña **Movimientos** y formulario `movimiento.tsx` |
| Hoja **Acciones** y cartera del Resumen | Pestaña **Acciones** y formulario `operacion.tsx`. Los tickers aparecen solos, ya no hay que escribirlos en el Resumen. |
| Celda "Presupuesto del mes" | Pestaña **Presupuesto**, ahora también por categoría |
| Estado "Revisar datos" | Reglas `check` en la base de datos: los datos inválidos no se pueden guardar |
| Estado "Venta excede saldo" | Trigger `validar_venta` en el servidor. Además, el formulario muestra una vista previa antes de guardar. |
| Orden obligatorio de filas | Se ordena por fecha y hora de captura. Puedes registrar en cualquier orden. |
| Límite de 1,000 / 300 filas | Sin límite |

Las reglas de cálculo son las mismas de la hoja Guía:

- Costo promedio ponderado en MXN.
- La comisión se suma al costo en las compras y se descuenta en las ventas.
- Los montos en USD se convierten con el tipo de cambio de cada operación.
- La ganancia se calcula antes de impuestos.

## Estructura

```
supabase/migrations/   Esquema, reglas, seguridad (RLS) y categorías iniciales
src/domain/            Cálculos puros: cartera, resumen del mes y del año
src/lib/               Cliente Supabase, acceso a datos, sesión, periodo, formato, tema
src/components/ui.tsx  Componentes de interfaz
src/app/               Pantallas (Expo Router)
tests/                 Pruebas de los cálculos (npm test)
```

Toda la lógica de dinero vive en `src/domain/finanzas.ts`. No depende de React ni de Supabase. Las pruebas incluyen el ejemplo de la hoja Guía: la compra de 2 títulos a 100 USD cuesta 3,618 MXN, y la venta de 1 a 110 USD deja una ganancia de 171 MXN.

```bash
npm test          # pruebas de cálculo
npm run typecheck # TypeScript
```

## Límites actuales

Tiene los mismos límites que el Excel:

- No maneja dividendos, splits ni ventas en corto.
- No consulta precios de mercado.
- No calcula impuestos.

Tampoco permite crear categorías nuevas desde la app todavía. Puedes agregarlas en la tabla `categorias` desde Supabase.
