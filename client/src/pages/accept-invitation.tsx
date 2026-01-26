import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, UserPlus, Building2, Mail } from "lucide-react";

interface InvitationDetails {
  email: string;
  invitedRole: string;
  companyName: string;
  inviterName: string;
  invitationMessage?: string;
  invitationStatus: string;
}

const acceptSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptFormValues = z.infer<typeof acceptSchema>;

export default function AcceptInvitation() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams();
  const [token, setToken] = useState<string | null>(null);

  // Extract token from URL params or query string
  useEffect(() => {
    if (params.token) {
      setToken(params.token);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const inviteToken = urlParams.get('token');
      if (inviteToken) {
        setToken(inviteToken);
      }
    }
  }, [params.token]);

  // Query invitation details - using v2 endpoint
  const { data: invitation, isLoading, error } = useQuery<InvitationDetails>({
    queryKey: ['/api/v2/team/invitation', token],
    enabled: !!token,
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      const response = await fetch(`/api/v2/team/invitation/${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to load invitation');
      }
      const result = await response.json();
      return result.data; // v2 wraps data
    },
  });

  const form = useForm<AcceptFormValues>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Accept invitation mutation - using v2 endpoint
  const acceptMutation = useMutation({
    mutationFn: async (data: AcceptFormValues) => {
      return apiRequest("POST", `/api/v2/team/invitation/${token}/accept`, {
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
      });
    },
    onSuccess: async (response) => {
      toast({
        title: "Welcome to the team!",
        description: "Your account has been created successfully. Logging you in...",
      });
      
      // Auto-login the user after successful registration
      try {
        const loginResponse = await apiRequest("POST", "/api/v2/auth/login", {
          email: invitation?.email,
          password: form.getValues("password"),
        });
        
        if (loginResponse) {
          toast({
            title: "Login successful!",
            description: "Redirecting to your dashboard...",
          });
          setTimeout(() => {
            setLocation("/dashboard");
          }, 1000);
        }
      } catch (error) {
        // If auto-login fails, redirect to login page
        toast({
          title: "Please login",
          description: "Your account was created successfully. Please login with your credentials.",
        });
        setTimeout(() => {
          setLocation("/login");
        }, 1500);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to accept invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AcceptFormValues) => {
    acceptMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              No invitation token provided. Please check your invitation link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-lg">Loading invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>
              {error?.message || "This invitation is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation("/login")} 
              className="w-full"
              variant="outline"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.invitationStatus !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Invitation Already Used</CardTitle>
            <CardDescription>
              This invitation has already been accepted. You can log in with your existing account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation("/login")} 
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <UserPlus className="w-12 h-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold">Join the Team</CardTitle>
          <CardDescription>
            Complete your registration to join {invitation.companyName}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Company:</span>
                <span>{invitation.companyName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Email:</span>
                <span>{invitation.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Role:</span>
                <span className="capitalize">{invitation.invitedRole}</span>
              </div>
              {invitation.invitationMessage && (
                <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-800/30 rounded border-l-4 border-blue-400">
                  <p className="text-blue-800 dark:text-blue-200 italic">
                    "{invitation.invitationMessage}"
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                    - {invitation.inviterName}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Registration Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
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
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter secure password" {...field} />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-500 mt-1">
                      Must be 8+ characters with uppercase, lowercase, and number
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Accept Invitation & Create Account"
                )}
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <button
              onClick={() => setLocation("/login")}
              className="text-primary hover:underline font-medium"
            >
              Sign in here
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}