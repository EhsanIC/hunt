const apiUrl = process.env.NEXT_PUBLIC_API_URL

if (!apiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is not configured")
}

const baseUrl = apiUrl.replace(/\/$/, "")

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    const message =
      typeof body === "object" && body !== null && "detail" in body
        ? String(body.detail)
        : `Request failed with status ${status}`
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  } catch {
    throw new Error(
      "Unable to reach the backend. Make sure the FastAPI server is running.",
    )
  }

  const text = await response.text()
  const body = text ? parseResponseBody(text) : undefined

  if (!response.ok) {
    throw new ApiError(response.status, body)
  }

  return body as T
}

function parseResponseBody(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" })
}
