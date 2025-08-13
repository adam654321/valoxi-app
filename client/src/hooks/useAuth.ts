import { useQuery } from "@tanstack/react-query";

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  company?: {
    id: number;
    companyName: string;
  };
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
