import { QueryClient, QueryFunction } from "@tanstack/react-query";

let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export async function refreshCsrfToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/v2/auth/csrf", { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      csrfToken = json?.data?.csrfToken ?? null;
      return true;
    }
    return false;
  } catch {
    csrfToken = null;
    return false;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = `${res.status}: ${text}`;
    let code: string | undefined;
    let errorField: string | undefined;
    try {
      const json = JSON.parse(text);
      if (json.message) message = json.message;
      if (json.code) code = json.code;
      if (json.error) errorField = json.error;
    } catch {}

    if (res.status === 402 && errorField === 'subscription_required') {
      if (window.location.pathname !== '/billing') {
        window.location.href = '/billing?reason=subscription_required';
      }
    }

    const error = new Error(message) as any;
    error.status = res.status;
    error.code = code;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
  if (data && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (method !== "GET" && csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? (data as FormData) : data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 60000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
