import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConsentTokenStatus {
  email: string;
  alreadyConsented: boolean;
  consentRecordedAt: string | null;
}

type ConfirmState = 'idle' | 'confirming' | 'confirmed' | 'error';

export default function MarketingConsentPage() {
  const { token } = useParams<{ token?: string }>();
  const { toast } = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmState>('idle');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ConsentTokenStatus>({
    queryKey: ['/api/v2/public/marketing-consent', token],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/v2/public/marketing-consent/${token}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || 'Unable to load consent link');
      }
      return body.data as ConsentTokenStatus;
    },
  });

  async function handleConfirm() {
    if (!token || confirmState === 'confirming') return;
    setConfirmState('confirming');
    setConfirmError(null);
    try {
      const response = await fetch(`/api/v2/public/marketing-consent/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || 'Unable to confirm consent');
      }
      setConfirmedAt(body.data?.consentRecordedAt ?? new Date().toISOString());
      setConfirmState('confirmed');
      toast({
        title: 'Marketing preferences updated',
        description: `You'll now receive Valoxi product updates at ${body.data?.email ?? data?.email ?? 'your email'}.`,
      });
    } catch (err: any) {
      setConfirmError(err?.message || 'Something went wrong. Please try again.');
      setConfirmState('error');
    }
  }

  function CardShell({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          {children}
        </Card>
      </div>
    );
  }

  // No token in URL
  if (!token) {
    return (
      <CardShell>
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>Invalid link</CardTitle>
          </div>
          <CardDescription>
            This consent link is missing the token. Please use the link from the email we sent you.
          </CardDescription>
        </CardHeader>
      </CardShell>
    );
  }

  // Loading validity check
  if (isLoading) {
    return (
      <CardShell>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </CardShell>
    );
  }

  // Validity check failed (expired / not found)
  if (error) {
    const message = error instanceof Error ? error.message : 'Unable to load consent link';
    return (
      <CardShell>
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>This link is no longer valid</CardTitle>
          </div>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you want to receive Valoxi product updates, email us at{' '}
            <a href="mailto:hello@valoxi.ai" className="text-primary hover:underline">hello@valoxi.ai</a>{' '}
            and we'll add you to the list.
          </p>
        </CardContent>
      </CardShell>
    );
  }

  // Already consented (either previously or just now)
  if (data?.alreadyConsented || confirmState === 'confirmed') {
    const ts = data?.consentRecordedAt ?? confirmedAt;
    return (
      <CardShell>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle className="h-5 w-5" />
            <CardTitle>You're all set</CardTitle>
          </div>
          <CardDescription>
            Marketing emails are confirmed for{' '}
            <span className="font-medium text-foreground">{data?.email}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You'll receive Valoxi product updates and useful resources from time to time. You can
            unsubscribe at any time via the link in any email we send.
          </p>
          {ts && (
            <p className="text-xs text-muted-foreground">
              Confirmed: {new Date(ts).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </CardContent>
      </CardShell>
    );
  }

  // Idle / confirming / error states (the actual confirm action)
  return (
    <CardShell>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Confirm marketing emails</CardTitle>
        </div>
        <CardDescription>
          Click to confirm you'd like Valoxi product updates sent to{' '}
          <span className="font-medium text-foreground">{data?.email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You'll receive occasional emails about product updates, launches, and useful resources.
          Account emails are sent regardless of this preference. You can unsubscribe at any time.
        </p>
        <Button
          onClick={handleConfirm}
          disabled={confirmState === 'confirming'}
          className="w-full"
        >
          {confirmState === 'confirming' ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirming...</>
          ) : (
            <>Yes, send me product updates</>
          )}
        </Button>
        {confirmState === 'error' && confirmError && (
          <p className="text-sm text-destructive">{confirmError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Not interested? You don't need to do anything. Closing this page will keep your current
          preference (no marketing emails).
        </p>
      </CardContent>
    </CardShell>
  );
}
