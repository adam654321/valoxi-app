import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Download, Shield, CheckCircle } from 'lucide-react';
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
  const { toast } = useToast();

  const canSubmit = fullName.trim().length >= 2 && agreed && !submitting;

  async function handleDownload() {
    try {
      const response = await fetch(`/api/v2/public/deal-documents/${token}/${ndaDocument.id}/download`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'NDA.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      toast({ title: 'Download failed', description: 'Please try again.', variant: 'destructive' });
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

      toast({ title: 'NDA Accepted', description: 'You now have access to the document portal.' });
      onAgreed();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
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
        <CardContent className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-medium">Non-Disclosure Agreement</p>
                <p className="text-sm text-gray-500">Please download and review before accepting</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="nda-agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              <label htmlFor="nda-agree" className="text-sm leading-relaxed cursor-pointer">
                I have read and understood the Non-Disclosure Agreement. I agree to be bound by its terms
                and confirm that I will treat all information shared through this portal as confidential.
              </label>
            </div>

            <div className="space-y-2">
              <label htmlFor="full-name" className="text-sm font-medium">
                Full Name (as signature)
              </label>
              <Input
                id="full-name"
                placeholder="Type your full name to confirm agreement"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="text-base"
              />
              <p className="text-xs text-gray-500">
                By typing your name and clicking Accept, you are electronically signing this agreement.
                Your name, IP address, and timestamp will be recorded.
              </p>
            </div>

            <Button
              onClick={handleAgree}
              disabled={!canSubmit}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                'Submitting...'
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept NDA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
