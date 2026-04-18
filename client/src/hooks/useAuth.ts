import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, refreshCsrfToken } from "@/lib/queryClient";

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
    queryFn: getQueryFn({ on401: "returnNull" }),
    select: (response: any) => response?.data || response,
    retry: false,
  });

  const csrfFetched = useRef(false);
  useEffect(() => {
    if (user && !csrfFetched.current) {
      csrfFetched.current = true;
      refreshCsrfToken();
    }
  }, [user]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSystemAdmin: !!user?.isSystemAdmin,
    error,
  };
}
