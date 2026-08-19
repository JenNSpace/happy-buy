# Pendientes — al 2026-08-19

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
3. **`design-critic` sobre todo el dashboard** — lo que Jen quería hacer al final, con Finanzas
   ya construida.
4. **Optimización para celular**, en toda la app. Pedido explícito de Jen. Ya apareció un caso
   real: el botón "Eliminar" de gastos dependía de `hover` y era inalcanzable en táctil (ya
   corregido). Revisar el mismo patrón en el tooltip de `MiniBarChart` y el scroll horizontal
   de `PnlTable`.

## Lo que quedó construido en esta sesión

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
