# Screen Flow — `/finanzas`

> Deriva de [TECH-SPEC-finanzas.md](../../../TECH-SPEC-finanzas.md). Plan recortado: sin User
> Stories intermedias, cada sección traza directo al alcance aprobado.
> Convenciones visuales heredadas del rediseño de `FinancialSummaryCard` (2026-08-18).

---

> **⚠️ Las cifras de los bocetos son ILUSTRATIVAS.** Sirven para dimensionar el layout, no
> como datos. Solo dos son reales y verificadas: los $441.000 pendientes en Falabella y los
> $6.877.912 de ventas en 30 días. Todo lo demás está inventado para el dibujo — no tomar
> ninguna decisión de negocio a partir de este archivo.

## Principio rector

La tab responde **una sola pregunta**: *¿dónde está mi plata?*

Todo lo demás se subordina a eso. El orden de las secciones no es por importancia contable
sino por urgencia real: primero lo que se mueve esta semana, después el balance del negocio,
al final el registro manual.

---

## Estructura

Página scrolleable con secciones, igual que `/dashboard` — no sub-tabs. Cinco secciones,
`max-w-5xl`, consistente con el resto de la app.

```
┌────────────────────────────────────────────────────────┐
│  1 · Resumen de caja          ← hero, 3 cifras         │
├────────────────────────────────────────────────────────┤
│  2 · Cuándo entra la plata    ← barras por semana      │
├────────────────────────────────────────────────────────┤
│  3 · Resultado por mes        ← P&L, tabla comparable  │
├────────────────────────────────────────────────────────┤
│  4 · Tarjetas y deudas                                 │
├────────────────────────────────────────────────────────┤
│  5 · Gastos                   ← registro + lista       │
└────────────────────────────────────────────────────────┘
```

---

## 1 · Resumen de caja

**Entry:** primera pantalla al entrar a `/finanzas`.

```
┌──────────────────────────────────────────────────────────┐
│  Tu plata hoy                                            │
│                                                          │
│   RETENIDO EN ML          ENTRA ESTA SEMANA    DEBES     │
│   $2.847.320              $684.150             $441.000  │
│   36px greenDark          24px gray-900        24px      │
│   de 43 ventas            5 depósitos          Falabella │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Elemento | Fuente | Formato |
|---|---|---|
| Retenido en ML | `Σ net_received_amount WHERE money_release_status='pending'` | COP, sin decimales |
| Entra esta semana | `Σ` de pagos con `money_release_date` dentro de la semana Bogotá | COP |
| Debes | `Σ (total_cost + other_cost) FROM purchases WHERE NOT paid` | COP |

**Color según convención:** "Retenido" y "Entra" son plata que llega → verde. "Debes" es
neutro `gray-900`, **no rojo** — deber plata en una tarjeta no es un estado malo, es normal.
Rojo se reserva para cupo excedido o pago vencido.

**Estados:**
- *Loading* — skeleton de 3 bloques (reusar `CardSkeleton`).
- *Empty* (sin pagos sincronizados) — "Sincronizando pagos de Mercado Libre…" con el botón de
  sincronizar. No mostrar $0, que se leería como "no tienes plata".
- *Error* — mensaje con el error de la API y botón de reintentar. Nunca un cero silencioso.

---

## 2 · Cuándo entra la plata

Responde *"¿cuándo puedo contar con esa plata?"*. Esta sección es la razón de ser de la tab.

```
┌──────────────────────────────────────────────────────────┐
│  Cuándo entra la plata                                   │
│  Mercado Libre retiene cada venta ~21 días               │
│                                                          │
│   $                                                      │
│   │      ▄▄                                              │
│   │  ▄▄  ██  ▄▄                                          │
│   │  ██  ██  ██  ▄▄                                      │
│   └──┴───┴───┴───┴────────────                           │
│    esta  próx  +2   +3  semanas                          │
│                                                          │
│  Próximos depósitos                                      │
│  8 sep    $184.320    4 ventas del 18 ago                │
│  9 sep    $221.100    5 ventas del 19 ago                │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

