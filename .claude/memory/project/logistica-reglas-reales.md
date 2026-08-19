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

## Pendiente: inventario sin descontar

Hay envíos asignados que **nunca generaron movimiento de inventario**, así que el stock está
inflado. Asignar por SQL no dispara esa lógica (sí lo hace `assignWarehouse` en la app).
Requiere reconstruir qué producto salió en cada envío. **No resuelto.**
