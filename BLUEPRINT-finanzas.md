# Happy Buy — Finanzas (Fase 3) · Master Blueprint

> **Versión:** 1.0 · **Fecha:** 2026-08-18 · **Estado:** APROBADO
> **Documentos fuente:** [TECH-SPEC-finanzas.md](TECH-SPEC-finanzas.md) ·
> [docs/ui-design/screen-flows/finanzas.md](docs/ui-design/screen-flows/finanzas.md)
> **Pipeline recortado:** sin PDR / User Stories / UX Research — acordado con Jen.

---

## Visión

El dashboard responde *"¿cuánto gané esta semana?"*. No responde **"¿dónde está mi plata?"**.

Esta fase agrega una tab `/finanzas` admin-only que muestra cuánto le deben, cuándo entra,
cuánto debe y si el mes dio o no dio. En el camino corrige un error real: las retenciones se
estaban estimando en 1,5% cuando son dos cargos que suman 1,914%.

**Usuarios:** Jen y Enrique (rol `admin`). Gina y Daniel (`bodega`) no ven nada de esto.

---

## Contexto técnico

Stack sin cambios — Next.js 16, React 19, TypeScript, Tailwind 3.4, Supabase.
**Cero dependencias nuevas.**

### El hallazgo que habilita todo

`api.mercadopago.com` responde con **el mismo token de ML que ya está en `ml_tokens`**. Los
mismos paths contra `api.mercadolibre.com` dan 403, que es lo que hacía parecer que faltaban
permisos. **No hay que autorizar nada.**

| Campo de `/v1/payments/search` | Qué da |
|---|---|
| `money_release_date` | Fecha exacta del depósito. **No es fija**: 21 días hoy, 3-13 en 2025 |
| `money_release_status` | `pending` → `released` |
| `transaction_details.net_received_amount` | La plata real que queda de la venta |
| `charges_details[]` | Desglose con `rate` y `base_amount` por cargo |

Verificado en 4 pedidos: `transaction_amount − Σ charges(from: collector) =
net_received_amount` cuadra al centavo. El endpoint de búsqueda ya trae `charges_details`,
así que **no hace falta pedir pago por pago**.

Cargos observados: `meli_fee`, `shp_cross_docking`, `tax_withholding-fuente` (1,5%),
`tax_withholding-ica_bogota` (0,414%).

**Bloqueado:** `/users/{id}/mercadopago_account/balance` → 403. El saldo total no es legible;
se reconstruye sumando liberados vs. pendientes.

---

## Resumen de fases

| # | Fase | Tamaño | Entregable demostrable |
|---|---|---|---|
| 1 | Traer los pagos de Mercado Pago | M | La venta del 18-ago muestra $48.488,16 liberándose el 8-sep |
| 2 | Corregir el motor de costos | M | La "Ganancia real" cuadra al peso con lo que ML deposita |
| 3 | La tab: caja y flujo | M | `/finanzas` responde "¿dónde está mi plata?" |
| 4 | Resultado por mes | S | Junio, julio y agosto comparables de un vistazo |
| 5 | Tarjetas y gastos | M | Registrar un gasto y ver el cupo disponible real |

Dependencias estrictamente lineales: `1 → 2 → 3 → 4 → 5`.
La Fase 5 no depende de Mercado Pago y podría adelantarse si hiciera falta.

---

## FASE 1 · Traer los pagos de Mercado Pago

> **Depende de:** nada · **Entregable:** `ml_payments` poblada y verificable contra la cuenta real

### 1.1 Base de datos

- [ ] **T-1.1.1** Crear migración `ml_payments` vía `mcp__supabase__apply_migration`

```sql
CREATE TABLE ml_payments (
  id                   BIGINT PRIMARY KEY,
  order_id             TEXT,
  operation_type       TEXT NOT NULL,
  description          TEXT,
  status               TEXT NOT NULL,
  date_approved        TIMESTAMPTZ,
  money_release_date   TIMESTAMPTZ,
  money_release_status TEXT,
  transaction_amount   NUMERIC(14,2) NOT NULL,
  net_received_amount  NUMERIC(14,2) NOT NULL,
  meli_fee             NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_charge      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_withholding      NUMERIC(14,2) NOT NULL DEFAULT 0,
  charges              JSONB,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ml_payments_release  ON ml_payments(money_release_date)
  WHERE money_release_status = 'pending';
CREATE INDEX idx_ml_payments_approved ON ml_payments(date_approved);
CREATE INDEX idx_ml_payments_order    ON ml_payments(order_id) WHERE order_id IS NOT NULL;

ALTER TABLE ml_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solo admin lee pagos" ON ml_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE ml_payments IS
  'Espejo local de /v1/payments de Mercado Pago. charges guarda el desglose crudo para no perder cargos nuevos.';
```

