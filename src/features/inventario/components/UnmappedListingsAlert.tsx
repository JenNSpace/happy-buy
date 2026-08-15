import type { UnmappedListing } from '../services/discover-listings'

export function UnmappedListingsAlert({ listings }: { listings: UnmappedListing[] }) {
  if (listings.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-800">
        {listings.length} publicación{listings.length === 1 ? '' : 'es'} sin mapear a un producto
      </p>
      <p className="mt-1 text-xs text-amber-700">
        Sus ventas no descuentan inventario todavía. Avísame el id y a qué producto pertenece para agregarla.
      </p>
      <ul className="mt-2 space-y-1">
        {listings.map((l) => (
          <li key={l.mlItemId} className="text-xs text-amber-800">
            <span className="font-mono">{l.mlItemId}</span> — {l.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
