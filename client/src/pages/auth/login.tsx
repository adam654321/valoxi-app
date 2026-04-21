import { useState } from "react";
import { useLocation } from "wouter";
import { ValoxiLogo } from "@/components/valoxi-logo";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, refreshCsrfToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const [loginError, setLoginError] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await apiRequest("POST", "/api/v2/auth/login", data);
      return response.json();
    },
    onSuccess: async () => {
      setLoginError(null);
      await refreshCsrfToken();
      await queryClient.refetchQueries({ queryKey: ["/api/v2/auth/me"] });
      setLocation("/dashboard");
    },
    onError: () => {
      setLoginError("The email address or password you entered is incorrect. Please try again.");
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center flex flex-col items-center gap-2">
          <ValoxiLogo />
          <p className="text-sm text-textSecondary">Sign in to your acquisition management platform</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-textPrimary">Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Enter your email"
                            className="px-4 py-3"
                            {...field}
                            onChange={(e) => { field.onChange(e); setLoginError(null); }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-textPrimary">Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your password"
                            className="px-4 py-3"
                            {...field}
                            onChange={(e) => { field.onChange(e); setLoginError(null); }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {loginError && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setLocation("/forgot-password")}
                    className="text-sm font-medium text-primary hover:text-blue-500 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  className="w-full py-3 bg-primary hover:bg-blue-700"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>

                <div className="text-center">
                  <span className="text-sm text-textSecondary">
                    Access to Valoxi is by invitation only. Contact{" "}
                    <a
                      href="mailto:support@valoxi.ai"
                      className="font-medium text-primary hover:text-blue-500 transition-colors"
                    >
                      support@valoxi.ai
                    </a>
                    .
                  </span>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <ResendMagicLinkSection />
      </div>
    </div>
  );
}

function ResendMagicLinkSection() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleResend = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/v2/auth/resend-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.status === 429) {
        setError("Too many requests — please wait a few minutes.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Something went wrong.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Signed up but don't have a password? Resend your login link
        </button>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {sent ? (
          <div className="text-center space-y-2 py-2">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
            <p className="text-sm font-medium text-foreground">Check your inbox for a new login link.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter your email and we'll send a new magic link.</p>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResend()}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleResend} disabled={sending} className="flex-1">
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Send Login Link
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