- [ ] **T-1.1.2** Agregar `MlPayment` a `src/types/database.ts` y registrarlo en `Database`
- [ ] **T-1.1.3** Correr `mcp__supabase__get_advisors` y confirmar que no aparece ningún hallazgo

### 1.2 Cliente y sincronización

- [ ] **T-1.2.1** Agregar `mpGet<T>()` a `src/features/dashboard/services/ml-client.ts`
  - Reusa `getAccessToken()`. **No duplicar la lógica del token** — rota cada 4h vía n8n
  - Base `https://api.mercadopago.com`
- [ ] **T-1.2.2** Crear `src/features/finanzas/services/parse-payment.ts`
  - Mapea la respuesta cruda → fila de `ml_payments`
  - `meli_fee`, `shipping_charge` y `tax_withholding` salen de `charges_details` filtrando
    `accounts.from === 'collector'`; `tax_withholding` **suma fuente + ICA**
  - Si aparece un `name` de cargo desconocido: registrarlo en consola y **sumarlo igual** al
    total, nunca descartarlo silenciosamente
- [ ] **T-1.2.3** Crear `src/features/finanzas/services/sync-ml-payments.ts`
  - Trae pagos nuevos: pagina `date_created desc` hasta topar con un `id` ya conocido
  - Refresca los `pending` cuya `money_release_date` ya pasó (cambian a `released` solos)
  - `upsert` por `id` — idempotente, mismo patrón que `syncAutoDelivered`
- [ ] **T-1.2.4** Crear `scripts/import-ml-payments.mjs` para la carga inicial
  - Recorre los 1.441 pagos paginando y hace upsert por lotes
  - Se corre **una vez, a mano**. Nunca desde la app

### Checklist de aceptación — Fase 1

- [ ] `select count(*) from ml_payments` devuelve ~1.441
- [ ] El pago `173539042157` tiene `net_received_amount = 48488.16` y
      `money_release_date = 2026-09-08`
- [ ] En todas las filas: `transaction_amount − (meli_fee + shipping_charge + tax_withholding)
      = net_received_amount`
- [ ] Correr el sync dos veces seguidas no duplica filas ni cambia totales
- [ ] Un usuario `bodega` recibe 0 filas al consultar `ml_payments`
- [ ] **Jen verifica contra su cuenta de ML** que ese depósito coincide

### Notas técnicas — Fase 1

- **`NUMERIC`, jamás `float`.** Los netos traen centavos (48488.16).
- Las bonificaciones Flex entran como `operation_type: money_transfer`,
  `description: 'bonificaciones_flex_fc'`, **sin `order_id`** (solo `external_reference:
  cashback_XXX`). Se suman por periodo; **no se pueden atribuir a una venta puntual**.
- `charges` se guarda crudo a propósito: es el seguro contra el próximo "ICA sorpresa".

---

## FASE 2 · Corregir el motor de costos

> **Depende de:** Fase 1 · **Entregable:** la ganancia del dashboard cuadra al peso
> **⚠️ La fase más riesgosa: toca código que hoy funciona en producción.**

### 2.1 Nuevo cálculo

- [ ] **T-2.1.1** Crear `src/features/finanzas/services/get-real-net.ts`
  - Dado un rango de fechas, devuelve por pedido: neto real, comisión, envío y retenciones
  - Suma aparte las bonificaciones Flex del periodo (`description = 'bonificaciones_flex_fc'`)
- [ ] **T-2.1.2** Reescribir `getFinancialSummary` para usar el neto real

```
neto_real_ML (ya trae comisión, envío y AMBAS retenciones)
  + bonificaciones Flex del periodo
  − costo de producto      (purchases, promedio ponderado real)
  − pago a bodega          (por logistic_type real)
  − courier Flex           (por logistic_type real)
  − ads                    (ads_daily_snapshots)
  − gastos operativos      (expenses — llega en Fase 5, hasta entonces 0)
= UTILIDAD REAL
```

- [ ] **T-2.1.3** Implementar el fallback: si un pedido no tiene pago sincronizado aún, usar el
      cálculo actual y **marcarlo como provisional en la UI**. Nunca mezclar en silencio
- [ ] **T-2.1.4** Marcar `TAX_WITHHOLDING_RATE` como `@deprecated` en `constants.ts`, dejando
      el comentario que explica por qué (dos retenciones, no una) y que solo sirve de fallback

