import type { DispatchState, FulfillmentType } from '../services/parse-shipment'

export interface PendingShipmentItem {
  itemId: string
  title: string
  quantity: number
  sku: string | null
  attributes: string | null
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
}

export interface BodegaShipmentItem {
  itemId: string
  description: string
  quantity: number
}

export interface BodegaShipment {
  shipmentId: number
  items: BodegaShipmentItem[]
  address: string
  deadline: string | null
  fulfillmentType: FulfillmentType
  printed: boolean
  dispatchState: DispatchState
}
