import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, size = "md", className }: EmptyStateProps) {
  const padding = { sm: "py-4", md: "py-8", lg: "py-12" }[size];
  return (
    <div className={cn("flex flex-col items-center justify-center text-center text-muted-foreground", padding, className)}>
      <Icon className="w-10 h-10 mb-3 opacity-40" />
      <p className={cn("font-medium", description ? "mb-1" : "")}>{title}</p>
      {description && <p className="text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
