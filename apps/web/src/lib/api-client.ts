const API_URL =
  process.env.NODE_ENV === "production"
    ? "/api/v1"
    : process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000/api/v1";

interface ProblemDetails {
  title?: string;
  detail?: string;
  code?: string;
  status?: number;
  errors?: Array<{ field: string; code: string; message: string }>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: ProblemDetails["errors"];

  constructor(problem: ProblemDetails, status: number) {
    super(problem.detail ?? problem.title ?? "The request could not be completed.");
    this.name = "ApiError";
    this.status = status;
    this.code = problem.code ?? "REQUEST_FAILED";
    this.errors = problem.errors;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function isUnsafe(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

async function parseError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails = {};
  try {
    problem = (await response.json()) as ProblemDetails;
  } catch {
    problem = { detail: "The server returned an unexpected response." };
  }
  return new ApiError(problem, response.status);
}

async function request<T>(path: string, init: RequestInit = {}, mayRefresh = true): Promise<T> {
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (isUnsafe(method)) {
    const csrf = readCookie("lifetracker_csrf");
    if (csrf) headers.set("X-CSRF-Token", decodeURIComponent(csrf));
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const refreshIneligible = ["/auth/login", "/auth/register", "/auth/refresh"].includes(path);
  if (response.status === 401 && mayRefresh && !refreshIneligible) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRF-Token": decodeURIComponent(readCookie("lifetracker_csrf") ?? ""),
      },
    });
    if (refreshed.ok) return request<T>(path, init, false);
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiClient = {
  get<T>(path: string) {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  put<T>(path: string, body: unknown) {
    return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  },
  patch<T>(path: string, body: unknown) {
    return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: "DELETE" });
  },
};
