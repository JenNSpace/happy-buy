import { NextResponse } from 'next/server'
import { syncMpMovements } from '@/features/finanzas/services/sync-mp-movements'

export const dynamic = 'force-dynamic'

/**
 * Corre una vez al día (ver vercel.json). Trae del Reporte de Liberaciones de
 * Mercado Pago la plata que salió — retiros al banco, compras pagadas desde MP
 * y lo que cobra ML por adelantar el dinero.
 *
 * Diario y no más seguido porque cada corrida deja un archivo de reporte en la
 * cuenta de Mercado Pago, y porque el propio reporte va un par de días atrasado:
 * pedirlo cada hora no traería nada nuevo.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncMpMovements()
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
