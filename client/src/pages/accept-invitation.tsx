import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserCheck, Building2, Mail, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

interface InvitationDetails {
  email: string;
  role: string;
  companyName: string;
  inviterName: string;
  message?: string;
}

const acceptSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptFormValues = z.infer<typeof acceptSchema>;

export default function AcceptInvitation() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);

  // Extract token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('token');
    if (inviteToken) {
      setToken(inviteToken);
    }
  }, []);

  // Query invitation details
  const { data: invitation, isLoading, error } = useQuery<InvitationDetails>({
    queryKey: ['/api/team/invitation', token],
    enabled: !!token,
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      const response = await fetch(`/api/team/invitation/${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
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

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async (data: AcceptFormValues) => {
      if (!token) throw new Error("No token provided");
      
      const response = await fetch('/api/team/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          firstName: data.firstName,
          lastName: data.lastName,
          password: data.password,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Welcome to the team!",
        description: "Your account has been created successfully. You can now log in.",
      });
      
      // Redirect to login page after a brief delay
      setTimeout(() => {
        setLocation('/auth/login');
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error accepting invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AcceptFormValues) => {
    acceptMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600 dark:text-red-400">Invalid Invitation</CardTitle>
            <CardDescription>
              The invitation link is missing or invalid. Please check the link in your email.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600 dark:text-red-400">Invalid or Expired Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid, expired, or has already been used. 
              Please contact your team administrator for a new invitation.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <UserCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="mt-4">Join the Team</CardTitle>
          <CardDescription>
            You've been invited to join the team. Complete your profile to get started.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {invitation.companyName}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {invitation.email}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Role: {invitation.role}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Invited by: {invitation.inviterName}
            </div>
            {invitation.message && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-400">
                <p className="text-sm text-blue-800 dark:text-blue-200 italic">
                  "{invitation.message}"
                </p>
              </div>
            )}
          </div>

          {/* Account Setup Form */}
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
                        <Input placeholder="Smith" {...field} />
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
                      <Input type="password" placeholder="Create a secure password" {...field} />
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
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm your password" {...field} />
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
                {acceptMutation.isPending ? "Creating Account..." : "Join Team"}
              </Button>
            </form>
          </Form>

          {acceptMutation.isSuccess && (
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-green-800 dark:text-green-200 font-medium">
                Account created successfully!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                Redirecting to login page...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}