# Happy Buy — Finanzas (Fase 3) · Technical Specifications

> **Tech Spec v1.0** · **Estado**: BORRADOR · **Fecha**: 2026-08-18
> Plan recortado (sin PDR/User Stories/UX Research) — acordado con Jen, siguiendo el
> precedente de Fase 2B. Continúa el sistema de operaciones de Fases 0/1/2.

---

## 1. Resumen

### Problema
El dashboard responde "¿cuánto gané esta semana?". No responde **"¿dónde está mi plata?"**:
cuánto le deben, cuánto debe, cuándo entra, y si al final del mes el negocio dio o no dio.

### Solución
Una tab `/finanzas` admin-only con cuatro vistas: **P&L mensual**, **flujo de caja**,
**deudas por tarjeta** y **gastos operativos**.

### Complejidad
**Media.** Cero tecnología nueva — mismo stack, misma arquitectura. La complejidad real está
en una integración recién descubierta (Mercado Pago) y en corregir el motor de costos sin
romper lo que ya funciona.

---

## 2. El hallazgo que define esta fase

`api.mercadopago.com` responde con el **mismo token de ML que ya tenemos**. Los mismos paths
contra `api.mercadolibre.com` dan 403, que es lo que hacía parecer que faltaban permisos.
Era el dominio, no el permiso. **No hay que autorizar nada nuevo.**

Verificado contra la cuenta real el 2026-08-18 (1.441 pagos de historial disponibles):

| Campo | Qué da |
|---|---|
| `money_release_date` | Fecha exacta en que ML deposita. **No es fija**: 21 días hoy, 3-13 días en 2025 |
| `money_release_status` | `pending` → `released` |
| `transaction_details.net_received_amount` | La plata real que queda de esa venta |
| `charges_details[]` | Desglose exacto con `rate` y `base_amount` por cargo |

**Validación hecha:** en 4 pedidos, `transaction_amount − Σ charges(from: collector) =
net_received_amount` cuadraba al centavo.

> **⚠️ CORREGIDO 2026-08-18 con los 1.441 pagos reales a la vista.** Esa igualdad **NO se
> cumple en general**: falla en ~21% de los pagos. ML *lista* cargos que no descuenta de ese
> pago (los cobra en la factura mensual), y no hay regla por nombre — `shp_fulfillment` se
> descuenta en unos y en otros no. **`net_received_amount` es la única autoridad del total**;
> el desglose por categoría es informativo. Ver Auto-Blindaje en `.claude/PRPs/PIEZA-finanzas.md`.

### Corrección que esto obliga

Cargos observados: `meli_fee`, `shp_cross_docking`, `tax_withholding-fuente` (1,5%) y
**`tax_withholding-ica_bogota` (0,414%)**.