### 2.2 Aviso del cambio

- [ ] **T-2.2.1** Crear `src/features/finanzas/components/CostModelChangeBanner.tsx`
  - Dismissible, persistido en `localStorage` (no amerita columna en la BD)
  - Se monta en `/dashboard` **y** en `/finanzas`

> **Los números cambiaron y están bien.** Ahora leemos directo de Mercado Libre lo que te
> descuentan en cada venta, en vez de estimarlo. Resulta que **4 de cada 10 ventas no pagan
> retención**, y les estábamos cobrando 1,5% igual. La ganancia sube porque **antes estaba
> subestimada**, no porque el negocio mejorara de golpe.

**Medido sobre los datos reales 2026-08-18** (1.209 ventas del año): retención real $1.063.362
vs. $1.464.097 que estimaba el modelo viejo → **+$400.735 a favor**. Últimos meses: may
+$33.684 · jun +$16.456 · jul +$6.390 · ago +$28.604.

> ⚠️ Una versión anterior de este Blueprint decía lo contrario ("la ganancia va a bajar"),
> deducido de que faltaba contar el ICA. Era falso: se miró un pedido, no la distribución.
> Ver Auto-Blindaje en `.claude/PRPs/PIEZA-finanzas.md`.

### Checklist de aceptación — Fase 2

- [ ] La ganancia de la semana cuadra con la suma de netos reales menos costos propios
- [ ] Un pedido de hace 5 minutos, sin pago sincronizado, se muestra como provisional
- [ ] El banner aparece una vez y no vuelve tras cerrarlo
- [ ] `npm run build` pasa sin errores de tipos
- [ ] Las cifras de la semana pasada **bajan** respecto a lo que mostraba antes — esperado

### Notas técnicas — Fase 2

- `computeOrderLineMetrics` **sigue existiendo**: la usan el margen por producto y el
  historial de 90 días, que trabajan por línea, no por pago. No borrarla.
- El historial de 90 días sigue estimando envío a propósito (pedir por envío 90 días son
  demasiadas llamadas). La tarjeta semanal es la exacta y el código lo dice.
- **Verificar contra la pantalla real de ML**, no contra consistencia interna. Ya falló dos
  veces en este proyecto.

---

## FASE 3 · La tab: caja y flujo

> **Depende de:** Fase 2 · **Entregable:** `/finanzas` responde "¿dónde está mi plata?"

### 3.1 Ruta y acceso

- [ ] **T-3.1.1** Crear `src/app/(main)/finanzas/page.tsx`, con guard de rol `admin`
      (mismo patrón que `/compras`)
- [ ] **T-3.1.2** Poner `enabled: true` en la entrada Finanzas de
      `src/shared/components/AppNav.tsx` (ya tiene `roles: ['admin']`)

### 3.2 Resumen de caja

- [ ] **T-3.2.1** Crear `services/get-cash-summary.ts` — retenido, entra esta semana, debes
- [ ] **T-3.2.2** Crear `components/CashSummaryCard.tsx`

```
┌──────────────────────────────────────────────────────────┐
│  Tu plata hoy                                            │
│                                                          │
│   RETENIDO EN ML          ENTRA ESTA SEMANA    DEBES     │
│   $2.847.320              $684.150             $441.000  │
│   36px greenDark          24px gray-900        24px      │
│   de 43 ventas            5 depósitos          Falabella │
└──────────────────────────────────────────────────────────┘
```

> Cifras ilustrativas salvo los $441.000 de Falabella, que son reales.

  - "Retenido" y "Entra" en verde (plata que llega). **"Debes" en gris, no rojo** — deber en
    una tarjeta es operación normal
  - Sin pagos sincronizados: mostrar estado de sincronización, **nunca `$0`**

### 3.3 Cuándo entra la plata

- [ ] **T-3.3.1** Crear `services/get-cash-flow.ts` — pendientes agrupados por semana y por día
- [ ] **T-3.3.2** Crear `components/CashFlowSection.tsx` reusando `MiniBarChart`
  - El subtítulo del plazo (~21 días) se **calcula** con la mediana real de
    `money_release_date − date_approved`. **Nunca escribirlo a mano** — ya cambió una vez
  - Lista de próximos depósitos, máx. 10 filas con "ver todos"

### Checklist de aceptación — Fase 3

- [ ] **Toda venta listada muestra el número que Jen ve en ML** (el `pack_id` de la orden, no
      el `order.id`). Verificado 2026-08-18: su pantalla decía "Venta #2000014594295497" cuando
      el pedido es `2000018000338192`; el pack_id además da 404 como orden. Si viene null,
      caer al `order.id`