| Elemento | Fuente | Nota |
|---|---|---|
| Barras | `Σ net_received_amount` agrupado por semana de `money_release_date` | Reusar `MiniBarChart` |
| Subtítulo | Mediana real de `money_release_date − date_approved` | **Calculado, no escrito a mano** — el plazo ya cambió una vez (3-13 días en 2025 → 21 hoy) |
| Lista | Pagos `pending` agrupados por día de liberación | Máx. 10 filas, con "ver todos" |

**Acciones:** ninguna. Es una vista de lectura.

**Empty:** "No hay pagos pendientes de liberar" — estado legítimo, no un error.

---

## 3 · Resultado por mes (P&L)

Meses en **columnas** para que se comparen de un vistazo. Últimos 3 meses + mes actual.

```
┌──────────────────────────────────────────────────────────┐
│  Resultado por mes                                       │
│  Cuenta cada venta el mes que se vendió, no el mes que   │
│  entra la plata.                                         │
│                                                          │
│                        JUN      JUL      AGO*            │
│  Ventas             6.412.000 7.104.000 6.877.912       │
│                                                          │
│  Mercado Libre                                           │
│    Comisión          −961.800 −1.065.600  −1.031.686    │
│    Envíos            −412.000   −455.000    −441.000    │
│    Retenciones       −122.700   −135.900    −131.643    │
│                                                          │
│  Tu operación                                            │
│    Producto        −3.398.360 −3.765.120 −3.645.293     │
│    Bodegas           −198.000   −219.000    −212.000    │
│    Courier Flex      −134.000   −148.500    −144.000    │
│    Empaques           −45.000    −52.000     −38.000    │
│                                                          │
│  Publicidad          −224.420   −248.640    −240.727    │
│                                                          │
│  UTILIDAD            $915.720   $1.014.240   $993.563   │
│  Margen                 14,3%       14,3%      14,4%    │
│                                                          │
│  * Agosto va al día 18 — mes incompleto                 │
└──────────────────────────────────────────────────────────┘
```

**Convenciones aplicadas:**
- Costos rutinarios en `gray-700` con prefijo `−`. **Nunca rojo** — ocho filas rojas gritan y
  esconden la única que importa.
- Agrupación semántica **por quién recibe la plata**, igual que en `FinancialSummaryCard`.
- Jerarquía: 14px ítems → 16px subtotales de grupo → 20px utilidad.
- La utilidad se pinta roja **solo** si es negativa.
- Decimal coma, `Intl` es-CO (`formatPercent` en `src/shared/utils/format.ts`).
- El mes en curso se marca con `*` y nota al pie — comparar un mes de 18 días contra uno de 31
  sin avisar es engañoso.

**Aviso de la corrección (una sola vez):** la primera carga tras el cambio muestra un banner
dismissible:

> **Los números cambiaron y están bien.** Ahora leemos directo de Mercado Libre lo que te
> descuentan en cada venta. Antes estimábamos las retenciones en 1,5% y en realidad son dos
> (fuente 1,5% + ICA Bogotá 0,414%). La ganancia se ve más baja porque **antes estaba
> inflada**, no porque el negocio empeorara.

Se guarda en `localStorage` — no amerita una columna en la base de datos.

---

## 4 · Tarjetas y deudas

Una tarjeta por método de pago de tipo `credito`.

```
┌────────────────────────────┐  ┌────────────────────────────┐
│  Tarjeta Falabella (CMR)   │  │  Tarjeta Davivienda        │
│                            │  │                            │
│  Debes    $441.000         │  │  Debes    $0               │
│  ████████░░░░░░░  29%      │  │  ░░░░░░░░░░░░░░░  0%       │
│  Cupo disponible $1.059.000│  │  Cupo disponible $3.000.000│
│                            │  │                            │
│  Corta el 15 · Paga el 5   │  │  Corta el 20 · Paga el 10  │
│  2 compras sin pagar       │  │  Al día                    │
└────────────────────────────┘  └────────────────────────────┘
```

| Elemento | Fuente |
|---|---|
| Debes | `Σ purchases WHERE payment_method_id = X AND NOT paid` + `Σ expenses` del mismo método |
| Barra de cupo | `debes / credit_limit` |
| Corta / Paga | `statement_day` / `due_day` |

