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
  betaNdaSigned?: boolean;
  company?: {
    id: number;
    companyName: string;
  };
  viewingAs?: {
    userId: number;
    companyId: number;
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
