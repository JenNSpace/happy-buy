# Mercado Libre: el límite de llamadas y cómo se convive con él

La pantalla de logística murió **dos veces** el 2026-08-20 con
`429 {"message":"local_rate_limited"}`, mostrando "Mercado Libre no respondió".

## Qué lo causa

- La pantalla se **auto-refresca sola**, se recarga a mano, se abre en varias pestañas y reintenta
  al fallar. Sin caché, cada una de esas era una tanda nueva de llamadas.
- Y buena parte lo causé yo: correr consultas de diagnóstico contra la API de ML durante la sesión
  consume el mismo cupo que la pantalla de Jen. **Espaciarlas y avisarle.**

## Lo que quedó implementado

En `ml-client.ts`:

- **Las respuestas se reusan 20 segundos.** No más: el riesgo de datos viejos es que un paquete ya
  despachado siga apareciendo y alguien lo mande dos veces.
- **`cache: 'force-cache'` es obligatorio, no decorativo.** La documentación de Next 16
  (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md`) dice que el cacheo
  es **opt-in** y que una petición con header `Authorization` —como todas las nuestras— solo se
  cachea si se pide explícitamente. Con `next: { revalidate }` a secas no se guarda nada.
- Backoff de 1s, 2s, 4s, 8s ante un 429. Con esperas de 400ms se agotaban los reintentos y la
  pantalla se caía igual: **la ventana del límite dura segundos, no milisegundos.**
- Cualquier otro error falla de una: un 404 no mejora esperando.

`mpGet` (Mercado Pago) y `mlGetBinary` (etiquetas) se quedan sin caché: la etiqueta tiene que ser
fresca y MP es otro host con su propio límite.

En `AutoRefresh.tsx`: el intervalo pasó de 1 a 2 minutos.

## Reducciones de llamadas que valían igual

En `getPendingShipmentsForAdmin`:
- El SLA se pide **después** de filtrar por `needsDispatch`, no para todas las órdenes del mes.
- No se le pregunta a ML por envíos que ya tienen `delivered_at` local: están despachados, se
  filtran al final de todas formas y `syncAutoDelivered` no tiene nada que hacer con ellos.

## Lección general

Antes de dar por bueno un arreglo de caché o de fetch en este proyecto, **leer
`node_modules/next/dist/docs/`**. Next 16 cambió el modelo (`use cache`, `cacheLife`) y las
suposiciones traídas de versiones anteriores fallan en silencio — no dan error, simplemente no
cachean.
