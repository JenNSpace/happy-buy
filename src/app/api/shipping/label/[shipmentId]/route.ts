import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mlGetBinary } from '@/features/dashboard/services/ml-client'

export const dynamic = 'force-dynamic'

/**
 * Streams the ML shipping label PDF to the browser. Never expose the ML
 * access token client-side, so this always goes through the server. Access
 * control is just an RLS-gated read of `shipments` — bodega can only see
 * shipments in their own warehouse, admins see all.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ shipmentId: string }> }
) {
  const { shipmentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: shipment, error } = await supabase
    .from('shipments')
    .select('id')
    .eq('id', shipmentId)
    .single()

  if (error || !shipment) {
    return NextResponse.json({ error: 'Guía no encontrada o sin acceso' }, { status: 404 })
  }

  const pdf = await mlGetBinary(`/shipment_labels?shipment_ids=${shipmentId}&response_type=pdf`)

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="guia-${shipmentId}.pdf"`,
    },
  })
}
