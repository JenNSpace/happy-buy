/**
 * Plural español para las palabras de unidad que realmente usamos:
 * bolsa→bolsas, unidad→unidades, caja→cajas, pack→packs.
 *
 * Vivía privado dentro de logistica/utils/product-name.ts. Inventario lo
 * necesitaba también y no puede importar de logistica (logistica ya importa de
 * inventario — sería un ciclo), así que subió a shared.
 */
export function pluralize(word: string, count: number): string {
  if (count === 1) return word
  return /[aeiou]$/i.test(word) ? `${word}s` : `${word}es`
}

/** Solo la forma plural, para encabezados y captions donde no hay conteo. */
export const plural = (word: string) => pluralize(word, 2)
