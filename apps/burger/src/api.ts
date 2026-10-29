const API_BASE = '/api'

type ApiErrorBody = { message?: string; error?: string }

export async function apiRequest<T>(route: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${route}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  })

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const details = body && typeof body === 'object' ? body as ApiErrorBody : {}
    throw new Error(details.message || `Não foi possível concluir a operação (HTTP ${response.status}).`)
  }

  return body as T
}
