# Logística: `status` no dice si el paquete ya salió — usa `substatus`

Bug real encontrado por la usuaria el 2026-08-18, después de que una auditoría
mía dijera "todo bien". Un Cable Ugreen que ML mostraba en pantalla como
**"En camino · Llega entre hoy y mañana"** seguía apareciendo como pendiente de
despacho en el panel.

## La causa

`shipment.status` se queda en `ready_to_ship` **aunque ya hayas dejado el
paquete en la agencia**. Solo cambia a `shipped` cuando la transportadora lo
escanea, que puede ser un día después. El campo que sí distingue es `substatus`:

| substatus | Significa |
|---|---|
| `printed`, `ready_to_print` | Sigue en la bodega — falta despacharlo |
| `dropped_off` | **Ya lo dejaste en la agencia** |
| `picked_up`, `in_hub`, `on_route`, `out_for_delivery` | Ya va en camino |

Verificado: con el arreglo el panel mostró 7 pendientes, exactamente los mismos
7 que ML reporta como "Listas para despachar".

## Diseño defensivo que quedó

Un `substatus` que no reconocemos resuelve a **`unknown`, no a `gone`**: el
paquete **se muestra igual con un aviso ámbar** para que un humano confirme en
ML. Esconder algo que sí falta despachar es peor que mostrar algo de más.
Ver `getDispatchState()` en `parse-shipment.ts`.

## Otro hueco de la misma auditoría

La fila local de `shipments` **solo se creaba al asignar bodega**. Todo envío
que nadie asignó nunca entró al sistema: 16 envíos reales despachados y
entregados entre el 6 y el 12 de agosto no existían en la BD, no contaban para
el pago de nadie y **nunca descontaron inventario**. El sync de pendientes
tampoco los podía ver, porque filtra por la etiqueta `not_delivered` de ML y
esos ya estaban entregados.

Arreglado con `sync-dispatched.ts`: mira TODOS los pedidos recientes, registra
los despachados que no conoce, y los deja **sin bodega a propósito** (solo un
humano sabe quién lo llevó; adivinar corrompe la nómina). Se piden asignar con
un aviso, y al asignarlos se descuenta el inventario.

**Ese aviso se limita a la quincena abierta.** La primera versión listaba 57
envíos, casi todos de quincenas ya pagadas — ruido puro, y el ruido en una
alerta es como se terminan ignorando las alertas de verdad.

## Lección de método

La auditoría original verificó que el sistema fuera **internamente consistente**
(BD contra el campo `status` de ML) y por eso dio "todo bien". Nunca comparó
contra **lo que ML le muestra a la usuaria en pantalla**, que era la única
prueba que importaba. Ver `feedback/verificar-contra-la-ui-real.md`.
