# Verificar contra la pantalla real, no contra la consistencia interna

## Qué pasó

El 2026-08-18 hice una "auditoría completa" de logística y concluí que todo
funcionaba. Comparé la base de datos contra el campo `status` de la API de ML,
no encontré contradicciones, y lo reporté como correcto.

La usuaria respondió: *"ESE CABLE UGREEN NO ESTA PARA DESPACHAR, YA SE ENTREGO
ESTA EN TRANSITO, Y AUN APARECE EN EL DASHBOARD, ENTONCES QUE FUE LO QUE
REVISASTE QUE ESTABA TODO BIEN?"*

Tenía razón. El sistema era internamente consistente **y aun así estaba mal**,
porque el campo en el que basé la verificación no significaba lo que asumí.

## La regla

Cuando la usuaria pida verificar que algo "está bien", **la prueba es lo que
ella ve en la pantalla del proveedor**, no que nuestros datos concuerden entre
sí. Consistencia interna solo demuestra que dos fuentes coinciden — si ambas
salen de la misma suposición equivocada, coinciden perfectamente en el error.

**Cómo aplicarlo:**
1. Pide o busca la pantalla real (ella manda capturas sin problema, y son oro).
2. Compara caso por caso, no en agregado. Un total puede cuadrar por
   compensación mientras cada línea está mal.
3. Si un campo "parece" el correcto, busca uno que **contradiga** la
   suposición antes de confiar. Aquí `status` era idéntico en ambos casos y
   `substatus` era el que separaba.

## Ya había pasado antes

Es la misma lección que `reference/` guarda sobre no confiar en un campo de ML
solo porque suena plausible (el caso del `/sla` que daba 23:00 cuando la UI
mostraba 21:00). Van dos veces. La versión corta: **la API describe, la UI
decide.**

## Lo que sí funcionó

Verificar los números contra las facturas reales de ML antes de escribir el
modelo de costos. Ahí encontré 4 errores (comisión no plana, bonificación Flex,
costos por unidad vs por paquete, ventanas de tiempo distintas) que ninguna
revisión de código habría detectado.
