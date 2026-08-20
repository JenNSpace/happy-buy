# Pendientes — al 2026-08-20

Leer esto primero al retomar.

## Listo para pagar (Jen marca las tarjetas en /logistica)

| Bodega | Quincena | Total |
|---|---|---|
| Villa Del Rosario | 1–15 ago | $47.600 |
| Villa Del Rosario | 16–31 ago | $37.200 |
| Galerías | 16–31 ago | $20.000 |
| Galerías | 1–15 ago | $120.000 — **ya pagada** |

Gina cobró $78.000 y le corresponden **$84.800**: había olvidado anotar dos envíos (un Pack X3
del 15-ago y una Multitoma del 18-ago) y sus dos etiquetas.

## Pendientes reales

1. **Inventario que nunca se descontó.** Hay envíos asignados sin `inventory_movements`, así que
   el stock está inflado. El fix de sincronización evita que siga creciendo, pero lo acumulado
   sigue ahí. Requiere reconstruir qué producto salió en cada envío histórico.
2. **El pago de Galerías 1–15 quedó registrado con $0 y 0 paquetes**, porque se marcó cuando el
   sistema no tenía los envíos asignados. Daniel sí cobró $120.000. Se corrige deshaciendo el
   pago y volviéndolo a marcar, ahora que los datos están bien.
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
