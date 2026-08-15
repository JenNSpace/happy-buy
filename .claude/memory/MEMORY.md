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

- [Fase 2 — Compras + Inventario](project/fase2-compras-inventario.md) — construida y probada en vivo al 2026-08-15, NO desplegada a producción; qué falta (import del sheet de Enrique, deploy, Fase 2C/2D)

## feedback/ — Correcciones y preferencias

- [UI en el idioma del negocio](feedback/ui-lenguaje-del-negocio.md) — no exponer conceptos internos del schema (tipos de movimiento) en la UI; no construir features sin confirmar que se usan
- [Confirmaciones deben quedar visibles](feedback/confirmaciones-visibles.md) — no cerrar un panel justo cuando muestra el mensaje de éxito; causó un registro duplicado real

## reference/ — Dónde encontrar cosas, patrones, soluciones

- [Next.js: 'use server' solo exporta funciones async](reference/nextjs-use-server-solo-funciones.md) — exportar una constante desde ese archivo tira TODOS los exports, no solo la constante
- [Supabase: lista blanca de Redirect URLs](reference/supabase-redirect-url-whitelist.md) — por qué el reset de contraseña caía en /login sin poder cambiar nada
- [Claude Code: conectores de cuenta no se refrescan solos](reference/claude-code-conectores-de-cuenta.md) — Drive activo en claude.ai pero necesita sesión nueva de Claude Code para aparecer

## user/ — Sobre el usuario/equipo

(vacío — ver la memoria personal de Claude para esto, ya tiene perfil de usuario detallado)
