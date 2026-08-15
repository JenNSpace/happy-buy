export function ProductThumbnail({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return <div className="h-9 w-9 shrink-0 rounded-md border border-gray-200 bg-gray-50" aria-hidden />
  }
  // eslint-disable-next-line @next/next/no-img-element -- foto externa de ML, no vale la pena configurar remotePatterns para thumbnails de 9x9
  return <img src={src} alt={alt} loading="lazy" className="h-9 w-9 shrink-0 rounded-md border border-gray-200 object-cover" />
}
