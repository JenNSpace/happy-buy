# No cerrar un panel/formulario justo cuando muestra la confirmación

En el formulario de "marcar compra como recibida" (Fase 2B), el panel se
cerraba automáticamente (`onDone?.()`) apenas la acción tenía éxito. El
mensaje "Compra marcada como recibida — el stock ya se actualizó" se
alcanzaba a ver una fracción de segundo antes de que el panel desapareciera.

**Consecuencia real, no teórica:** el usuario no tuvo forma clara de
confirmar que la primera vez sí había funcionado, así que registró la
misma entrada de 100 unidades una segunda vez por otra vía (ajuste manual)
— terminó con 200 unidades en el sistema cuando llegaron 100. Se corrigió
el dato real en la base de datos y el código: ahora el panel de "recibir"
se queda abierto después de confirmar, hasta que el usuario lo cierra a
mano.

**Cómo aplicar:** en cualquier acción que cambie un estado importante
(inventario, dinero, algo que no se deshace fácil), la confirmación de
éxito debe quedar visible el tiempo que el usuario necesite para leerla —
no asumir que un mensaje que se muestra y desaparece en el mismo render es
suficiente. Cuando haya duda, no cerrar el panel automáticamente; dejar que
el usuario lo cierre.
