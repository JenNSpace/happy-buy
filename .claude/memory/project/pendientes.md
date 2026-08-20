# Pendientes — al 2026-08-20

Leer esto primero al retomar.

## Listo para pagar (Jen marca las tarjetas en /logistica)

| Bodega | Quincena | Total |
|---|---|---|
| Villa Del Rosario | 1–15 ago | $47.600 |
| Villa Del Rosario | 16–31 ago | $37.200 |
| Galerías | 16–31 ago + ajustes | $25.000 |
| Galerías | 1–15 ago | $125.000 — **ya pagada** (25 paquetes, solo paquetes) |

Gina cobró $78.000 y le corresponden **$84.800**: había olvidado anotar dos envíos (un Pack X3
del 15-ago y una Multitoma del 18-ago) y sus dos etiquetas.

## Pendientes reales

1. ~~**Inventario que nunca se descontó.**~~ **FALSO — verificado el 2026-08-20.** La nota venía
   de antes del **conteo físico del 18 de agosto**, que reseteó el stock a lo que Gina y Daniel
   contaron (24 / 12 bolsas, 38 cables). Ese conteo borra la historia anterior: los 65 envíos
   "sin movimiento" son de antes y no deben descontarse de nada. Desde el conteo, **14 de 14**
   envíos tienen su movimiento. El mecanismo funciona.

   Lo que sí quedó: **1 bolsa de más de Sal Céltica en Villa Del Rosario.** El ajuste del 18-ago
   se registró como +4 cuando debía ser +3 (el saldo previo era 21, no 20). Pendiente de que Jen
   cuente la repisa: si hay 19, se aplica −1; si hay 20, el conteo de Gina no incluía los
   paquetes ya empacados y el sistema está bien.
2. ~~**El pago de Galerías quedó en $0.**~~ **RESUELTO el 2026-08-20.** Se corrigió a $125.000 /
   25 paquetes. La causa quedó clara: el pago se marcó a las 12:30 pm del 18-ago y los 17 envíos
   que faltaba asignarle a Daniel entraron al sistema a las 12:39 pm — nueve minutos después. El
   panel de cuenta corriente ahora muestra lo generado en el rango ANTES de guardar el pago,
   justo para que eso no se repita.
3. **`design-critic` sobre el resto del dashboard.** El 2026-08-20 se corrió sobre la tarjeta de
   envío de `/logistica` y valió la pena — encontró un bug real de CSS (el renglón superior sin
   `shrink-0`/`truncate`) además del problema de jerarquía. Faltan las tarjetas del dashboard y
   las de Finanzas.
4. **Optimización para celular**, en el resto de la app. Las tarjetas de `/logistica` ya se
   verificaron a 390px con Playwright. Pendiente el mismo repaso en dashboard y Finanzas:
   revisar el tooltip de `MiniBarChart` (depende de hover) y el scroll horizontal de `PnlTable`.
5. **La grilla de `/logistica` está fija en 3 columnas y hay 3 temas de color que se reciclan**
   (`WAREHOUSE_THEMES`, `theme[i % 3]`). Con una tercera bodega, dos columnas quedarían del
   mismo color. Lo detectó `design-critic`; no es urgente pero conviene antes de que pase.

## Desplegado el 2026-08-20

Tres cambios en `/logistica`, todos en producción:

1. **El plazo de despacho lo decide ML.** El día sale de `/shipments/{id}/sla`, la hora la
   ponemos nosotros. Ver [logistica-reglas-reales.md](logistica-reglas-reales.md).
2. **El número grande son las unidades físicas a empacar** (cantidad × `units_per_sale`), con
   sello `PACK X3` y la nota "En Mercado Libre aparece como 1 unidad". 20 de las últimas 50
   ventas exigen empacar más de una unidad.
3. **Rediseño de la tarjeta** tras pasar `design-critic`, y la separación de los dos relojes:
   pasarse de nuestro corte es "sale en la próxima ronda", no una alarma.

## Lo que quedó construido en sesiones anteriores

**Fase 3 — Finanzas** (ver [fase3-finanzas.md](fase3-finanzas.md)): tab `/finanzas` con caja,
flujo de liberaciones, P&L mensual, tarjetas con cupo y registro de gastos. Motor de costos
leyendo el neto real de Mercado Pago.

**Logística** (ver [logistica-reglas-reales.md](logistica-reglas-reales.md)): corte de Flex a la
1 pm, quincenas impagas visibles, y el bug que hacía desaparecer envíos ya entregados.

## Cómo se encontraron los bugs de esta sesión

Vale la pena registrarlo como método, porque los cuatro salieron igual: **Jen comparando la
pantalla contra papel o contra su cuenta de ML**, no una auditoría automática. El sistema se veía
sano —totales redondos, columnas que sumaban— y estaba mal en cuatro lugares distintos.

Los dos hallazgos más caros salieron de preguntas suyas, no de verificaciones propias:
- *"¿de dónde sacaste este dato?"* → destapó $587.071 de compras personales mostradas como
  ventas retenidas.
- *"¿no serán dos paquetes de Daniel?"* → destapó un ajuste que duplicaba el pago de otra bodega.
