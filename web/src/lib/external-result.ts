export type ExternalResult<T> = { status: "available"; data: T } | { status: "unavailable"; data: null };

export async function readExternalResult<T>(response: Response): Promise<ExternalResult<T>> {
  if (!response.ok) return { status: "unavailable", data: null };
  try {
    return { status: "available", data: await response.json() as T };
  } catch {
    return { status: "unavailable", data: null };
  }
}