El sistema venía estimando las retenciones en 1,5% ([constants.ts:47](src/features/dashboard/constants.ts#L47)).
Son **dos** retenciones: fuente + ICA = **1,914%**. La ganancia mostrada hoy está **inflada**.

No basta con subir la constante a 1,914%: **no todos los pedidos las llevan** (1 de 4 revisados
no tenía ninguna). Hay que leer `charges_details` por pago — que es exactamente lo que manda
la ley del proyecto.

### Lo único que sigue bloqueado
`/users/{id}/mercadopago_account/balance` → 403 en ambos dominios. El saldo total de la cuenta
no es legible; se reconstruye sumando pagos liberados vs. pendientes.

---

## 3. Alcance

### Dentro
1. **P&L mensual** — ingresos, costos y utilidad por mes, comparable entre meses.
2. **Flujo de caja** — cuánta plata está retenida y en qué fecha entra cada peso.
3. **Deudas y tarjetas** — cuánto debe por tarjeta, con cupo, día de corte y día de pago.
4. **Gastos operativos** — hoy solo empaques e insumos (confirmado con Jen: no hay arriendo,
   software, ni contador que registrar).
5. **Corrección del motor de costos** — dashboard y Finanzas leen el neto real de ML.

### Fuera
- Saldo bancario en vivo (bloqueado por la API).
- Proyecciones o presupuestos a futuro.
- Nómina — las bodegas ya se liquidan por quincena en `/logistica`.
- Multi-moneda: todo en COP.

---

## 4. Base de datos

### 4.1 `ml_payments` (nueva) — espejo local de Mercado Pago

Se sincroniza en vez de consultarse en vivo: son 1.441 pagos y el P&L necesita meses enteros.
Mismo patrón que `shipments` (`sync-dispatched.ts` / `sync-delivered.ts`).

```sql
CREATE TABLE ml_payments (
  id                  BIGINT PRIMARY KEY,          -- payment id de Mercado Pago
  order_id            TEXT,                        -- NULL en bonificaciones Flex
  operation_type      TEXT NOT NULL,               -- regular_payment | money_transfer
  description         TEXT,                        -- 'bonificaciones_flex_fc' identifica el bono
  status              TEXT NOT NULL,               -- approved | refunded | cancelled
  date_approved       TIMESTAMPTZ,
  money_release_date  TIMESTAMPTZ,
  money_release_status TEXT,                       -- pending | released
  transaction_amount  NUMERIC(14,2) NOT NULL,      -- bruto cobrado al comprador
  net_received_amount NUMERIC(14,2) NOT NULL,      -- lo que realmente queda
  meli_fee            NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_charge     NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_withholding     NUMERIC(14,2) NOT NULL DEFAULT 0,  -- fuente + ICA sumadas
  charges             JSONB,                       -- desglose crudo, por si aparece un cargo nuevo
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ml_payments_release  ON ml_payments(money_release_date)
  WHERE money_release_status = 'pending';
CREATE INDEX idx_ml_payments_approved ON ml_payments(date_approved);
CREATE INDEX idx_ml_payments_order    ON ml_payments(order_id) WHERE order_id IS NOT NULL;

ALTER TABLE ml_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solo admin lee pagos" ON ml_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

`charges` se guarda crudo a propósito: si ML agrega un cargo que hoy no existe, aparece en el
JSON aunque ninguna columna lo esté leyendo. Es el seguro contra el próximo "ICA sorpresa".

### 4.2 `expenses` (nueva) — gastos operativos

Tabla genérica y plana. Hoy solo hay una categoría real; una tabla de "gastos fijos
recurrentes" con plantillas sería sobre-ingeniería para un caso de uso.

```sql
CREATE TABLE expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category          TEXT NOT NULL,               -- 'empaques_insumos' | libre
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

### 4.3 `payment_methods` (extender)

```sql
ALTER TABLE payment_methods
  ADD COLUMN kind          TEXT CHECK (kind IN ('credito','debito','efectivo')),
  ADD COLUMN credit_limit  NUMERIC(14,2),
  ADD COLUMN statement_day SMALLINT CHECK (statement_day BETWEEN 1 AND 31),  -- día de corte
  ADD COLUMN due_day       SMALLINT CHECK (due_day BETWEEN 1 AND 31);        -- día de pago
```

Los cuatro métodos existentes se marcan: Davivienda / Falabella / Rappi = `credito`,
Efectivo-Transferencia = `efectivo`. Cupo y fechas los registra Jen desde la UI.

---

## 5. El motor de costos, corregido

### Antes (calculado, con un estimado dentro)
```
bruto − comisión − envío + bonoFlex − producto − bodega − courier − retención(1,5% estimado)
```

### Después (leído de la fuente)
```
neto_real_ML (ya trae comisión, envío y AMBAS retenciones)
  + bonificaciones Flex del periodo
  − costo de producto        (purchases, promedio ponderado real)
  − pago a bodega            (por logistic_type real del envío)
  − courier Flex             (por logistic_type real del envío)
  − ads                      (billing ledger / ads_daily_snapshots)
  − gastos operativos        (expenses)
= UTILIDAD REAL
```

Más exacto **y** más simple: tres términos calculados desaparecen porque ML ya los descontó.

**Bonificaciones Flex:** llegan como pagos sueltos `operation_type: money_transfer`,
`description: 'bonificaciones_flex_fc'`, **sin `order_id`** — solo un `external_reference`
tipo `cashback_XXXXX`. Se pueden **sumar por periodo pero no atribuir a una venta puntual**.
Para el P&L alcanza. Para margen por producto se sigue usando el cálculo por envío que ya
existe en `getShipmentCost` (`base_cost − list_cost`).

**Fallback:** si un pedido aún no tiene su pago sincronizado (ventas de minutos atrás), se usa
el cálculo actual, marcado como provisional en la UI. Nunca se mezclan silenciosamente.

**Devengado vs. caja — no son lo mismo y la UI no debe confundirlos:**
- **P&L** se agrupa por `date_approved` (cuándo se vendió).
- **Flujo de caja** se agrupa por `money_release_date` (cuándo entra la plata).

Una venta del 18 de agosto es utilidad de agosto pero caja de septiembre.

---

## 6. Arquitectura

```
src/features/finanzas/
  services/
    sync-ml-payments.ts     ← trae pagos nuevos + refresca los 'pending'
    get-pnl.ts              ← P&L mensual (por date_approved)
    get-cash-flow.ts        ← pendiente de liberar, por fecha (por money_release_date)
    get-debts.ts            ← deuda por tarjeta + cupo disponible + próximo corte
    expense-actions.ts      ← alta/edición/borrado de gastos
  components/
    PnlTable.tsx · CashFlowTimeline.tsx · DebtCard.tsx · ExpenseForm.tsx · ExpensesList.tsx
src/app/(main)/finanzas/page.tsx
```

**Cliente MP:** extender [ml-client.ts](src/features/dashboard/services/ml-client.ts) con un
`mpGet<T>()` que apunte a `api.mercadopago.com` reusando el mismo token. No se duplica la
lógica de token.

**Sincronización:** los pagos `pending` cambian de estado solos, así que el sync hace dos cosas
— traer pagos nuevos (`date_created` desc hasta encontrar uno conocido) y **refrescar los
pendientes cuya `money_release_date` ya pasó**. Se dispara al abrir la tab, igual que
`/logistica` hoy. Si más adelante molesta la latencia, se mueve al cron que ya existe
(`/api/cron/snapshot-ads-daily`).

**Carga inicial:** los 1.441 pagos históricos se importan una sola vez con un script manual,
no al abrir la tab.

---

## 7. Seguridad

`/finanzas` es **admin-only**. Ya está previsto en
[AppNav.tsx:20](src/shared/components/AppNav.tsx#L20) (`roles: ['admin'], enabled: false`) —
solo hay que activarlo.

| Rol | Ve |
|---|---|
| `admin` (Jen, Enrique) | Todo |
| `bodega` (Gina, Daniel) | **Nada.** No aparece la tab, y RLS bloquea las tablas |

Doble barrera a propósito: la nav oculta y RLS niega. Gina y Daniel no deben ver márgenes,
deudas ni utilidad — igual que hoy no ven costos ni compras.

Checklist: RLS en las 2 tablas nuevas · sin secretos nuevos (token ya en `ml_tokens`) ·
validación Zod en el form de gastos · montos como `NUMERIC`, nunca `float`.

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| **La ganancia va a bajar** y parecerá que algo se rompió | Avisado y aceptado por Jen antes de construir. La UI debe explicar el cambio la primera vez |
| ML agrega un cargo nuevo que ninguna columna lee | `charges` JSONB guarda todo crudo; alerta si aparece un `name` desconocido |
| `money_release_date` vuelve a cambiar (ya pasó: 3-13 días → 21) | Nunca se codifica el plazo. Siempre se lee el campo |
| 1.441 pagos hacen lento el primer sync | Carga inicial por script, una vez, fuera de la app |
| Pedido sin pago sincronizado aún | Fallback al cálculo actual, marcado como provisional |
| Doble registro de gasto (pasó con las compras) | El panel de confirmación **no se cierra solo** — lección de Fase 2 |

---

## 9. Gotchas heredados

- **`'use server'` solo exporta funciones async.** Exportar una constante tumba todos los
  exports del archivo con un 500 que parece caché de Turbopack. Las constantes van aparte.
- **Verificar contra la pantalla real de ML**, no contra consistencia interna. Ya falló dos
  veces. El número a contrastar aquí: la venta de $56.000 del 18-ago debe depositar
  **$48.488,16 el 8 de septiembre**.
- **Vistas con `security_invoker`**, nunca `security definer` — una vista definer ya se saltó
  el RLS entre bodegas en Fase 2.
- **Números como `NUMERIC`**, jamás `float`: `net_received_amount` trae centavos (48488.16).

---

*Pendiente de aprobación antes de pasar al screen-flow.*
