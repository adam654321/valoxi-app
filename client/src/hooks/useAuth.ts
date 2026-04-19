import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { refreshCsrfToken } from "@/lib/queryClient";

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isSystemAdmin?: boolean;
  onboardingCompleted?: boolean;
  permissions?: Record<string, boolean> | null;
  company?: {
    id: number;
    companyName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    industry?: string | null;
    companySize?: string | null;
    country?: string | null;
  };
  viewingAs?: {
    userId: number;
    name: string;
    companyName: string | null;
  } | null;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/v2/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/v2/auth/me", { credentials: "include" });
      if (res.ok) {
        return await res.json();
      }
      const text = await res.text();
      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch {}
      if (
        parsed.error === "CLERK_USER_NOT_LINKED" ||
        parsed.error === "CLERK_USER_INACTIVE"
      ) {
        const err = new Error(parsed.message || "Authentication error") as any;
        err.status = res.status;
        err.code = parsed.error;
        throw err;
      }
      if (res.status === 401) {
        return null;
      }
      const err = new Error(
        parsed.message || `${res.status}: ${res.statusText}`
      ) as any;
      err.status = res.status;
      throw err;
    },
    select: (response: any) => response?.data || response,
    retry: (failureCount, error) =>
      (error as any)?.code === "CLERK_USER_NOT_LINKED" && failureCount < 4,
    retryDelay: (attempt) => ([1000, 2000, 3000, 4000][attempt] ?? 4000),
  });

  const csrfFetched = useRef(false);
  useEffect(() => {
    if (user && !csrfFetched.current) {
      csrfFetched.current = true;
      refreshCsrfToken();
    }
  }, [user]);

  const authError: "CLERK_USER_NOT_LINKED" | "CLERK_USER_INACTIVE" | null =
    (error as any)?.code === "CLERK_USER_NOT_LINKED"
      ? "CLERK_USER_NOT_LINKED"
      : (error as any)?.code === "CLERK_USER_INACTIVE"
      ? "CLERK_USER_INACTIVE"
      : null;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSystemAdmin: !!user?.isSystemAdmin,
    error,
    authError,
  };
}