- [ ] Un usuario `bodega` que entra a `/finanzas` es redirigido y no ve la tab en la nav
- [ ] El hero muestra las tres cifras con sus etiquetas
- [ ] Con la tabla vacía se ve el estado de sincronización, no `$0`
- [ ] Cambiar los datos cambia el texto del plazo (no es una constante)
- [ ] Sin pendientes: "No hay pagos pendientes de liberar", tratado como estado normal
- [ ] Sin scroll horizontal a 375px

---

## FASE 4 · Resultado por mes (P&L)

> **Depende de:** Fase 3 · **Entregable:** meses comparables de un vistazo

### 4.1 Cálculo

- [ ] **T-4.1.1** Crear `services/get-pnl.ts`
  - Agrupa por **`date_approved`** (cuándo se vendió), no por fecha de liberación
  - Últimos 3 meses completos + mes en curso
  - Filas: ventas · comisión · envíos · retenciones · producto · bodegas · courier ·
    empaques · publicidad · utilidad · margen

### 4.2 Tabla

- [ ] **T-4.2.1** Crear `components/PnlTable.tsx` — meses en columnas
  - Costos rutinarios en `gray-700` con prefijo `−`. **Ninguno en rojo**
  - Agrupación por quién recibe la plata: Mercado Libre · Tu operación · Publicidad
  - Jerarquía 14px ítems → 16px subtotales → 20px utilidad
  - Utilidad en rojo **solo** si es negativa
  - Mes en curso marcado con `*` y nota al pie de mes incompleto
  - Coma decimal, es-CO (`formatPercent` de `src/shared/utils/format.ts`)

### Checklist de aceptación — Fase 4

- [ ] El mes en curso aparece marcado como incompleto
- [ ] Ninguna fila de costo rutinario está en rojo
- [ ] La suma de las filas da exactamente la utilidad mostrada
- [ ] Todos los montos con coma decimal y miles es-CO
- [ ] La tabla scrollea dentro de su contenedor, la página no

### Notas técnicas — Fase 4

**Devengado ≠ caja, y la UI no puede confundirlos.** Una venta del 18 de agosto es utilidad de
agosto pero plata de septiembre. El P&L agrupa por `date_approved`; el flujo de caja (Fase 3)
por `money_release_date`. Son dos números correctos que no coinciden — el subtítulo lo explica.

---

## FASE 5 · Tarjetas y gastos

> **Depende de:** Fase 4 (solo por orden; técnicamente independiente de Mercado Pago)

### 5.1 Base de datos

- [ ] **T-5.1.1** Crear la tabla `expenses`

```sql
CREATE TABLE expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category          TEXT NOT NULL,
  description       TEXT,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  spent_on          DATE NOT NULL,
  payment_method_id UUID REFERENCES payment_methods(id),
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_spent_on ON expenses(spent_on DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solo admin gastos" ON expenses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

- [ ] **T-5.1.2** Extender `payment_methods`

```sql
ALTER TABLE payment_methods
  ADD COLUMN kind          TEXT CHECK (kind IN ('credito','debito','efectivo')),
  ADD COLUMN credit_limit  NUMERIC(14,2),
  ADD COLUMN statement_day SMALLINT CHECK (statement_day BETWEEN 1 AND 31),
  ADD COLUMN due_day       SMALLINT CHECK (due_day BETWEEN 1 AND 31);
