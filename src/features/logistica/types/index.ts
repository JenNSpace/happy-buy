import type { DispatchState, FulfillmentType } from '../services/parse-shipment'

export interface PendingShipmentItem {
  itemId: string
  title: string
  quantity: number
}

export interface PendingShipment {
  shipmentId: number
  orderId: number
  dateCreated: string
  deadline: string | null
  fulfillmentType: FulfillmentType
  printed: boolean
  buyerNickname: string
  items: PendingShipmentItem[]
  warehouseId: string | null
  deliveredAt: string | null
  /** 'unknown' = ML returned a substatus we can't classify; show it, flag it. */
  dispatchState: DispatchState
  /** ML's own verdict ('on_time' | 'delayed'); null when ML didn't answer. */
  slaStatus: string | null
}

export interface BodegaShipmentItem {
  itemId: string
  description: string
  quantity: number
}

export interface BodegaShipment {
  shipmentId: number
  /** Cuándo entró la venta — la hora es lo que permite cuadrar contra el cuaderno de la bodega. */
  dateCreated: string
  items: BodegaShipmentItem[]
  address: string
  deadline: string | null
  fulfillmentType: FulfillmentType
  printed: boolean
  dispatchState: DispatchState
  /** ML's own verdict ('on_time' | 'delayed'); null when ML didn't answer. */
  slaStatus: string | null
}
