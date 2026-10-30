import { Platform } from "react-native";

import {
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
} from "@/features/auth/storage";
import type {
  RefreshTokenResponse,
  StoredAuthState,
} from "@/features/auth/types";

const fallbackApiUrl = Platform.select({
  android: "http://10.0.2.2:3000",
  default: "http://127.0.0.1:3000",
});

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || fallbackApiUrl
).replace(/\/$/, "");

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string | string[];
    details?: unknown;
    retryable?: boolean;
  };
  message?: string | string[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
    readonly retryable?: boolean,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestOptions = RequestInit & {
  accessToken?: string;
  timeoutMs?: number;
  fallbackMessages?: Partial<Record<number, string>>;
};

type AuthStateListener = (state: StoredAuthState | null) => void;

const authStateListeners = new Set<AuthStateListener>();
let refreshPromise: Promise<StoredAuthState> | null = null;

export function subscribeToAuthState(listener: AuthStateListener) {
  authStateListeners.add(listener);
  return () => {
    authStateListeners.delete(listener);
  };
}

function notifyAuthState(state: StoredAuthState | null) {
  authStateListeners.forEach((listener) => listener(state));
}

const defaultMessages: Record<number, string> = {
  400: "Dữ liệu gửi lên không hợp lệ.",
  401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy dữ liệu yêu cầu.",
  409: "Dữ liệu đã thay đổi hoặc bị trùng lặp.",
  422: "Dữ liệu chưa đáp ứng điều kiện xử lý.",
  500: "Máy chủ đang gặp sự cố. Vui lòng thử lại.",
};

function getErrorMessage(
  payload: any,
  status: number,
  fallbackMessages?: Partial<Record<number, string>>,
) {
  const rawMessage = payload?.error?.message ?? payload?.message;

  if (Array.isArray(rawMessage)) {
    return rawMessage.join(", ") || "Dữ liệu không hợp lệ.";
  }

  const details = payload?.error?.details ?? payload?.details;
  if (Array.isArray(details) && details.length > 0) {
    const detailMsgs = details
      .map((d: any) => {
        if (typeof d === "string") return d;
        if (d?.field && d?.message) return `${d.field}: ${d.message}`;
        return d?.message || d?.field || d?.code || JSON.stringify(d);
      })
      .filter(Boolean);
    if (detailMsgs.length > 0) return detailMsgs.join(", ");
  }

  if (rawMessage && typeof rawMessage === "string") return rawMessage;

  return (
    fallbackMessages?.[status] ??
    defaultMessages[status] ??
    "Yêu cầu chưa thể hoàn tất. Vui lòng thử lại."
  );
}

async function parseResponse<T>(
  response: Response,
  fallbackMessages?: Partial<Record<number, string>>,
): Promise<T> {
  const text = await response.text();
  let payload: T | ApiErrorEnvelope | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as T | ApiErrorEnvelope;
    } catch {
      throw new ApiError(
        "TrekGo API trả về dữ liệu không hợp lệ.",
        response.status,
      );
    }
  }

  if (!response.ok) {
    const errorPayload = payload as any;
    const errorCode =
      errorPayload?.error?.code ??
      errorPayload?.code ??
      errorPayload?.details?.code ??
      (typeof errorPayload?.error === "string" && errorPayload?.error !== "Bad Request"
        ? errorPayload?.error
        : undefined);
    const errorDetails = errorPayload?.error?.details ?? errorPayload?.details;

    throw new ApiError(
      getErrorMessage(errorPayload, response.status, fallbackMessages),
      response.status,
      errorCode,
      errorDetails,
      errorPayload?.error?.retryable ?? errorPayload?.retryable,
    );
  }

  return payload as T;
}

async function refreshStoredSession(): Promise<StoredAuthState> {
  const stored = await readStoredAuth();

  if (!stored?.refreshToken) {
    await clearStoredAuth();
    notifyAuthState(null);
    throw new ApiError("Phiên đăng nhập đã hết hạn.", 401);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
      signal: controller.signal,
    });
    const refreshed = await parseResponse<RefreshTokenResponse>(response);
    const renewed: StoredAuthState = { ...stored, ...refreshed };

    await writeStoredAuth(renewed);
    notifyAuthState(renewed);
    return renewed;
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 400 || error.status === 401 || error.status === 403)
    ) {
      await clearStoredAuth();
      notifyAuthState(null);
    }

    if (error instanceof ApiError) throw error;

    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new ApiError(
      timedOut
        ? "API làm mới phiên đăng nhập phản hồi quá lâu."
        : `Không kết nối được TrekGo API tại ${API_BASE_URL}.`,
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function refreshSessionOnce(): Promise<StoredAuthState> {
  if (!refreshPromise) {
    refreshPromise = refreshStoredSession().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    accessToken,
    timeoutMs = 15_000,
    fallbackMessages,
    headers,
    ...requestOptions
  } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const baseHeaders = new Headers(headers);

  if (!baseHeaders.has("Accept")) {
    baseHeaders.set("Accept", "application/json");
  }

  const isFormData =
    typeof FormData !== "undefined" && requestOptions.body instanceof FormData;

  if (requestOptions.body && !isFormData && !baseHeaders.has("Content-Type")) {
    baseHeaders.set("Content-Type", "application/json");
  }

  const sendRequest = async (token?: string) => {
    const requestHeaders = new Headers(baseHeaders);

    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }

    return fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers: requestHeaders,
      signal: controller.signal,
    });
  };

  try {
    const stored = await readStoredAuth();
    const currentAccessToken = accessToken ?? stored?.accessToken;
    let response = await sendRequest(currentAccessToken);

    if (response.status === 401 && currentAccessToken) {
      const renewed = await refreshSessionOnce();
      response = await sendRequest(renewed.accessToken);
    }

    return await parseResponse<T>(response, fallbackMessages);
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new ApiError(
      timedOut
        ? "API phản hồi quá lâu. Vui lòng thử lại."
        : `Không kết nối được TrekGo API tại ${API_BASE_URL}.`,
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}
