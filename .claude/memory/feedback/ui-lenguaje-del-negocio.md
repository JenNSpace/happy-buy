# La UI debe hablar el idioma del negocio, no el del schema

El primer formulario de inventario (Fase 2A) exponía directamente los
conceptos internos del modelo de datos: un dropdown "Conteo inicial /
Entrada / Ajuste" reflejando literalmente los `type` de la tabla
`inventory_movements`. El usuario, dueña del negocio pero no técnica, no
entendía qué significaba "conteo inicial" — lo dijo explícitamente: "Eso
que dice conteo inicial no sé qué significa."

**Por qué:** ella piensa en términos de lo que hace a diario ("registro una
compra que llegó") no en la abstracción que usé para modelarlo en la base
de datos. La forma correcta fue rehacer el formulario como "Nueva compra"
con los campos que ella misma dictó (plataforma, unidades, valor, otros
gastos, fecha estimada) — el modelo interno (`type`, `entrada_compra` vs
`ajuste`) se quedó en el código, invisible para ella.

Lo mismo pasó con "traslado entre bodegas": lo construí como feature sin
preguntar si se usaba. Nunca se había usado en la operación real — "sobra"
fue su respuesta exacta. Se eliminó del código, no solo se ocultó.

**Cómo aplicar:** antes de exponer un concepto interno (un `enum`, un
`type`, una tabla de junction) directamente en una UI para este usuario,
traducirlo a cómo ella describiría la acción en una frase normal. Si no hay
una frase natural equivalente, es señal de que el concepto necesita
reformularse para la pantalla, no solo explicarse con una nota.

Además: no construir una feature (como el traslado) basándose en que "podría
servir" — confirmar primero que la operación real la necesita. Ver también
[[fase2-compras-inventario]] para el caso completo.
