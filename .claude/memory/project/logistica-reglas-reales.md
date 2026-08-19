# Logística: reglas reales de operación

Confirmadas con Jen el 2026-08-18, varias corrigiendo suposiciones anteriores.

## El corte de Flex es la 1 PM, no las 21:00

ML muestra "tu comprador debe recibir el paquete antes de las 21 hs" — es cierto pero
**inútil para la bodega**. El transportista que recoge pasa **a la 1 pm como máximo**
(confirmado por Ricky). La etiqueta tiene que estar impresa y pegada antes de que llegue.

**Un pedido Flex que entra después de la 1 pm sale al día siguiente**, y no debe marcarse
como atrasado: nadie puede actuar sobre él hasta mañana. Ver `ROLLS_OVER_TO_NEXT_DAY` en
`dispatch-cutoff.ts`. Agencia sigue en 17:00 (la agencia está abierta, todavía se puede llevar).

## Los cuadernos usan la fecha de despacho; ML la del día siguiente

Verificado con las dos bodegas. El caso más claro: Daniel cobró 3 envíos el 11/08, 3 el 12/08
y 4 el 13/08 — el sistema los tiene el 12, 13 y 14. **Desfase de +1 día consistente.** Nunca
comparar cuaderno contra sistema por fecha exacta; comparar por totales de período.

## Solo Gina hace Flex. Daniel es agencia únicamente

Regla firme. Sirve para asignar envíos huérfanos sin preguntar: **si es Flex, es de Gina.**

## Cómo distinguir el canal real sin llamar a la API

Cruzando con `ml_payments`: si el pago trae `shp_cross_docking`/`shp_dropoff` fue **agencia**
(ML cobró flete); si trae `shp_fulfillment` fue **Full**; si no trae cargo de envío fue
**Flex** (ML bonifica en vez de cobrar). Más confiable que `shipments.fulfillment_type`, que
puede venir null y entonces se cobra al precio de agencia por defecto.

## Episodio 2026-08-18: envíos mal asignados

Las cuentas de las bodegas no cuadraban con el sistema. Causa: **57 envíos despachados que
nadie asignó** a ninguna bodega (no cuentan para el pago de nadie) y **6 envíos de agencia
cargados a Gina que eran de Daniel**. Corregido: 8 Flex → Gina, 17 agencia → Daniel, 6 de
Gina → Daniel. Tras eso Daniel cuadró **exacto** con su cuenta ($120.000 en la quincena 1-15).

**La pista que lo resolvió fue el monto, no la fecha:** a Daniel le faltaban exactamente 6
envíos y a Gina le sobraban exactamente 6 de agencia.

## El bug que hacía desaparecer envíos entregados (arreglado 2026-08-18)

**Síntoma:** Gina contaba 21 envíos, la pantalla mostraba 18. Cinco paquetes que ML reportaba
como `delivered`, con fecha de despacho, no estaban en el sistema — ni pagados ni descontados
de inventario.

**Causa: una carrera entre dos consultas.** `getPendingShipmentsForAdmin` busca órdenes con
`tags: not_delivered` y es quien llama a `syncAutoDelivered` para rellenar `delivered_at`. En
cuanto ML marca el envío como entregado, **la orden pierde ese tag** y sale de la búsqueda. Si
nadie abrió la pantalla en la ventana entre "pendiente" y "entregado", el envío se perdía para
siempre. `syncDispatchedShipments` debía cubrirlo (recorre todas las órdenes) pero solo miraba
envíos **sin fila local**; estos tenían fila con bodega asignada y `delivered_at` null, así que
caían justo entre las dos.

**Fix:** `syncDispatchedShipments` ahora también cierra los que ya existen sin fecha de
despacho, delegando en `syncAutoDelivered` para que el inventario se descuente igual que en el
flujo normal.

**Criterio confirmado por Jen:** el pago cuenta **cuando la bodega ENTREGA** el paquete —al
courier de Flex o en la agencia—, no cuando ML lo confirma ni cuando la bodega lo empaca. En ML
eso es `substatus` `dropped_off` o `picked_up`.

**Lección:** cuando un filtro define el conjunto que se sincroniza, preguntarse qué pasa con
los registros que **salen** de ese filtro. Acá el estado de destino era justo el que lo excluía.

## El cuaderno de la bodega puede tener OMISIONES (2026-08-19)

Gina cobró 21 envíos y el sistema mostraba 23. Jen dio la instrucción de que los 21 eran la
verdad y de "buscar que sea así". Se verificó de tres formas —que no fueran los pendientes, que
no fueran dos ventas en un mismo paquete (se agrupó por `pack_id`), y que el tipo de cada envío
coincidiera con ML en los 64 de agosto— y los 23 resultaron reales.

**Al darle a Jen los datos completos de los dos envíos (producto, comprador, ciudad, hora de
despacho), confirmó con su mamá: los había olvidado anotar.** Un Pack X3 y una Multitoma.

**Cómo se resolvió:** no discutiendo el total, sino entregando los datos con los que la persona
podía reconocer el envío. El número de venta (el `pack_id`, ver [[ml-numero-de-venta-visible]]),
el producto, el comprador y la **hora exacta de despacho** fueron lo que permitió identificarlos.

**Lección:** el cuaderno de la bodega es excelente para auditar el sistema —encontró tres bugs
reales el 2026-08-18— pero no es infalible. Cuando los dos discrepan, la salida no es elegir a
quién creerle sino **bajar al envío individual** y dejar que la persona lo reconozca. Ojo con
los envíos que salen **fuera del lote**: los dos olvidados salieron uno junto a otro despacho y
otro una hora después del grupo.

## Pendiente: inventario sin descontar

Hay envíos asignados que **nunca generaron movimiento de inventario**, así que el stock está
inflado. Asignar por SQL no dispara esa lógica (sí lo hace `assignWarehouse` en la app).
Requiere reconstruir qué producto salió en cada envío. **No resuelto.**
