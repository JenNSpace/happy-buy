/**
 * Tokens de superficie del dashboard — el "look" que Jen pidió el 2026-08-21
 * ("algo moderno tipo Apple"), primero en la tabla de stock y después en
 * logística. Viven acá para que las dos pantallas no se separen con el tiempo.
 *
 * Reglas que estos tokens codifican:
 * - Tarjeta = esquina grande + hairline + sombra difusa. Nunca `border-2`.
 * - Etiquetas de categoría = píldora redonda, no barra de color de ancho completo.
 * - Separadores = negro translúcido, NO un gris sólido: sobre un fondo tintado
 *   (columna de bodega, tarjeta de canal) `border-gray-100` desaparece.
 * - Números = `tabular-nums`, o las columnas no alinean.
 */

export const SURFACE_SHADOW = 'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-14px_rgba(16,24,40,0.18)]'

/** Tarjeta estándar. */
export const SURFACE_CARD = `rounded-2xl bg-white ring-1 ring-gray-900/[0.06] ${SURFACE_SHADOW}`

/**
 * Igual, pero sin color de anillo: quien la use DEBE aportar su propio
 * `ring-<color>`. Separado a propósito — dos clases `ring-*` en la misma cadena
 * pelean por `--tw-ring-color` y gana la que esté después en el CSS generado,
 * no la que escribas al final.
 */
export const SURFACE_CARD_RINGLESS = `rounded-2xl bg-white ring-1 ${SURFACE_SHADOW}`

/**
 * Bordes por lado a propósito. `border-gray-200` junto a `border-gray-100` en la
 * misma cadena pinta los cuatro lados dos veces y el resultado depende del orden
 * del CSS, no del atributo.
 */
export const HAIRLINE_T = 'border-t border-t-gray-900/[0.07]'
export const HAIRLINE_B = 'border-b border-b-gray-900/[0.07]'
export const HAIRLINE_L = 'border-l border-l-gray-900/[0.06]'

/** Píldora de categoría. El color de fondo/texto lo pone quien la usa. */
export const PILL = 'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]'

/** Rótulo pequeño encima de un dato ("POR ENVIAR", "PRODUCTO"). */
export const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400'

/** Barra de scroll fina — la del navegador se come el ancho de la columna. */
export const SCROLL_THIN =
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-900/15 hover:[&::-webkit-scrollbar-thumb]:bg-gray-900/25'

/** Input / select. */
export const FIELD =
  'rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-happy-green focus:outline-none focus:ring-1 focus:ring-happy-green disabled:opacity-50'

/** Botón secundario (contorno). */
export const BUTTON_GHOST =
  'rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50'

/** Botón primario. */
export const BUTTON_PRIMARY =
  'rounded-xl bg-happy-green px-3 py-2 text-sm font-medium text-white hover:bg-happy-greenDark disabled:opacity-50'