```

- [ ] **T-5.1.3** Marcar los 4 métodos existentes: Davivienda / Falabella / Rappi = `credito`,
      Efectivo-Transferencia = `efectivo`. Cupo y fechas los registra Jen desde la UI
- [ ] **T-5.1.4** Actualizar `src/types/database.ts` y correr `get_advisors`

### 5.2 Tarjetas

- [ ] **T-5.2.1** Crear `services/get-debts.ts` — por método: compras sin pagar + gastos,
      cupo disponible, próximo corte
- [ ] **T-5.2.2** Crear `components/DebtCard.tsx`
  - Barra de cupo: verde <50% · ámbar 50-80% · **rojo >80%** (este sí es un estado malo)
  - Sin `credit_limit`: ocultar la barra y ofrecer "Registrar cupo y fechas".
    **No inventar un cupo ni mostrar una barra vacía sin explicación**
- [ ] **T-5.2.3** Form inline para cupo, día de corte y día de pago

### 5.3 Gastos

- [ ] **T-5.3.1** Crear `services/expense-actions.ts` (`'use server'`) con validación Zod
- [ ] **T-5.3.2** Crear `components/ExpenseForm.tsx` — panel inline, no modal
  - Categoría: dropdown con "Otro" editable, igual que la plataforma en compras
  - **El panel de éxito NO se cierra solo** (ver notas)
- [ ] **T-5.3.3** Crear `components/ExpensesList.tsx` con total del mes
  - Vacío: "Aún no has registrado gastos. Los empaques, cajas y cintas van aquí — no aparecen
    en ningún otro lado del sistema"
- [ ] **T-5.3.4** Conectar los gastos al P&L de la Fase 4 (fila "Empaques")

### Checklist de aceptación — Fase 5

- [ ] Tras guardar un gasto, el mensaje de éxito **permanece hasta cierre manual**
- [ ] Una tarjeta sin cupo registrado no muestra barra
- [ ] Una tarjeta sobre 80% del cupo muestra la barra en rojo
- [ ] Falabella muestra los $441.000 reales pendientes
- [ ] Un gasto registrado aparece en la fila "Empaques" del P&L del mes correspondiente
- [ ] `get_advisors` sin hallazgos nuevos

### Notas técnicas — Fase 5

- **El panel de confirmación no se autocierra.** En Fase 2 un panel que se cerraba solo causó
  un doble registro real de 100 unidades de Cable Ugreen. La lección se aplica igual aquí.
- **`'use server'` solo exporta funciones async.** Exportar una constante tumba todos los
  exports con un 500 que parece caché de Turbopack y no lo es. Constantes en archivo aparte.

---

## Apéndice A · Mapeo alcance → fase

| Alcance aprobado | Fase |
|---|---|
| Flujo de caja | 1 + 3 |
| Corrección del motor de costos | 2 |
| P&L mensual | 4 |
| Deudas y tarjetas (cupo + corte) | 5 |
| Gastos de empaques e insumos | 5 |

Los cinco puntos del alcance están cubiertos. Ninguno queda sin fase ni duplicado.

## Apéndice B · Mapeo pantalla → fase

| Sección del screen-flow | Fase |
|---|---|
| 1 · Resumen de caja | 3 |
| 2 · Cuándo entra la plata | 3 |
| 3 · Resultado por mes | 4 |
| 4 · Tarjetas y deudas | 5 |
| 5 · Gastos | 5 |
| Banner de cambio de modelo | 2 |

## Apéndice C · Dependencias

```
Fase 1 ──→ Fase 2 ──→ Fase 3 ──→ Fase 4 ──→ Fase 5
(datos)   (motor)     (caja)      (P&L)    (tarjetas
                                            + gastos)
```

Estrictamente lineal. La Fase 5 no toca Mercado Pago y podría adelantarse o paralelizarse.

## Apéndice D · Archivos nuevos

```
src/features/finanzas/
  services/   parse-payment · sync-ml-payments · get-real-net · get-cash-summary
              get-cash-flow · get-pnl · get-debts · expense-actions
  components/ CashSummaryCard · CashFlowSection · PnlTable · DebtCard
              ExpenseForm · ExpensesList · CostModelChangeBanner
src/app/(main)/finanzas/page.tsx
scripts/import-ml-payments.mjs
```

**Modificados:** `ml-client.ts` (+`mpGet`) · `get-financial-summary.ts` (reescrito) ·
`constants.ts` (deprecar la tasa) · `AppNav.tsx` (activar tab) · `types/database.ts`

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La ganancia baja y parece que algo se rompió | Avisado y aceptado. El banner lo explica |
| ML agrega un cargo que ninguna columna lee | `charges` JSONB crudo + log del cargo desconocido |
| El plazo de liberación cambia otra vez | Nunca se codifica: siempre se lee el campo |
| Pedido sin pago sincronizado | Fallback al cálculo actual, marcado como provisional |
| Doble registro de gasto | El panel de éxito no se autocierra |
| Romper el dashboard en producción (Fase 2) | Es el riesgo aceptado a cambio de no construir Finanzas sobre números malos |

---

## Verificación externa obligatoria

Antes de dar por buena la Fase 1, **Jen confirma contra su cuenta de Mercado Libre** que la
venta del 18-ago de $56.000 deposita **$48.488,16 el 8 de septiembre**.

Este proyecto ya falló dos veces por validar contra consistencia interna en vez de contra la
pantalla real de ML. No se repite.

---

## Changelog

| Fecha | Versión | Cambios |
|---|---|---|
| 2026-08-18 | 1.0 | Blueprint inicial. Alcance, screen-flow y fases aprobados por Jen |
