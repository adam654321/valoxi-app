import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import { ShieldX } from "lucide-react";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isSystemAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <ShieldX className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You do not have system administrator privileges to access this area.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
