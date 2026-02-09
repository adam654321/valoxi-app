import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NdaAgreementProps {
  token: string;
  ndaDocument: {
    id: number;
    documentType: string;
    status: string;
    createdAt: string;
    generatedFileUrl?: string;
  };
  buyerCompanyName?: string;
  onAgreed: () => void;
}

export default function NdaAgreement({ token, ndaDocument, buyerCompanyName, onAgreed }: NdaAgreementProps) {
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: ndaContent, isLoading } = useQuery({
    queryKey: ['nda-html', token, ndaDocument.id],
    queryFn: async () => {
      const res = await fetch(`/api/v2/public/deal-documents/${token}/${ndaDocument.id}/html`);
      if (!res.ok) throw new Error('Failed to load NDA content');
      return res.json();
    },
  });

  const canSubmit = fullName.trim().length >= 2 && agreed && !submitting && hasScrolledToBottom;

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      setHasScrolledToBottom(true);
    }
  }

  async function handleAgree() {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/v2/public/deal-documents/${token}/${ndaDocument.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseType: 'accepted',
          respondentName: fullName.trim(),
          comments: null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to submit agreement');
      }

      toast({ title: 'NDA Accepted', description: 'A signed copy has been saved. You now have access to the document portal.' });
      onAgreed();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Non-Disclosure Agreement</CardTitle>
            <CardDescription className="text-base mt-2">
              {buyerCompanyName
                ? `${buyerCompanyName} requires you to review and accept this NDA before accessing the document portal.`
                : 'Please review and accept the NDA before accessing the document portal.'
              }
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-3 text-gray-500">Loading agreement...</span>
              </div>
            ) : (
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="max-h-[500px] overflow-y-auto p-8 border-b"
                style={{ scrollBehavior: 'smooth' }}
              >
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: ndaContent?.html || '<p>Unable to load NDA content.</p>' }}
                />
              </div>
            )}

            {!hasScrolledToBottom && !isLoading && (
              <div className="text-center py-2 bg-amber-50 text-amber-700 text-sm">
                Please scroll to the bottom to review the full agreement
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="nda-agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                disabled={!hasScrolledToBottom}
              />
              <label htmlFor="nda-agree" className={`text-sm leading-relaxed cursor-pointer ${!hasScrolledToBottom ? 'text-gray-400' : ''}`}>
                I have read and understood the Non-Disclosure Agreement. I agree to be bound by its terms
                and confirm that I will treat all information shared through this portal as confidential.
              </label>
            </div>

            <div className="space-y-2">
              <label htmlFor="full-name" className="text-sm font-medium">
                Full Name (as electronic signature)
              </label>
              <Input
                id="full-name"
                placeholder="Type your full name to sign"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="text-base"
                disabled={!hasScrolledToBottom}
              />
              <p className="text-xs text-gray-500">
                By typing your name and clicking Accept, you are electronically signing this agreement.
                Your name, IP address, and timestamp will be recorded. A signed PDF copy will be available for download.
              </p>
            </div>

            <Button
              onClick={handleAgree}
              disabled={!canSubmit}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept & Sign NDA
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
