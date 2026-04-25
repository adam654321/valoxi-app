import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, UserPlus, Building2, Mail } from "lucide-react";

interface InvitationDetails {
  email: string;
  invitedRole: string;
  companyName: string;
  inviterName: string;
  invitationMessage?: string;
  invitationStatus: string;
}

export default function AcceptInvitation() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (params.token) {
      setToken(params.token);
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const queryToken = urlParams.get('token');
    if (queryToken) setToken(queryToken);
  }, [params.token]);

  const { data: invitation, isLoading, error } = useQuery<InvitationDetails>({
    queryKey: ['/api/v2/team/invitation', token],
    enabled: !!token,
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      const response = await fetch(`/api/v2/team/invitation/${token}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load invitation');
      }
      const result = await response.json();
      return result.data;
    },
  });

  const goToSignUp = () => {
    if (!invitation?.email) return;
    const url = `/sign-up?email_address=${encodeURIComponent(invitation.email)}`;
    setLocation(url);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
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
      <div className="min-h-screen flex items-center justify-center bg-muted">
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
    const errorMessage = error?.message || "";
    const isExpired = errorMessage.toLowerCase().includes('expired');
    const description = isExpired
      ? "This invitation has expired. Please ask your administrator to send a new one, or contact support."
      : errorMessage || "This invitation is invalid or has expired.";
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => setLocation("/sign-in")} className="w-full">
              Go to sign in
            </Button>
            <a
              href="mailto:support@valoxi.ai?subject=Invitation%20link%20issue"
              className="text-sm text-muted-foreground underline text-center"
            >
              Contact support
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.invitationStatus !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Invitation Already Used</CardTitle>
            <CardDescription>
              This invitation has already been accepted. You can sign in to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/sign-in")} className="w-full">
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <UserPlus className="w-12 h-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold">Join {invitation.companyName} on Valoxi</CardTitle>
          <CardDescription>
            {invitation.inviterName} has invited you. Click below to set up your account using sign in with Google, Microsoft, or your email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/60">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Company:</span>
                <span>{invitation.companyName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Sign up using:</span>
                <span>{invitation.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Role:</span>
                <span className="capitalize">{invitation.invitedRole.replace(/_/g, ' ')}</span>
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
          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800/60 text-sm">
            <strong>Important:</strong> Make sure you sign up using the email{" "}
            <span className="font-mono">{invitation.email}</span>. If you sign up with a different email, your account will not be linked to this invitation.
          </div>
          <Button onClick={goToSignUp} className="w-full" size="lg">
            Set up your account
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              onClick={() => setLocation("/sign-in")}
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
