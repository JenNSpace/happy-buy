# Reset de contraseña roto: la URL de redirect no está en la lista blanca de Supabase Auth

**Síntoma real** (2026-08-15, reportado por la propia dueña de la cuenta
admin sobre `https://happy-buy-topaz.vercel.app`): al pedir "olvidé mi
contraseña", el correo llega, pero el link abre `/login` con
`#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`
en vez de la pantalla para poner una contraseña nueva.

**Diagnóstico** (vía `mcp__supabase__query_logs` sobre `auth_logs`, no
adivinado): el primer click en el link SÍ es válido — Supabase lo registra
como `action: "login"`, `GET /verify` → 303 — pero redirige a la URL
equivocada. `resetPasswordForEmail` en `src/actions/auth.ts` pide
`redirectTo: \`\${NEXT_PUBLIC_SITE_URL}/update-password\``, pero Supabase
solo respeta ese `redirectTo` si la URL exacta está en **Authentication →
URL Configuration → Redirect URLs** del dashboard. Si no está, cae en
silencio al Site URL por defecto — que no tiene el código que lee el hash
de recuperación (`UpdatePasswordForm.tsx`), así que el usuario ve un login
normal sin poder cambiar nada. El segundo click en el mismo link (por
confusión, ya que el primero "no pareció funcionar") sí devuelve
`otp_expired` real, porque el token de un solo uso ya se consumió en el
primer click.

**Fix real, aplicado por el usuario, no por Claude** (Claude no tiene
sesión del dashboard de Supabase en este entorno): agregar
`https://happy-buy-topaz.vercel.app/update-password` a Redirect URLs.

**Mientras tanto**, desbloqueo inmediato de una cuenta afectada:
`supabase.auth.admin.updateUserById(userId, {password})` con el service
role key — mismo patrón ya usado para desbloquear a Enrique en la sesión
de Fase 1 (ver el bug distinto pero relacionado, "Auth session missing!",
en la memoria personal de Claude).

**Nota para no repetir el error de raíz:** esto es un problema DISTINTO del
que se arregló antes ("Auth session missing!" por no leer el hash de
`window.location.hash`) — ese fix sigue siendo correcto y necesario, pero
no alcanza si el link ni siquiera llega a `/update-password` en primer
lugar. Verificar la lista blanca de Redirect URLs antes de asumir que el
flujo de recuperación funciona de punta a punta.
