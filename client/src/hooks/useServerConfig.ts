import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export interface ServerConfig {
  clerkEnabled: boolean;
}

export function useServerConfig() {
  const { data, isLoading, error } = useQuery<ServerConfig | null>({
    queryKey: ["/api/v2/public/config"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    select: (response: any) => response?.data ?? response,
    staleTime: Infinity,
    retry: 1,
  });

  return {
    config: data ?? null,
    clerkEnabled: data?.clerkEnabled ?? false,
    isLoading,
    error,
  };
}
