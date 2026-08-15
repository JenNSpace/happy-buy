# Fase 2 — Compras + Inventario

> Estado al 2026-08-15. Continúa Fase 0 (roles/warehouses) y Fase 1 (Logística),
> ambas ya en producción desde 2026-08-12. Fase 2 está construida y probada
> en vivo (local + base de datos Supabase compartida real), **pero NO
> desplegada a Vercel todavía** — no asumir que `/compras` es visible para
> usuarios reales hasta confirmar el deploy.

## Fase 2A — Catálogo + Inventario (construida)

- Tablas: `products`, `product_listings` (mapea `ml_item_id` → producto, con
  `units_per_sale` para packs), `inventory_movements` (libro de movimientos,
  no un contador — `type` en `entrada_compra | salida_venta | ajuste`).
- Catálogo real, verificado contra la API de ML: Sal Céltica (SC), Multi Toma
  (MT), Cable Ugreen Tipo C (CU).
- El descuento de inventario por venta es automático: se dispara cuando un
  envío pasa a `delivered_at` (Fase 1), usando `product_listings` para saber
  cuántas unidades base representa cada venta.
- Alerta de "publicaciones sin mapear": compara el catálogo vivo de ML contra
  `product_listings`. Si una publicación nueva comparte `user_product_id` con
  una ya conocida, se auto-mapea sola (mismo producto físico, otra vitrina).
  Si no, se muestra para revisión manual — pero el mapeo en sí lo resuelve
  Claude consultando la API directamente, no preguntándole al usuario los
  datos que ya puede averiguar solo.

## Fase 2B — Pantalla `/compras` (construida, rediseñada tras feedback real)

La primera versión (formulario "Registrar conteo/entrada/ajuste" con un
selector de tipos, más un formulario de traslado entre bodegas) fue
rechazada por el usuario tras verla: "Conteo inicial" no significaba nada
para ella, y el traslado nunca se usa en la operación real. Ver
[[ui-lenguaje-del-negocio]] para la lección de fondo.

**Versión actual:**
- Tabla `purchases`: producto, plataforma (dropdown Amazon/Alibaba/iHerb +
  "Otro" con texto libre), unidades, valor de la compra, otros gastos +
  motivo (envío, impuestos...), bodega destino (opcional, elegible desde que
  se crea), fecha estimada de entrega, estado `pedido | recibido`.
- **El inventario solo se mueve al marcar una compra como "recibida"** — no
  al crearla. Antes de eso es solo un registro de "viene en camino".
- Costo por unidad = `(total_cost + other_cost) / quantity`, calculado en
  vivo, nunca guardado como columna (evita que quede desincronizado si se
  edita la cantidad después).
- **Crear producto nuevo desde el mismo formulario**: seleccionar "Otro
  (producto nuevo)" en el dropdown de producto revela un campo de texto:
  al guardar, se crea el producto (código autogenerado desde el nombre) y
  el selector queda apuntando al producto real para la próxima compra — no
  hay que volver a escribirlo.
- Fotos de producto: traídas en vivo de la API de ML (`thumbnail`, forzado a
  `https://`) en toda la sección de Compras (tarjetas de stock, selector del
  formulario, lista de compras). Solo pedido para Compras, no para
  `/logistica` todavía. Un producto creado a mano vía "Otro" no tiene foto
  hasta que se mapee a una publicación real de ML.
- Stock actual: tarjetas separadas por bodega con color distintivo (mismo
  lenguaje visual que el kanban de `/logistica`), no una tabla plana.
- Ajuste manual de stock: quedó como una forma chica y colapsada
  (`<details>`), separada del flujo principal de "nueva compra" — sigue
  existiendo porque la necesidad real (corregir un conteo) no desaparece,
  solo se sacó de la vista principal.

## Bugs reales encontrados y corregidos en esta fase

Ver [[nextjs-use-server-solo-funciones]] y [[supabase-redirect-url-whitelist]]
para el detalle técnico de dos de estos.

1. **Pack X3 de Sal Céltica** faltaba en el mapa de tamaños de pack —
   hubiera cobrado costo de 1 bolsa en una venta de 3.
2. **Más grave**: el costo de producto nunca se multiplicaba por el tamaño
   del pack en el cálculo que alimenta el dashboard y el historial de
   ventas (sí lo hacía, correctamente, en la vista de catálogo — eran dos
   cálculos inconsistentes). Cada venta histórica de Pack X2/X3/X4 tenía la
   ganancia sobreestimada. Corregido — las cifras de margen se ven distintas
   a partir de ahora porque antes estaban mal, no por un nuevo bug.
3. Vista `stock_by_warehouse` corría con permisos del dueño (security
   definer) en vez de invoker — saltaba el RLS entre bodegas, cualquier
   bodega podía ver el stock de la otra. Corregido con `security_invoker`.
4. Un archivo `'use server'` no puede exportar una constante, solo funciones
   async — tiró toda la página de Compras con 500.
5. **Dato real corregido**: 100 cables Ugreen quedaron duplicados (200
   mostrados) porque el usuario los registró dos veces — una vez como
   compra recibida, otra como ajuste manual — al no quedarle claro que la
   primera sí había funcionado (el panel se cerraba casi de inmediato tras
   confirmar). Corregido en la base de datos real y en el código (el panel
   ya no se cierra solo tras marcar recibida).

## Pendiente / siguiente sesión

- **Import del historial de compras de Enrique** (hoja de Google Sheets,
  ~30 días): bloqueado. El conector de Google Drive está activo en la
  cuenta de claude.ai del usuario ("siempre lo estuvo"), pero necesita
  reiniciar la sesión de Claude Code (cerrar/reabrir la extensión de VS
  Code) para que el conector aparezca disponible aquí. Ver
  [[claude-code-conectores-de-cuenta]].
- Agregar `https://happy-buy-topaz.vercel.app/update-password` a la lista
  de Redirect URLs en el dashboard de Supabase (Authentication → URL
  Configuration) — arregla el reset de contraseña de forma permanente para
  cualquier usuario, no solo Jen.
- Desplegar Fase 2 a producción (todavía no se ha hecho).
- Fase 2C (según el plan original: fuente de fondeo, estado de pago) y
  Fase 2D (automatización — pausar/reactivar publicaciones de ML según
  stock real) siguen sin construir. El usuario ya dio las reglas reales de
  cuándo Enrique pausa una publicación — quedaron en la memoria personal de
  Claude, no repetidas aquí para no duplicar.
