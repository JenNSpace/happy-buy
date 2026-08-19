# Memoria del Proyecto — Índice

> Archivos organizados por carpeta (tipo). Max 200 líneas.
> Gestionado por skill memory-manager.
>
> Nota: la auto-memory personal de Claude (fuera de este repo, en
> `~/.claude/projects/...`) sigue activa a propósito — el usuario pidió
> guardar "en Forge y todo lado", no reemplazar una por la otra. Ambas
> coexisten; esta carpeta es la que viaja con el repo y ven otros
> colaboradores.

## project/ — Proyectos y decisiones activas

- [Fase 2 — Compras + Inventario](project/fase2-compras-inventario.md) — construida, probada y **desplegada a producción el 2026-08-18**
- [Fase 3 — Finanzas](project/fase3-finanzas.md) — **planeada y aprobada el 2026-08-18, sin construir**. Blueprint de 5 fases en la raíz. Destapó que las retenciones reales son 1,914%, no 1,5%
- [Operación: bodegas, tarifas y pagos](project/operacion-bodegas-y-pagos.md) — quién es quién, cuánto cuesta cada canal, pagos por quincena con ajustes manuales, y por qué no se le baja el pago a las bodegas
- [Logística: reglas reales](project/logistica-reglas-reales.md) — corte de Flex a la 1 pm, el desfase de un día entre cuaderno y ML, cómo detectar el canal real, y el bug que hacía desaparecer envíos ya entregados

## feedback/ — Correcciones y preferencias

- [UI en el idioma del negocio](feedback/ui-lenguaje-del-negocio.md) — no exponer conceptos internos del schema (tipos de movimiento) en la UI; no construir features sin confirmar que se usan
- [Confirmaciones deben quedar visibles](feedback/confirmaciones-visibles.md) — no cerrar un panel justo cuando muestra el mensaje de éxito; causó un registro duplicado real
- [Verificar contra la pantalla real](feedback/verificar-contra-la-ui-real.md) — una auditoría "todo bien" falló por comparar la BD contra la API en vez de contra lo que ML le muestra a la usuaria

## reference/ — Dónde encontrar cosas, patrones, soluciones

- [ML: costos reales por pedido](reference/ml-costos-reales-por-pedido.md) — **LEY del proyecto**: nada de promedios. Comisión variable por producto, Flex bonifica en vez de cobrar, de dónde sale cada dato
- [Logística: `status` vs `substatus`](reference/logistica-estado-real-de-despacho.md) — por qué un paquete ya entregado en agencia seguía saliendo como pendiente, y los 16 envíos que nunca entraron al sistema
- [Next.js: 'use server' solo exporta funciones async](reference/nextjs-use-server-solo-funciones.md) — exportar una constante desde ese archivo tira TODOS los exports, no solo la constante
- [Supabase: lista blanca de Redirect URLs](reference/supabase-redirect-url-whitelist.md) — por qué el reset de contraseña caía en /login sin poder cambiar nada
- [Claude Code: conectores de cuenta no se refrescan solos](reference/claude-code-conectores-de-cuenta.md) — Drive activo en claude.ai pero necesita sesión nueva de Claude Code para aparecer

## user/ — Sobre el usuario/equipo

(vacío — ver la memoria personal de Claude para esto, ya tiene perfil de usuario detallado)
