import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, refreshCsrfToken, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(1, "Company name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8),
  promoCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const INVITE_ERROR_CODES = ['invite_required', 'invalid_code', 'code_used', 'code_expired'];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [codeError, setCodeError] = useState<string | null>(null);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      password: "",
      confirmPassword: "",
      promoCode: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = getCsrfToken();
      if (token) {
        headers["x-csrf-token"] = token;
      }

      const res = await fetch("/api/v2/auth/register", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const jsonBody = await res.json().catch(() => null);
        if (res.status === 403 && jsonBody) {
          throw { ...jsonBody, _isInviteError: true };
        }
        throw new Error(jsonBody?.message || jsonBody?.error || `${res.status}: Registration failed`);
      }

      return res.json();
    },
    onSuccess: async (data: any) => {
      await refreshCsrfToken();
      await queryClient.refetchQueries({ queryKey: ["/api/v2/auth/me"] });
      setLocation("/onboarding");
      toast({
        title: "Success",
        description: "Account created successfully!",
      });
      const responseData = data?.data || data;
      if (responseData?.promoApplied) {
        toast({
          title: "Promo Code Applied",
          description: responseData.discountDescription || "Your promo code has been applied successfully!",
        });
      } else if (responseData?.promoError) {
        toast({
          title: "Promo Code Not Applied",
          description: responseData.promoError,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      const errorCode = error?.error || error?.data?.error;
      const errorMessage = error?.message || error?.data?.message;

      if (errorCode && INVITE_ERROR_CODES.includes(errorCode)) {
        setCodeError(errorMessage || "Invalid invitation code");
        return;
      }

      toast({
        title: "Error",
        description: error.message || "Registration failed",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="mt-6 text-3xl font-bold text-textPrimary">Create Your Account</h1>
          <p className="mt-2 text-sm text-textSecondary">Join Valoxi</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-textPrimary">First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" className="px-4 py-3" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-textPrimary">Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" className="px-4 py-3" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-textPrimary">Company Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ABC Investment Partners"
                            className="px-4 py-3"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-textPrimary">Business Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@abcinvestment.com"
                            className="px-4 py-3"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="promoCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-textPrimary font-semibold">Invitation Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 5DA-X7K2M"
                            className="px-4 py-3 border-primary/50 border-2"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              if (codeError) setCodeError(null);
                            }}
                          />
                        </FormControl>
                        {codeError && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{codeError}</p>
                        )}
                        <p className="text-xs text-textSecondary mt-1">
                          Don't have a code? Valoxi is currently in early access. Visit our website to join the waitlist.
                        </p>
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
                            placeholder="Create a strong password"
                            className="px-4 py-3"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-textPrimary">Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Confirm your password"
                            className="px-4 py-3"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full py-3 bg-primary hover:bg-blue-700"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                </Button>

                <div className="text-center">
                  <span className="text-sm text-textSecondary">Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => setLocation("/")}
                    className="font-medium text-primary hover:text-blue-500 transition-colors"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
