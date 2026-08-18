# Mercado Libre: los costos se leen por pedido, nunca por promedio

**Regla del proyecto (LEY, declarada por la usuaria 2026-08-18):** todo dato
financiero sale de la venta individual. Nunca un promedio, un porcentaje fijo
ni una suposición. Verificado contra facturas reales de ML, no asumido.

## Qué estaba mal y qué es lo cierto

| Concepto | Suposición vieja | Realidad verificada |
|---|---|---|
| Comisión | 11,5% plano | Sal Céltica 11,5% · **Multitoma 16%** · **Cable Ugreen 18,5%** |
| Envío Flex | se restaban ~$8.900 | ML **no cobra**, paga bonificación **+$980/+$990** |
| Envío agencia | promedio $8.460 | Cobro real distinto por pedido: $8.000 / $8.100 / $8.500 |
| Envío/despacho | por unidad | **Una vez por paquete** |
| Costo producto | $34.082 para todo | Promedio real por producto desde `purchases` |

## De dónde sale cada dato

- **Comisión:** `order_items[].sale_fee` (por unidad) o `payments[].marketplace_fee`
  (por pedido). Ambos coincidieron al peso con las facturas.
- **Envío:** `/shipments/{id}`. Agencia = `shipping_option.list_cost`.
  Flex = bonificación de `base_cost − list_cost` (va en negativo, es ingreso).
- **Tipo de despacho:** `logistic_type` (`self_service` = Flex,
  `xd_drop_off` = agencia, `fulfillment` = Full).
- **Costo del producto:** promedio ponderado de `purchases` por `product_id`.
- **Retenciones:** **ninguna API las expone** (`payments[].taxes_amount` da 0 y
  el libro de facturación solo trae CV/CXD/PADS). Son retenciones de Mercado
  Pago sobre el pago. Se estiman al 1,5% y **se rotulan como estimado** en la UI.

## Trampas confirmadas

- **"Venta por publicidad" en un pedido NO muestra el costo del anuncio.** Esa
  etiqueta solo dice que ML atribuye la venta a un clic. La publicidad se
  factura aparte por campaña.
- **Publicidad y ventas deben leerse en la MISMA ventana.** Pedir 7 días
  rodantes de ads contra una semana calendario de ventas hacía ver una semana
  rentable como pérdida. Ver `getCurrentWeekRange()`.
- **Periodos de facturación de ML corren del 26 al 25**, no calzan con semanas
  ni quincenas.
- El gráfico de 90 días **sigue estimando el envío** a propósito (traerlo real
  serían cientos de llamadas). La tarjeta semanal es la cifra exacta, y el
  código lo dice.

Relacionado: `logistica-estado-real-de-despacho.md`
