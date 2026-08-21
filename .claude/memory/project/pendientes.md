# Estado al 2026-08-21

Leer esto primero al retomar. **Todo lo trabajado está desplegado en producción**
(happy-buy-topaz.vercel.app).

## Saldos con las bodegas

| Bodega | Le debemos | De qué |
|---|---|---|
| **Galerías** (Daniel) | **$50.000** | 8 paquetes desde el 15-ago ($40.000) + 2 paquetes que ML nunca reflejó ($10.000) |
| **Villa Del Rosario** (Gina) | **$26.800** | 6 paquetes desde el 19-ago ($20.000) + $6.800 que quedaron debiéndose del período ya cobrado |

Los $6.800 de Gina son los dos envíos que se le pasaron en su cuenta de cobro del 18-ago: cobró
$78.000 cuando había generado $84.800.

**Pagos ya registrados:** Daniel $125.000 (25 envíos, hasta el 14-ago) + $10.000 (etiquetas,
20-ago). Gina $78.000 (hasta el 18-ago).

## Cómo funciona la cuenta corriente

Reemplazó el modelo de quincenas fijas, que no servía porque las cuentas de cobro llegan tarde y
cubren el rango que la bodega decida. **Generado − pagado = saldo**, y las fechas de cada pago son
referencia, no la forma del dato.

Cuatro reglas que costaron encontrar, todas en `get-warehouse-ledger.ts`:

1. **`warehouses.ledger_start`** — desde cuándo la cuenta del sistema es la fuente. **No es la
   misma fecha para las dos bodegas**: Villa Del Rosario desde el 1-ago, Galerías desde el 15.
2. **`isAttributionCertain`** — un envío cuenta si quedó registrado al despachar **o si es Flex**
   (solo Gina hace Flex, así que no hay ambigüedad). Agencia asignada después NO cuenta: pudo ser
   de cualquiera de las dos.
3. **`coveredThrough`** sale del `period_end` más alto **solo de los pagos que cubren un período**
   (más de un día). Un pago de un concepto suelto se registra en un solo día y no mueve la
   cobertura: si lo hiciera, pagar etiquetas un día 20 haría ver como saldados todos los paquetes
   hasta esa fecha.
4. **`shortfall` se calcula por diferencia** (saldo − pendientes), para que las partes siempre
   sumen el saldo aunque haya pagos con rangos solapados.

El período anterior a `ledger_start` **no se calcula**: se salda con la cuenta de cobro que pasó
la bodega, registrada como ajuste de apertura. El de Daniel son $125.000 (sus 24 envíos + la
última Multi Toma).

## Pendientes

1. **El envío 47756002876 está asignado a Galerías pero su movimiento de inventario quedó contra
   Villa Del Rosario.** No afectó el conteo físico, pero la atribución por bodega puede estar
   torcida en otros envíos. Sin revisar.
2. **El deploy automático desde GitHub dejó de dispararse** el 2026-08-20. Se está desplegando con
   `npx vercel deploy --prod --yes`. Vale revisar la integración.
3. **`design-critic` sobre dashboard y Finanzas.** En la tarjeta de `/logistica` encontró un bug
   real de CSS además del problema de jerarquía, así que vale repetirlo.
4. **Celular** en el resto de la app. `/logistica` ya se verificó a 390px; falta el tooltip de
   `MiniBarChart` (depende de hover) y el scroll horizontal de `PnlTable`.
5. **La grilla de `/logistica` está fija en 3 columnas** con 3 temas de color que se reciclan
   (`WAREHOUSE_THEMES`, `theme[i % 3]`): con una tercera bodega, dos columnas quedarían iguales.

## Inventario: cuadra, y la nota vieja era falsa

El "inventario inflado" que se arrastraba como pendiente **no existe**. Venía de antes del conteo
físico del 18-ago, que reseteó el stock; un conteo físico borra la historia anterior. El 20-ago
Gina contó y los tres productos de Villa Del Rosario coincidieron **exacto** con el sistema
(20 sal / 4 multitoma / 36 cables). Desde el conteo, todos los envíos tienen su movimiento.

Ojo al comparar: las 20 bolsas incluían 2 ya vendidas sin despachar, y el sistema también las
contaba. Los dos miraban lo mismo.