**Semántica de color en la barra:** verde bajo 50% · ámbar 50-80% · **rojo sobre 80%**. Este
sí es un estado genuinamente malo y merece rojo.

**Sin cupo registrado:** ocultar la barra y mostrar "Registrar cupo y fechas" como enlace. No
inventar un cupo ni mostrar una barra vacía sin explicación.

**Acciones:**
| Acción | Control | Resultado |
|---|---|---|
| Registrar cupo/fechas | Enlace → form inline | Guarda en `payment_methods`, la tarjeta se re-renderiza |
| Ver compras sin pagar | Enlace → `/compras` filtrado | Navega |

---

## 5 · Gastos

Hoy solo empaques e insumos, pero la categoría es texto libre para que no haya que migrar
cuando aparezca otra.

```
┌──────────────────────────────────────────────────────────┐
│  Gastos                          [+ Registrar gasto]     │
│                                                          │
│  18 ago  Cajas y cinta        $38.000   Efectivo         │
│  02 ago  Rollos de etiqueta   $52.000   Falabella        │
│  ...                                                     │
│                                                          │
│  Total agosto: $90.000                                   │
└──────────────────────────────────────────────────────────┘
```

**Formulario** (panel inline, no modal — consistente con `PurchaseForm`):
descripción · monto · fecha (default hoy) · categoría (dropdown con "Otro" editable, igual que
la plataforma en compras) · método de pago.

**⚠️ El panel de confirmación NO se cierra solo.** Lección de Fase 2: un panel que se
autocerraba causó un doble registro real de 100 unidades. El éxito queda visible hasta que la
usuaria lo cierre.

**Empty:** "Aún no has registrado gastos. Los empaques, cajas y cintas van aquí — no aparecen
en ningún otro lado del sistema." Explica *por qué* existe la sección, no solo que está vacía.

---

## Componentes

**Se reusan:** `CardSkeleton` · `MiniBarChart` · `ProductThumbnail` (no aplica aquí) ·
utilidades de `format.ts` · patrón de form de `PurchaseForm`.

**Nuevos** (todos dentro de `src/features/finanzas/components/`):

| Componente | Por qué es componente |
|---|---|
| `CashSummaryCard` | Hero de 3 cifras, solo esta pantalla — podría ser inline, pero aísla el estado de carga |
| `CashFlowSection` | Barras + lista de depósitos |
| `PnlTable` | Tabla de meses en columnas, con agrupación y subtotales |
| `DebtCard` | Se repite por tarjeta → componente |
| `ExpenseForm` + `ExpensesList` | Se repite el patrón de compras |
| `CostModelChangeBanner` | Aviso único, dismissible |

---

## Acceptance Targets

1. Un usuario con rol `bodega` que navega a `/finanzas` **es redirigido** y no ve la tab en la nav.
2. El hero muestra tres cifras con etiquetas "Retenido en ML", "Entra esta semana" y "Debes".
3. Con cero pagos sincronizados, el hero muestra el estado de sincronización, **no `$0`**.
4. El subtítulo del plazo de retención sale de datos reales, no de una constante — cambiar los
   datos cambia el texto.
5. La tabla de P&L rotula el mes en curso como incompleto cuando la fecha actual no es el último
   día del mes.
6. Ninguna fila de costo rutinario se pinta roja. La utilidad se pinta roja solo si es negativa.
7. Una tarjeta sin `credit_limit` no muestra barra de progreso.
8. Una tarjeta con uso >80% del cupo muestra la barra en rojo.
9. Tras guardar un gasto, el mensaje de éxito **permanece visible** hasta cierre manual.
10. El banner de cambio de modelo aparece una vez y no vuelve tras cerrarlo.
11. Todos los montos usan coma decimal y separador de miles es-CO.
12. La página no hace scroll horizontal en un viewport de 375px.

---

## Verificación de completitud

- [x] Cada sección traza al alcance del Tech Spec
- [x] Entry point, datos, acciones y estados por sección
- [x] Empty y error states diseñados, no solo el happy path
- [x] Componentes nuevos vs. reusados identificados
- [x] Acceptance targets verificables
- [x] Convenciones visuales del dashboard aplicadas

---

*Pendiente de aprobación antes del Blueprint.*
