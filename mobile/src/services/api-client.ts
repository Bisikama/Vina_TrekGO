type QueryValue = string | number | boolean | null | undefined;

type ApiRequestOptions = {
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor({
    message,
    code = 'UNKNOWN_ERROR',
    status = null,
    retryable = false,
  }: {
    message: string;
    code?: string;
    status?: number | null;
    retryable?: boolean;
  }) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorDetails(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  const message = typeof payload.error.message === 'string' ? payload.error.message : null;
  const code = typeof payload.error.code === 'string' ? payload.error.code : 'HTTP_ERROR';
  const retryable = payload.error.retryable === true;

  return message ? { message, code, retryable } : null;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new ApiClientError({
      code: 'API_URL_MISSING',
      message: 'Chưa cấu hình EXPO_PUBLIC_API_URL cho ứng dụng.',
    });
  }

  const queryString = Object.entries(query ?? {})
    .filter((entry): entry is [string, string | number | boolean] => entry[1] != null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
}

export async function getJson(
  path: string,
  { query, signal }: ApiRequestOptions = {},
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error instanceof ApiClientError || (error instanceof Error && error.name === 'AbortError')) {
      throw error;
    }

    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: 'Không thể kết nối máy chủ. Hãy kiểm tra mock server và địa chỉ API.',
      retryable: true,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError({
      code: 'INVALID_JSON',
      message: 'Máy chủ trả dữ liệu không hợp lệ.',
      status: response.status,
    });
  }

  if (!response.ok) {
    const details = getErrorDetails(payload);
    throw new ApiClientError({
      status: response.status,
      code: details?.code,
      message: details?.message ?? `Yêu cầu thất bại (${response.status}).`,
      retryable: details?.retryable,
    });
  }

  return payload;
}
