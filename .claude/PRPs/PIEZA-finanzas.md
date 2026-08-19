# La Pieza: Finanzas (Fase 3 — Happy Buy)

> **Estado**: COMPLETADO en local (2026-08-18) — sin commitear ni desplegar
> **Blueprint origen**: `BLUEPRINT-finanzas.md`
> **Fecha**: 2026-08-18
> **Build Mode**: 🔧 Herramienta Interna

---

## Objetivo

Agregar una tab `/finanzas` admin-only que responda **"¿dónde está mi plata?"** — cuánto está
retenido en Mercado Libre y cuándo entra, el resultado del negocio por mes, cuánto se debe por
tarjeta y los gastos de empaques. En el camino, corregir el motor de costos para que lea el
neto real de cada venta en vez de estimar las retenciones.

## Por Qué

| Problema del usuario | Cómo lo resuelve |
|---|---|
| "No se ve dónde queda la plata" | Flujo de caja con la fecha exacta de cada depósito |
| No sabe si el mes dio o no dio | P&L mensual comparable entre meses |
| No sabe cuánto debe ni cuánto cupo le queda | Tarjetas con deuda, cupo y fecha de corte |
| Los empaques no aparecen en ningún lado | Registro de gastos operativos |
| **La ganancia mostrada está inflada** | Lee `charges_details` real en vez de estimar 1,5% |

**Impacto medible**: la ganancia semanal pasa de estimada a exacta al peso. Hoy subestima las
retenciones en 0,414 puntos (falta el ICA Bogotá) sobre cada pedido que las lleva.

## Qué

### Criterios de Éxito (Definition of Done)

- [ ] `ml_payments` poblada con los ~1.441 pagos históricos
- [ ] El pago `173539042157` queda con `net_received_amount = 48488.16` y
      `money_release_date = 2026-09-08`, **verificado por Jen contra su cuenta de ML**
- [ ] La ganancia del dashboard cuadra al peso con lo que ML deposita
- [ ] Un usuario `bodega` no ve la tab ni obtiene filas de `ml_payments` / `expenses`
- [ ] Las 5 secciones del screen-flow renderizan con sus estados vacíos y de error
- [ ] `npm run build` sin errores · `get_advisors` sin hallazgos nuevos

### Happy Path

Jen entra a `/finanzas` → ve cuánto tiene retenido, cuánto entra esta semana y cuánto debe →
baja y ve en qué fechas caen los próximos depósitos → compara junio/julio/agosto en el P&L →
revisa el cupo disponible de Falabella → registra $38.000 de cajas y cinta → el gasto aparece
en la fila "Empaques" del mes.

---

## Contexto

### Referencias de código

| Ruta | Para qué |
|---|---|
| `src/features/dashboard/services/ml-client.ts` | `getAccessToken()` a reusar — **no duplicar** |
| `src/features/logistica/services/sync-dispatched.ts` | Patrón de sync idempotente a imitar |
| `src/features/inventario/components/PurchaseForm.tsx` | Patrón de form inline + panel que no se autocierra |
| `src/features/dashboard/components/FinancialSummaryCard.tsx` | Convenciones visuales ya acordadas |
| `src/shared/utils/format.ts` | `formatPercent` es-CO, coma decimal |
| `src/shared/components/AppNav.tsx:20` | La tab ya existe con `enabled: false` |

### Arquitectura

```
src/features/finanzas/
├── components/   CashSummaryCard · CashFlowSection · PnlTable · DebtCard
│                 ExpenseForm · ExpensesList · CostModelChangeBanner
└── services/     parse-payment · sync-ml-payments · get-real-net · get-cash-summary
                  get-cash-flow · get-pnl · get-debts · expense-actions
src/app/(main)/finanzas/page.tsx
scripts/import-ml-payments.mjs
```

### Modelo de datos

SQL completo en `BLUEPRINT-finanzas.md` (T-1.1.1 y T-5.1.1). Resumen:
`ml_payments` (espejo de MP, PK = payment id) · `expenses` (gastos) ·
`payment_methods` + 4 columnas (`kind`, `credit_limit`, `statement_day`, `due_day`).

**RLS admin-only en las dos tablas nuevas.** Gina y Daniel no ven márgenes ni deudas.

---

## Blueprint (Fases de Construcción)

### Fase 1: Traer los pagos de Mercado Pago
**Objetivo**: `ml_payments` poblada y sincronizable
**Validación**: `count(*)` ≈ 1.441 · el pago `173539042157` cuadra · correr el sync dos veces
no duplica · `bodega` obtiene 0 filas
**Tiempo estimado**: ~1,5h

