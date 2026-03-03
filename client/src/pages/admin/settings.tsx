import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ShieldCheck, Globe } from "lucide-react";

interface ConfigRow {
  key: string;
  value: string;
}

export default function AdminSettings() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success: boolean; data: ConfigRow[] }>({
    queryKey: ["/api/v2/admin/system-config"],
  });

  const configs = data?.data ?? [];
  const currentMode = configs.find((c) => c.key === "registration_mode")?.value ?? "invite_only";

  const mutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest("POST", "/api/v2/admin/system-config", {
        key: "registration_mode",
        value,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings updated", description: "Registration mode has been changed." });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/system-config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update settings",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const options = [
    {
      value: "invite_only",
      label: "Invite Only",
      description: "Users must have a valid invitation code to register",
      icon: ShieldCheck,
    },
    {
      value: "open",
      label: "Open",
      description: "Anyone can register (requires payment via Stripe)",
      icon: Globe,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure system-wide platform settings.</p>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Registration Mode</h2>
          <p className="text-sm text-muted-foreground mt-1">Control how new users can register on the platform.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map((option) => {
              const isSelected = currentMode === option.value;
              return (
                <Card
                  key={option.value}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "hover:border-muted-foreground/30"
                  } ${mutation.isPending ? "opacity-60 pointer-events-none" : ""}`}
                  onClick={() => {
                    if (!isSelected && !mutation.isPending) {
                      mutation.mutate(option.value);
                    }
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                        <option.icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{option.label}</span>
                          {isSelected && (
                            <Badge variant="default" className="text-xs">
                              Active
                            </Badge>
                          )}
                          {mutation.isPending && mutation.variables === option.value && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                        isSelected ? "border-primary" : "border-muted-foreground/40"
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
