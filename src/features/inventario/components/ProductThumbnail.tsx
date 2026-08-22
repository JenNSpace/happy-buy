/**
 * `soft` es la variante redondeada que usa la tabla de stock; `default` es la
 * que ya usaban los formularios y el listado de compras — no las cambies sin
 * mirar los otros call sites.
 */
const VARIANTS = {
  default: 'h-9 w-9 shrink-0 rounded-md border border-gray-200',
  soft: 'h-10 w-10 shrink-0 rounded-xl ring-1 ring-gray-900/10',
} as const

export function ProductThumbnail({
  src,
  alt,
  variant = 'default',
}: {
  src?: string
  alt: string
  variant?: keyof typeof VARIANTS
}) {
  const shape = VARIANTS[variant]

  if (!src) {
    return <div className={`${shape} bg-gray-100`} aria-hidden />
  }
  // eslint-disable-next-line @next/next/no-img-element -- foto externa de ML, no vale la pena configurar remotePatterns para thumbnails de 9x9
  return <img src={src} alt={alt} loading="lazy" className={`${shape} object-cover`} />
}
