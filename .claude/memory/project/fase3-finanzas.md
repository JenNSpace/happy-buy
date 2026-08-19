# Fase 3 — Finanzas

**Estado al 2026-08-19: LAS 5 FASES CONSTRUIDAS, COMMITEADAS Y DESPLEGADAS a producción.**
Verificado por Jen en producción. 7 commits, uno por fase.

Lo que funciona: tabla `ml_payments` con 1.441 pagos · motor de costos leyendo el neto real de
ML · tab `/finanzas` con hero de caja, flujo de liberaciones, P&L de 4 meses, tarjetas con cupo
y registro de gastos. Tablas nuevas: `ml_payments`, `expenses`; `payment_methods` extendida con
`kind`/`credit_limit`/`statement_day`/`due_day`.

**Pendiente:** el pase de `design-critic` sobre todo el dashboard, que Jen quería hacer al final
con todo construido.

**Verificación externa que sí ocurrió:** Jen confirmó contra su propia pantalla de ML que la
venta del 18-ago de $56.000 deposita $48.488,16 el 8 de septiembre. Además mandó dos capturas
más que resultaron decisivas — tres ventas idénticas de $56.000 el mismo día con netos de
$49.560, $48.488,16 y $41.460. Es [[ley-datos-por-pedido]] demostrada en vivo.

**Pedido explícito de Jen (2026-08-18): OPTIMIZAR PARA CELULAR al final**, junto con el pase de
`design-critic`, cuando ya esté todo construido. No es un "estaría bueno" — lo pidió aparte y
pidió que quedara anotado. Aplica a **toda la app**, no solo a Finanzas.

Ya apareció un caso real de esto: el botón "Eliminar" de la lista de gastos se mostraba solo con
`group-hover`, o sea que en táctil era inalcanzable. Se corrigió (visible siempre + confirmación
en dos pasos inline). **Buscar el mismo patrón en el resto de la app** — cualquier acción que
dependa de hover está rota en celular. Otros sospechosos a revisar: la tabla de P&L (scroll
horizontal), el `MiniBarChart` (tooltip por hover) y las tarjetas de deuda en una columna.

**Tres correcciones que costaron caro y no deben repetirse** (detalle en
`.claude/PRPs/PIEZA-finanzas.md`, sección Auto-Blindaje):
1. `/v1/payments/search` mezcla lo que la cuenta COBRA con lo que PAGA. Sin filtrar por
   `collector_id = 131725890`, 5 compras personales de Jen aparecieron como "$587.071 retenidos
   por ML". **Lo detectó ella preguntando de dónde salía el número.**
2. `bruto − Σcargos = neto` NO se cumple (falla en ~21%). `net_received_amount` es la única
   autoridad; el desglose es informativo.
3. Se afirmó que la ganancia bajaría. **Sube ~$400.735/año**: el 40% de las ventas no paga
   retención y el modelo viejo se la cobraba a todas.

**Hallazgo útil para el P&L:** la factura mensual de ML trae CV (comisión) + CXD (envíos) +
PADS (publicidad), pero CV y CXD **ya vienen descontados de cada pago**. Lo que Jen paga de
factura es solo el PADS — verificado: julio $175.524 en ambos lados. Sumar la factura al P&L
habría contado la comisión dos veces. `getMonthlyAds` usa solo PADS, agrupado por
`creation_date_time` porque los periodos de facturación van del 26 al 25, no por mes.

Documentos en la raíz del repo (leerlos antes de construir, no repetir la planeación):
- `TECH-SPEC-finanzas.md`
- `docs/ui-design/screen-flows/finanzas.md`
- `BLUEPRINT-finanzas.md` ← 5 fases, tareas y checklists

## Lo que hay que saber sin abrir los documentos

**El hallazgo que define la fase:** `api.mercadopago.com` responde con el mismo token de ML
que ya está en `ml_tokens`. Los mismos paths contra `api.mercadolibre.com` dan 403, lo que
hacía parecer que faltaban permisos. **No hay que autorizar nada.** Da `money_release_date`,
`net_received_amount` y el desglose exacto de cargos.

**Bug real que esto destapó:** `TAX_WITHHOLDING_RATE` (1,5% plano) en
`src/features/dashboard/constants.ts` está mal, pero **no por lo que parecía**. Hay más
retenciones de las que se creía (fuente, ICA Bogotá, ICA Medellín, IVA, inscription_iva), pero
sobre todo: **4 de cada 10 ventas no pagan retención** y el modelo viejo se la cobraba a todas.

**Medido sobre 1.209 ventas reales (2026-08-18):** retención real $1.063.362 vs. $1.464.097
estimados → **la ganancia SUBE $400.735 al año**. Últimos meses: may +$33.684 · jun +$16.456 ·
jul +$6.390 · ago +$28.604.

⚠️ Durante la planeación se le dijo a Jen dos veces que la ganancia BAJARÍA — deducido de que
faltaba el ICA, sin medir la distribución. Era falso y está corregido en todos los documentos.
El banner ahora dice que sube.

## Decisiones tomadas (no re-litigar)

- Alcance completo: P&L mensual + flujo de caja + deudas/tarjetas (con cupo y día de corte) +
  gastos. La corrección del motor de costos va **dentro** de esta fase, no en una aparte.
- Gastos fijos reales del negocio: **solo empaques e insumos**. No hay arriendo, software ni
  contador que registrar — confirmado con Jen.
- Sin Security Audit formal; en su lugar la regla dura de que `/finanzas` es admin-only
  (ya previsto en `AppNav.tsx`, `enabled: false`).
- Orden: la corrección del motor va **antes** que la tab, aunque sea lo más riesgoso, para no
  construir Finanzas sobre números que ya sabemos malos.
- Una sola página scrolleable con 5 secciones, no sub-tabs.

## Pendiente de verificación externa

Antes de dar por buena la Fase 1: **Jen confirma contra su cuenta de ML** que la venta del
18-ago de $56.000 deposita **$48.488,16 el 8 de septiembre**. Este proyecto ya falló dos veces
por validar contra consistencia interna en vez de la pantalla real.
