# Operación: bodegas, tarifas y pagos por quincena

Contexto operativo confirmado con la usuaria el 2026-08-18. Los dueños están en
**Guatavita**, no en Bogotá — por eso dependen de las bodegas y **no se les baja
el pago**: sin ellas no hay operación.

## Quién es quién

| Bodega | Persona | Qué hace | Tarifa |
|---|---|---|---|
| Villa Del Rosario | Gina | Flex y agencia | $3.000 Flex · $5.000 agencia |
| Galerías | Daniel | solo agencia | $5.000 |
| **Full** | Mercado Libre | despacha todo solo | $0 — `is_fulfillment = true` |

**Empresa externa de Flex:** cobra **$7.500 fijos por entrega**, solo Bogotá, y
es **adicional** a los $3.000 de Gina. Un paquete Flex cuesta $10.500.

## Costo real por canal (con esto se decidió no cambiar de estrategia)

| | Flex | Agencia |
|---|---|---|
| Bodega | $3.000 | $5.000 |
| Courier externo | $7.500 | — |
| Envío que cobra ML | $0 | ~$8.100 |
| Bonificación ML | +$990 | $0 |
| **Neto** | **$9.510** | **$13.100** |

**Flex sale $3.590 más barato por pedido.** Punto de equilibrio: si el courier
llegara a cobrar más de **$11.090**, convendría agencia.

Los pedidos de agencia son casi todos **fuera de Bogotá** (Bucaramanga, Medellín,
Ibagué, Valledupar...), así que agencia no es una elección sino una necesidad.
No hay ahorro fácil moviéndolos a Flex.

## Estructura de costos del negocio (30 días a 2026-08-18)

80 pedidos · $6.877.912 en ventas · $85.974 promedio por pedido · 43% Flex.

De cada $100 vendidos: **$53 producto**, $15 comisión ML, $13,5 logística,
$3,5 publicidad, **~$13 de ganancia**.

Reparto de la logística ($926.000/mes): ML envíos $339.000 · courier externo
$255.000 · **bodegas $332.000**. Bajarle $500 por paquete a Gina y Daniel
ahorraría $40.000/mes (0,6% de las ventas) arriesgando toda la operación;
negociar el courier de $7.500 a $6.000 ahorra $51.000/mes sin riesgo.

## Pagos: por QUINCENA, no por mes

Enrique paga por quincena (1–15 y 16–fin de mes). Corregido en el código el
2026-08-18; antes calculaba por mes calendario.

- `warehouse_payments` — una fila por bodega y quincena, con índice único que
  impide pagar dos veces el mismo periodo.
- `warehouse_adjustments` — correcciones manuales en **+ o −** sobre lo que
  calcula la app. Dos necesidades reales: paquetes que ML aún no refleja
  (la usuaria sabe el hecho físico antes que la API), y costos que la API
  nunca podrá saber, como **la impresión de etiquetas que se les reembolsa
  cada quincena**. Son deltas, no reemplazos: la cifra automática queda
  siempre visible al lado.

**Estado al 2026-08-18:** quincena 1–15 de Daniel pagada. Quincena 16–31 en
curso: Daniel 4 paquetes/$20.000 (2 confirmados por ML + 2 por ajuste manual),
Gina pendiente de que ella mande su cuenta.

## Inventario: físico ≠ disponible

La usuaria **cuenta lo disponible en repisa**, sin los paquetes ya armados
esperando despacho. El sistema guarda el físico y solo descuenta al despachar.
**físico = disponible + por despachar.** La UI dice "disponibles"; el término
"comprometido" se descartó por confuso.
