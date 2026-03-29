import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, CheckCircle, Loader2, ChevronDown, Download } from 'lucide-react';
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

const ndaStyles = `
  .nda-content {
    font-family: 'Georgia', 'Times New Roman', Times, serif;
    color: #1a1a1a !important;
    line-height: 1.8;
    font-size: 14px;
  }
  .nda-content * {
    color: inherit !important;
    background-color: transparent !important;
  }
  .nda-content h1 {
    font-size: 22px;
    font-weight: 700;
    text-align: center;
    margin: 24px 0 16px;
    color: #111;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .nda-content h2 {
    font-size: 17px;
    font-weight: 700;
    margin: 20px 0 10px;
    color: #111;
    border-bottom: 1px solid #e5e5e5;
    padding-bottom: 6px;
  }
  .nda-content h3 {
    font-size: 15px;
    font-weight: 600;
    margin: 16px 0 8px;
    color: #222;
  }
  .nda-content p {
    margin: 8px 0;
    text-align: justify;
  }
  .nda-content strong {
    font-weight: 700;
    color: #111;
  }
  .nda-content em {
    font-style: italic;
  }
  .nda-content u {
    text-decoration: underline;
  }
  .nda-content ul, .nda-content ol {
    margin: 8px 0 8px 24px;
    padding: 0;
  }
  .nda-content li {
    margin: 4px 0;
  }
  .nda-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
  }
  .nda-content table td, .nda-content table th {
    border: 1px solid #ddd;
    padding: 8px 12px;
    font-size: 13px;
  }
  .nda-content table th {
    background: #f5f5f5;
    font-weight: 600;
  }
`;

export default function NdaAgreement({ token, ndaDocument, buyerCompanyName, onAgreed }: NdaAgreementProps) {
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedName, setAcceptedName] = useState('');
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

  useEffect(() => {
    if (!isLoading && ndaContent && scrollRef.current) {
      const el = scrollRef.current;
      if (el.scrollHeight <= el.clientHeight + 50) {
        setHasScrolledToBottom(true);
      }
    }
  }, [isLoading, ndaContent]);

  const canSubmit = fullName.trim().length >= 2 && agreed && !submitting && hasScrolledToBottom;

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      setHasScrolledToBottom(true);
    }
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
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

      setAcceptedName(fullName.trim());
      setAccepted(true);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted) {
    return (
      <div className="force-light min-h-screen bg-muted py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-2xl">NDA Signed</CardTitle>
              <CardDescription className="text-base mt-2">
                Thank you, {acceptedName}. Your agreement has been recorded and a signed copy has been saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              <a
                href={`/api/v2/public/deal-documents/${token}/${ndaDocument.id}/download`}
                download
                className="w-full"
              >
                <Button variant="outline" className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Download Signed NDA (PDF)
                </Button>
              </a>
              <Button
                onClick={onAgreed}
                className="w-full"
                size="lg"
              >
                Continue to Portal
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="force-light min-h-screen bg-muted py-8 px-4">
      <style>{ndaStyles}</style>
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

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
                <span className="ml-3 text-muted-foreground">Loading agreement...</span>
              </div>
            ) : (
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="max-h-[60vh] overflow-y-auto bg-white rounded-lg shadow-sm"
                style={{ scrollBehavior: 'smooth' }}
              >
                <div className="px-10 py-8">
                  <div
                    className="nda-content"
                    dangerouslySetInnerHTML={{ __html: ndaContent?.html || '<p>Unable to load NDA content.</p>' }}
                  />
                </div>
              </div>
            )}

            {!hasScrolledToBottom && !isLoading && (
              <div
                className="flex items-center justify-center gap-2 py-3 bg-amber-50 border-t border-amber-200 text-amber-700 text-sm cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={scrollToBottom}
              >
                <ChevronDown className="h-4 w-4 animate-bounce" />
                Please scroll to the bottom to review the full agreement
                <ChevronDown className="h-4 w-4 animate-bounce" />
              </div>
            )}

            {hasScrolledToBottom && !isLoading && (
              <div className="flex items-center justify-center gap-2 py-2 bg-green-50 border-t border-green-200 text-green-700 text-sm">
                <CheckCircle className="h-4 w-4" />
                Full agreement reviewed
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
              <label htmlFor="nda-agree" className={`text-sm leading-relaxed cursor-pointer ${!hasScrolledToBottom ? 'text-muted-foreground/70' : ''}`}>
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
              <p className="text-xs text-muted-foreground">
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
