# Un archivo `'use server'` solo puede exportar funciones async

Next.js (App Router, Server Actions) exige que **todo** export de un
archivo marcado con la directiva `'use server'` en la primera línea sea
una función async — cada export se convierte en una referencia de Server
Action. Exportar una constante normal desde ese mismo archivo (por ejemplo
`export const NEW_PRODUCT = '__new__'`) rompe la transformación del módulo
completo.

**Síntoma real observado** (2026-08-15, `src/features/inventario/services/purchase-actions.ts`):
Turbopack reportaba `"The module has no exports at all"` y la página que
importaba ese archivo devolvía 500 — incluso los exports válidos (las
funciones async correctas) dejaban de resolverse. El error persistía tras
limpiar la caché de `.next` y reiniciar el servidor, lo que al principio
hizo parecer un problema de caché en vez de un error real de código.
`tsc --noEmit` tampoco lo detecta — pasa limpio porque a nivel de tipos es
válido, el problema es específico de la transformación de Server Actions.

**Solución:** cualquier constante, tipo auxiliar con valor en runtime, o
utilidad no-async que un archivo `'use server'` necesite compartir con sus
consumidores debe vivir en un archivo aparte sin la directiva (p. ej.
`constants.ts` en la misma feature), importado por ambos lados.

**Cómo detectarlo rápido la próxima vez:** si un archivo `'use server'`
deja de exportar TODO (no solo un símbolo) y el error dice literalmente
"the module has no exports at all", revisar primero si hay algún export
que no sea `async function` — antes de sospechar de la caché de Turbopack.
