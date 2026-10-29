export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type ErrorPayload = { error?: string; message?: string }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {}),
    },
    credentials: 'same-origin',
  })
  const payload = await response.json().catch(() => ({})) as ErrorPayload
  if (!response.ok) throw new ApiError(payload.message || payload.error || 'Não foi possível concluir a operação.', response.status, payload.error || '')
  return payload as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}