### Fase 2: Corregir el motor de costos
**Objetivo**: el dashboard lee el neto real; aparece el banner del cambio
**Validación**: la ganancia semanal cuadra con la suma de netos menos costos propios · las
cifras de la semana pasada **bajan** (esperado) · `npm run build` limpio
**Tiempo estimado**: ~1,5h

### Fase 3: La tab — caja y flujo
**Objetivo**: `/finanzas` activa con el hero y las barras de liberación
**Validación**: `bodega` es redirigido · sin datos muestra sincronización, no `$0` · el plazo
del subtítulo se calcula · sin scroll horizontal a 375px
**Tiempo estimado**: ~2h

### Fase 4: Resultado por mes
**Objetivo**: P&L con meses en columnas
**Validación**: mes en curso marcado incompleto · ninguna fila rutinaria en rojo · las filas
suman exactamente la utilidad
**Tiempo estimado**: ~1,5h

### Fase 5: Tarjetas y gastos
**Objetivo**: deudas con cupo y registro de gastos
**Validación**: el éxito permanece hasta cierre manual · tarjeta sin cupo no muestra barra ·
>80% en rojo · Falabella muestra los $441.000 reales
**Tiempo estimado**: ~2h

### Validación Final
- [ ] `npm run build` → exitoso
- [ ] Playwright confirma que las 5 secciones renderizan
- [ ] `get_advisors(type: "security")` sin hallazgos nuevos
- [ ] **Jen verifica el depósito del 8-sep contra su cuenta de ML**

---

## 🔒 Auto-Blindaje

### 2026-08-18: Mostré $587.071 de "plata retenida" que eran COMPRAS de Jen
- **Error**: `/v1/payments/search` devuelve lo que la cuenta **cobra** y lo que **paga**, sin
  distinguirlo. 57 de los 1.441 pagos son compras de Jen (crema dental, arena para gatos, tenis
  adidas, empaques, Meli+, facturas de ML). Cinco de ellas quedaron en la UI como "ventas
  retenidas por ML" por $587.071, con un aviso ámbar pidiéndole revisar Mercado Pago.
- **Lo peor**: la hipótesis correcta se levantó al principio, se probó con una muestra de 100
  pagos, dio "90 vendedora / 0 compradora / 10 otros" y **se descartó por los 90 en vez de
  investigar los 10**. Las señales estaban a la vista y se pasaron por alto: neto idéntico al
  bruto (imposible en una venta real: siempre cobran comisión), cargos dirigidos al `payer`,
  `payment_method` = visa/amex, y la orden respondiendo 404.
- **Quién lo encontró**: Jen, preguntando "¿de dónde sacaste este dato?". No una verificación
  propia.
- **Fix**: columna `collector_id` + `HAPPY_BUY_COLLECTOR_ID` (131725890) filtrando en
  `get-cash-summary`, `get-cash-flow` y `get-real-net`.
- **Aplicar en**: cuando una muestra deje casos sin explicar, **son los casos sin explicar lo
  que hay que mirar**, no la mayoría que confirma la hipótesis. Y un número que no se puede
  reconstruir hasta la fuente no se muestra en la UI.

### 2026-08-18: El bono Flex estaba a punto de contarse dos veces
- **Error potencial** (detectado antes de escribir el cálculo): el modelo viejo derivaba el
  bono Flex del envío (`base_cost − list_cost`), y los bonos también llegan como pagos sueltos
  (`bonificaciones_flex_fc`). Sumar ambas fuentes habría inflado la ganancia.
- **Verificación**: sobre 5 días reales, bono desde envíos = **$7.870**, bono desde pagos =
  **$7.870**. Es el mismo dinero, y empareja uno a uno (8 envíos con bono → 8 pagos; los 3
  envíos Flex sin bono no generan pago).
- **Fix**: la fuente es el pago. `getShipmentCost` se sigue usando, pero solo por
  `logisticType` — que es lo único que dice si le toca pagar a bodega y courier.
- **Aplicar en**: cada vez que un dato nuevo duplique uno existente, medir ambos sobre el
  mismo periodo ANTES de sumarlos.

