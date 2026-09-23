# Mis finanzas

App móvil para iOS y Android basada en el Excel *Mis finanzas y acciones*. Sirve para registrar gastos e ingresos, llevar un presupuesto mensual total y por categoría, y seguir una cartera de acciones a costo promedio en pesos.

Stack: **Expo SDK 57** (React Native + Expo Router + TypeScript) y **Supabase** (Postgres, autenticación y seguridad por fila).

## Puesta en marcha

**1. Crea el backend.** Crea un proyecto en [supabase.com](https://supabase.com). Abre *SQL Editor* y ejecuta, **en orden**, cada archivo de `supabase/migrations/`. Si usas la CLI de Supabase, basta con `supabase link` y `supabase db push`. También puedes dejar que GitHub Actions las aplique (ver *CI/CD*).

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
| Estados de cuenta PDF | **Movimientos → Cargar estado de cuenta PDF**. Extrae cargos, sugiere categorías, marca duplicados y pide confirmación antes de guardar. |
| Hoja **Acciones** y cartera del Resumen | Pestaña **Acciones** y formulario `operacion.tsx`. Los tickers aparecen solos, ya no hay que escribirlos en el Resumen. |
| Celda "Presupuesto del mes" | Pestaña **Presupuesto**, ahora también por categoría |
| Estado "Revisar datos" | Reglas `check` en la base de datos: los datos inválidos no se pueden guardar |
| Estado "Venta excede saldo" | Trigger `validar_venta` en el servidor. Además, el formulario muestra una vista previa antes de guardar. |
| Orden obligatorio de filas | Se ordena por fecha y hora de captura. Puedes registrar en cualquier orden. |
| Límite de 1,000 / 300 filas | Sin límite |

## Además del Excel

| Función | Dónde |
| --- | --- |
| **Apple Pay con Atajos**: cada pago con el iPhone se registra solo | Usuario → Registro automático |
| **Gastos por revisar**: los pagos de comercios nuevos se categorizan en grupo y la app aprende | Aviso en Resumen |
| **Gastos e ingresos fijos** (renta, suscripciones, sueldo) que se registran solos cada mes | Usuario → Organización, y *Fijos por llegar* en Resumen |
| **Meses sin intereses**: una compra genera una mensualidad por mes | Movimientos → Meses sin intereses |
| **Categorías** editables: agregar, renombrar, ordenar, ocultar | Usuario → Organización, o Presupuesto |
| **Búsqueda** por comercio, categoría, cuenta o monto en todo el año | Movimientos |
| **Valor de mercado** y ganancia no realizada con precios de Yahoo Finance | Acciones |
| **Exportar a CSV** (Excel/Numbers) | Usuario → Respaldo |
| **Bloqueo con Face ID o huella** | Usuario → Seguridad |

Las reglas de cálculo son las mismas de la hoja Guía:

- Costo promedio ponderado en MXN.
- La comisión se suma al costo en las compras y se descuenta en las ventas.
- Los montos en USD se convierten con el tipo de cambio de cada operación.
- La ganancia se calcula antes de impuestos.

## Estructura

```
supabase/migrations/   Esquema, reglas, seguridad (RLS) y funciones (en orden por fecha)
supabase/tests/        Pruebas SQL de las migraciones (npm run test:sql)
scripts/               probar-sql.sh: aplica las migraciones en una base limpia y corre las pruebas
.github/workflows/     CI y despliegue
src/domain/            Cálculos puros: cartera, resumen, meses sin intereses, fijos, CSV, búsqueda…
src/lib/               Cliente Supabase, acceso a datos, sesión, periodo, formato, tema
src/components/ui.tsx  Componentes de interfaz
src/app/               Pantallas (Expo Router)
tests/                 Pruebas de los cálculos (npm test)
```

Toda la lógica de dinero vive en `src/domain/finanzas.ts`. No depende de React ni de Supabase. Las pruebas incluyen el ejemplo de la hoja Guía: la compra de 2 títulos a 100 USD cuesta 3,618 MXN, y la venta de 1 a 110 USD deja una ganancia de 171 MXN.

```bash
npm test          # pruebas de cálculo (TypeScript, sin dependencias)
npm run typecheck # TypeScript
npm run test:sql  # migraciones + pruebas SQL (necesita Postgres local o variables PG*)
```

Las funciones de `src/domain/` solo pueden importar *tipos* de otros módulos: `npm test` corre TypeScript directo con Node, que no resuelve imports sin extensión.

## CI/CD

- **CI** (`.github/workflows/ci.yml`), en cada push y pull request: typecheck, pruebas, empaquetado de iOS y Android con Metro, y todas las migraciones más las pruebas SQL sobre Postgres 17.
- **Despliegue** (`.github/workflows/despliegue.yml`): cuando el CI pasa en `main`, aplica las migraciones nuevas a Supabase con `supabase db push`. Configura en *Settings → Secrets and variables → Actions*:
  - `SUPABASE_ACCESS_TOKEN`: supabase.com → Account → Access Tokens
  - `SUPABASE_PROJECT_REF`: el `xxxx` de `https://xxxx.supabase.co`
  - `SUPABASE_DB_PASSWORD`: la contraseña de la base de datos

  Sin esos secretos el paso se omite. **Si ya aplicaste migraciones a mano en el SQL Editor**, márcalas una sola vez como aplicadas para que `db push` no intente repetirlas: `supabase migration repair --status applied 20260922000000 20260922010000 …` (con las versiones que ya corriste).

## Límites actuales

Tiene los mismos límites que el Excel:

- No maneja dividendos, splits ni ventas en corto.
- No calcula impuestos.

Los precios de mercado vienen de Yahoo Finance: son gratuitos, pueden tener retraso y solo se consultan en la app del teléfono (el navegador los bloquea). Si un ticker no aparece, la app lo indica y lo deja fuera del valor de mercado.

La importación admite PDFs digitales con texto (hasta 20 MB y 40 páginas). Los estados escaneados como imagen necesitan OCR y no se importan automáticamente. Como los bancos usan formatos distintos, la pantalla siempre muestra una revisión previa para corregir categorías o excluir filas antes de guardar.
