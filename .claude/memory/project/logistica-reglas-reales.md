# Logística: reglas reales de operación

Confirmadas con Jen el 2026-08-18, varias corrigiendo suposiciones anteriores.

## El corte de Flex es la 1 PM, no las 21:00

ML muestra "tu comprador debe recibir el paquete antes de las 21 hs" — es cierto pero
**inútil para la bodega**. El transportista que recoge pasa **a la 1 pm como máximo**
(confirmado por Ricky). La etiqueta tiene que estar impresa y pegada antes de que llegue.

**Un pedido Flex que entra después de la 1 pm sale al día siguiente**, y no debe marcarse
como atrasado: nadie puede actuar sobre él hasta mañana. Agencia también rueda — ver abajo.

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
Gina → Daniel. Tras eso Daniel cuadró **exacto** con su cuenta: **$120.000, 24 envíos**, verificado el
2026-08-20 contra su cuenta de cobro real (2+4+1+7+3+3+4 = 24 envíos a $5.000).

**Y ese cotejo confirmó la regla del desfase de fechas.** Su cuenta va del 31/07 al 13/08; el
sistema tiene esos mismos 24 paquetes entre el 5 y el 15 de agosto. Al reagrupar por día real de
despacho (lo escaneado de madrugada pertenece al día anterior) la parte del medio calza perfecto:
él anota 7 el 10/08 y el sistema tiene 7; anota 3 el 11 y el sistema tiene 3; anota 3 el 12 y el
sistema tiene 3. Los extremos se corren, pero **el total es idéntico**. Comparar por totales de
período, nunca por fecha exacta.

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

## El inventario NO estaba inflado (verificado 2026-08-20)

Durante días arrastré como pendiente que "el stock está inflado porque hay envíos sin
`inventory_movements`". **Es falso, y Jen lo cuestionó:** *"¿cuál inventario inflado hay? eso no
es real."*

Lo que se me había pasado: el **conteo físico del 18 de agosto** reseteó el stock a lo que
reportaron Gina y Daniel. Un conteo físico **borra la historia anterior** — los 65 envíos sin
movimiento son de antes y no deben descontarse de nada. Desde el conteo, 14 de 14 envíos tienen
su movimiento.

**Lección doble:**
1. Un pendiente heredado se verifica antes de repetirlo. Lo repetí en tres mensajes sin correr
   una sola consulta.
2. **Al reconciliar inventario, contar por la hora en que el paquete SALIÓ (`delivered_at`), no
   por la hora en que el sistema registró el movimiento (`created_at`).** Se separan varias horas
   — dos envíos salieron 3:52 pm y quedaron registrados 8:31 pm. Jen lo detectó preguntando
   *"¿cuántos pedidos salieron después de las 12:06?"*.
3. Y otra vez lo mismo: **pedidos ≠ unidades.** Eran 4 pedidos pero 5 bolsas, porque una venta
   llevaba dos. Confirmado contra `shipping_items` de ML, no contra nuestra base.

## El DÍA del plazo lo decide ML; la HORA la ponemos nosotros (2026-08-19)

Jen vio una venta de agencia que entró a las **21:36** marcada como *"Venció hace 5h 8min ·
Afecta tu reputación"*, mientras la pantalla de ML decía *"despáchalo mañana en una agencia ·
No afecta tu reputación"*. El corte se calculaba siempre contra **hoy**, sin mirar cuándo entró
el pedido ni el calendario.

**Por qué no se reimplementó la regla.** Contra 50 envíos reales, la regla de ML resultó ser:
días hábiles + festivos colombianos (todo lo del 15 y 16 de agosto saltó el lunes 17, festivo) +
un corte intradía + **cuenta desde el pago, no desde la venta**. Un pedido de agencia de las
16:25 se fue al día siguiente, y uno de las 13:16 se quedó el mismo día. Codificar eso a mano
era exactamente el error de "verifiqué unos casos y declaré una ley".

**La solución:** `GET /shipments/{id}/sla` devuelve `expected_date` y `status`, y coincide
exacto con lo que ML le muestra a Jen. Entonces:

- **El día** sale de ML (`sla.expected_date`) — así llegan gratis los festivos y los fines de semana.
- **La hora** la ponemos nosotros: Flex 13:00, agencia 17:00. La de ML es la promesa de entrega
  al comprador (23:00 en Flex), no el momento en que pasa el transportista.
- **`sla.status` (`on_time` / `delayed`) es lo único que decide "afecta tu reputación".** Nuestro
  corte es más estricto a propósito; que la bodega pierda el courier es urgente pero no es un
  veredicto sobre la cuenta. Si ML no responde, no se afirma ninguna de las dos cosas.

**Lección que se repite:** cuando el sistema y la pantalla de ML no coinciden, ML tiene un
endpoint que da la respuesta. Buscarlo antes de deducir la regla. Ver
[[verificar-contra-la-ui-real]].

**De paso, dos mensajes que mentían a las 10 de la noche:** "el transportista pasa hoy a la 1 pm"
y "despáchalo ya" con la agencia cerrada. Y un pedido de viernes en la noche ahora dice "el
lunes", no "mañana".

## Dos relojes distintos: el nuestro y el de ML (2026-08-20)

Nuestro corte (Flex 1 pm, agencia 5 pm) es **más estricto a propósito** que el de ML (23:00 y
17:00): mide alcanzar al transportista, no la promesa de entrega al comprador. De ahí se sigue
una regla que costó una corrección de Jen:

**Pasarse de NUESTRO corte no es una alarma.** Significa "sale en la próxima ronda". Jen lo vio
así: *"dice que ya no pasa hoy pero aun así está en alerta rojo cuando no debería ser una alerta
porque sí pasan mañana"*. La tarjeta se contradecía sola — el texto decía que nadie podía hacer
nada hoy y el color pedía actuar ya.

| Señal | Quién la decide | Cómo se ve |
|---|---|---|
| Falta poco para el corte | nuestro reloj | ámbar / rojo, caja de color |
| Ya pasó nuestro corte | nuestro reloj | **gris**, "Sale en la próxima ronda", sin caja |
| El envío está atrasado | **`sla.status` de ML** | rojo + "⚠ Afecta tu reputación" |

Si ML no responde, se cae a comparar el día: un plazo que quedó en un día anterior sí es un
paquete estancado. Ver `isLateForMl` en `get-shipment-sla.ts` y el tier `next_round` en
`countdown.ts`.

**Lección más general, y van dos veces con el mismo tema:** una alarma que aparece cuando no hay
nada que hacer se vuelve ruido, y entonces la alarma de verdad no se ve. Ya había pasado en el
dashboard con ocho filas rojas. Antes de pintar algo de rojo, preguntarse **qué acción concreta
puede tomar quien lo ve en este momento**; si la respuesta es "ninguna hasta mañana", no es rojo.