### 2026-08-18: Generalizar desde 4 muestras y llamarlo "verificado"
- **Error**: verifiqué en 4 pagos que `transaction_amount − Σ charges(from: collector) =
  net_received_amount` y lo escribí en el Tech Spec como "cuadra al centavo". Con los 1.441
  pagos reales falla en **~21%**: ML *lista* cargos que no descuenta de ese pago (los cobra en
  la factura mensual). Y no hay regla por nombre — `shp_fulfillment` se descuenta en unos
  pagos y en otros no; excluirlo empeora el resultado (158 → 184 descuadres).
- **Fix**: `net_received_amount` de la API es la ÚNICA autoridad del total. El desglose por
  categoría es informativo: sirve para mostrar en qué se fue la plata, nunca para calcular
  cuánta quedó.
- **Aplicar en**: cualquier verificación de datos de este proyecto. Cuatro casos no son una
  ley. Es la tercera vez que muerde la misma lección — antes fue `shipment.status` vs
  `substatus`, y antes una auditoría que comparó la BD contra la API en vez de la pantalla.

### 2026-08-18: Predije que la ganancia bajaría. Sube.
- **Error**: al ver que el ICA Bogotá (0,414%) no se estaba contando, deduje que las
  retenciones reales superaban el 1,5% estimado y le avisé a Jen —dos veces, y en el texto del
  banner— que la ganancia iba a bajar. Falso. Sobre las 1.209 ventas reales: **478 (40%) no
  pagan retención alguna**, y el modelo viejo les cobraba 1,5% igual. Retención real del año
  $1.063.362 vs. $1.464.097 estimados → **la ganancia sube $400.735**.
- **Fix**: banner y documentos corregidos. La regla: antes de afirmar el efecto de un cambio
  de cálculo, **medirlo sobre los datos completos**, con un `select`. Toma un minuto.
- **Aplicar en**: cualquier cambio de fórmula en este proyecto. Un caso muestra que la fórmula
  vieja está mal; solo la distribución dice para qué lado y cuánto.

### 2026-08-18: El catálogo de cargos era más grande de lo visible
- **Error**: la muestra chica solo mostró 4 tipos de cargo. El año real tiene 9, incluyendo
  `tax_withholding-iva`, `-inscription_iva` y `-ica_antioquia_medellin`.
- **Fix**: clasificar por **prefijo** (`shp_`, `tax_withholding`), no por nombre exacto. Un ICA
  de otra ciudad entra solo, sin tocar código.
- **Aplicar en**: todo mapeo de catálogos externos donde el proveedor puede agregar variantes.

---

## Gotchas (Antes de Implementar)

- [ ] **`api.mercadopago.com`, no `api.mercadolibre.com`.** Mismo token, dominio distinto. Los
      mismos paths contra ML dan 403 y parece falta de permisos. No lo es.
- [ ] **`NUMERIC`, jamás `float`.** Los netos traen centavos: `48488.16`.
- [ ] **`/v1/payments/search` ya trae `charges_details`.** No pedir pago por pago.
- [ ] **Las retenciones son DOS**: fuente (1,5%) + ICA Bogotá (0,414%). Y **no todos los
      pedidos las llevan** — por eso no sirve subir la constante a 1,914%, hay que leer los cargos.
- [ ] **Bonificaciones Flex sin `order_id`**: `operation_type: money_transfer`,
      `description: 'bonificaciones_flex_fc'`. Se suman por periodo, no se atribuyen a una venta.
- [ ] **`'use server'` solo exporta funciones async.** Una constante exportada tumba todos los
      exports con un 500 que parece caché de Turbopack.
- [ ] **El panel de confirmación no se autocierra.** Causó un doble registro real en Fase 2.
- [ ] **Vistas con `security_invoker`**, nunca definer — ya se saltó el RLS una vez.
- [ ] **La BD es la REAL y compartida.** Nada destructivo sin confirmar.
- [ ] **Verificar contra la pantalla de ML**, no contra consistencia interna. Ya falló 2 veces.

## Anti-Patrones Forge

- ❌ NO duplicar la lógica del token — reusar `getAccessToken()`
- ❌ NO usar `any` — `unknown` y validar
- ❌ NO hardcodear el plazo de liberación (ya cambió: 3-13 días → 21)
- ❌ NO descartar en silencio un cargo desconocido de ML — sumarlo y loguearlo
- ❌ NO borrar `computeOrderLineMetrics`: la usan margen por producto e historial de 90 días
- ❌ NO escribir código fuera de `src/features/` — Feature-First

---

*La Pieza pendiente aprobación. Ninguna línea de código ha sido modificada.*
