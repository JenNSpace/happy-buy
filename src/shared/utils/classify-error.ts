/**
 * `mlGet`/`mlGetBinary` (src/features/dashboard/services/ml-client.ts) always
 * throw with a message starting "ML API " on a non-2xx response — used here
 * to tell the user whether a failure is Mercado Libre's problem or ours,
 * since a raw stack trace doesn't answer that question for them.
 */
export function isMlApiError(error: Error): boolean {
  return error.message.startsWith('ML API')
}

export function friendlyErrorMessage(error: Error): { title: string; body: string } {
  if (isMlApiError(error)) {
    return {
      title: 'Mercado Libre no respondió',
      body: 'Es un problema temporal del lado de Mercado Libre, no de la app. Intenta recargar en unos minutos.',
    }
  }

  return {
    title: 'Algo falló',
    body: 'Parece un problema técnico de la app. Si sigue pasando, avísale a Jen.',
  }
}
