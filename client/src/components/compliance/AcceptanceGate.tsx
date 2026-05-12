import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MissingDocument {
  documentType: 'terms' | 'dpa';
  version: string;
}

interface ComplianceStatus {
  allAccepted: boolean;
  missing: MissingDocument[];
  currentVersions: { terms: string; dpa: string };
}

export function AcceptanceGate() {
  const { toast } = useToast();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptDpa, setAcceptDpa] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ComplianceStatus>({
    queryKey: ['/api/v2/compliance/status'],
    select: (response: any) => response?.data || response,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (payload: { acceptTerms: boolean; acceptDpa: boolean }) => {
      const res = await apiRequest('POST', '/api/v2/compliance/accept', payload);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/v2/compliance/status'] });
      toast({ title: "Thanks, you're all set." });
    },
    onError: (err: any) => {
      setError(err?.message || 'Something went wrong, please try again.');
    },
  });

  if (isLoading || !data) return null;
  if (data.allAccepted) return null;

  const termsMissing = data.missing.some((m) => m.documentType === 'terms');
  const dpaMissing = data.missing.some((m) => m.documentType === 'dpa');

  const canSubmit = (!termsMissing || acceptTerms) && (!dpaMissing || acceptDpa);

  const handleSubmit = () => {
    if (!canSubmit) {
      setError('Please accept all required documents to continue.');
      return;
    }
    setError(null);
    acceptMutation.mutate({
      acceptTerms: termsMissing ? acceptTerms : false,
      acceptDpa: dpaMissing ? acceptDpa : false,
    });
  };

  return (
    <Dialog open={true} onOpenChange={() => { /* gate cannot be dismissed */ }}>
      <DialogContent
        className="sm:max-w-md [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Confirm your terms</DialogTitle>
          <DialogDescription>
            We've now published our Terms and Data Processing Agreement on valoxi.ai. Please tick to confirm you accept both before continuing. You can read each in full via the links below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {termsMissing && (
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="gateTerms"
                checked={acceptTerms}
                onChange={(e) => { setAcceptTerms(e.target.checked); setError(null); }}
                className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <label htmlFor="gateTerms" className="text-sm text-foreground leading-relaxed cursor-pointer">
                I accept the{" "}
                <a href="https://valoxi.ai/terms/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                  Terms and Conditions
                </a>
                .
              </label>
            </div>
          )}
          {dpaMissing && (
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="gateDpa"
                checked={acceptDpa}
                onChange={(e) => { setAcceptDpa(e.target.checked); setError(null); }}
                className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <label htmlFor="gateDpa" className="text-sm text-foreground leading-relaxed cursor-pointer">
                I accept the{" "}
                <a href="https://valoxi.ai/dpa/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                  Data Processing Agreement
                </a>
                .
              </label>
            </div>
          )}
          <p className="text-xs text-muted-foreground pl-7">
            Our{" "}
            <a href="https://valoxi.ai/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
              Privacy Policy
            </a>{" "}
            explains how we handle your data.
          </p>
          {error && <p className="text-sm text-red-600 pl-7">{error}</p>}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || acceptMutation.isPending}
          className="w-full"
        >
          {acceptMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Confirm and continue
        </Button>
      </DialogContent>
    </Dialog>
  );
}
