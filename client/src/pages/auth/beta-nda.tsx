import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, FileText, Shield } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function BetaNda() {
  const [, setLocation] = useLocation();
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  const signMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/v2/auth/beta-nda/sign', { signerName: signerName.trim() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/v2/auth/me'], (old: any) => {
        if (!old) return old;
        const data = old?.data ?? old;
        const updated = { ...data, betaNdaSigned: true };
        return old?.data !== undefined ? { ...old, data: updated } : updated;
      });
      setSigned(true);
      setTimeout(() => setLocation('/dashboard'), 2500);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to record signature. Please try again.');
    },
  });

  const handleSign = () => {
    setError(null);
    if (!signerName.trim() || signerName.trim().length < 2) {
      setError('Please enter your full legal name.');
      return;
    }
    if (!agreed) {
      setError('Please confirm you have read and agree to the terms.');
      return;
    }
    signMutation.mutate();
  };

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Agreement signed</h2>
          <p className="text-muted-foreground">A signed copy has been emailed to you. Redirecting to Valoxi now...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="text-center space-y-2">
          <div className="h-14 w-14 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto shadow-lg">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Beta Testing Non-Disclosure Agreement</h1>
          <p className="text-muted-foreground text-sm">Please read and sign before accessing Valoxi.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Valoxi Beta NDA — Version 1.0, March 2026
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
              <div className="space-y-4 text-foreground">
                <div className="text-center space-y-1">
                  <p className="font-bold text-lg">VALOXI</p>
                  <p className="text-muted-foreground text-xs">A trading name of ShiftOps Consulting Ltd</p>
                  <p className="font-semibold">NON-DISCLOSURE AGREEMENT</p>
                  <p className="font-semibold">BETA TESTING PROGRAMME</p>
                </div>
                <p><strong>1. Background</strong></p>
                <p>1.1 Valoxi has developed a proprietary artificial intelligence platform that delivers institutional-grade mergers and acquisitions due diligence analysis (the "Platform"). The Platform is currently in pre-launch beta testing.</p>
                <p>1.2 Valoxi wishes to invite selected individuals to participate in its beta testing programme (the "Beta Programme") to evaluate the Platform and provide feedback.</p>
                <p>1.3 In connection with the Beta Programme, Valoxi will disclose to the Receiving Party certain Confidential Information (as defined below). This Agreement governs the use and protection of that information.</p>
                <p><strong>2. Definitions</strong></p>
                <p>"Confidential Information" means all information disclosed by Valoxi to the Receiving Party, whether in written, electronic, oral, or visual form, in connection with the Beta Programme, including without limitation: the Platform, its features, functionality, user interface, and analytical outputs; software architecture, algorithms, data models, and AI methodologies; product roadmap, development plans, and unreleased features; business strategy, commercial terms, pricing, and competitive positioning; and any other information designated as confidential or that a reasonable person would understand to be confidential given the nature of the information and circumstances of disclosure.</p>
                <p>"Beta Period" means the period commencing on the date of this Agreement and ending on the earlier of: (a) the public commercial launch of the Platform; or (b) written notice from Valoxi terminating the Beta Programme.</p>
                <p>"Permitted Purpose" means the evaluation of the Platform solely for the purposes of the Beta Programme and the provision of feedback to Valoxi.</p>
                <p><strong>3. Confidentiality Obligations</strong></p>
                <p>3.1 The Receiving Party agrees to: keep all Confidential Information strictly confidential; use Confidential Information solely for the Permitted Purpose; not disclose Confidential Information to any third party without Valoxi's prior written consent; apply at least the same degree of care to the Confidential Information as the Receiving Party applies to its own confidential information, and in any event no less than reasonable care; notify Valoxi promptly upon becoming aware of any actual or suspected unauthorised disclosure of Confidential Information.</p>
                <p>3.2 The obligations in clause 3.1 do not apply to information which: is or becomes publicly available other than through breach of this Agreement; was already known to the Receiving Party prior to disclosure; is independently developed by the Receiving Party without reference to the Confidential Information; is required to be disclosed by law or court order, provided the Receiving Party gives Valoxi prompt written notice.</p>
                <p><strong>4. Beta Testing Obligations</strong></p>
                <p>4.1 The Receiving Party agrees to: use the Platform solely for evaluation and testing purposes during the Beta Period; provide honest feedback to Valoxi; report any bugs, errors, or unexpected behaviour promptly; not use the Platform to process live deals, client data, or information belonging to third parties unless expressly agreed in writing by Valoxi.</p>
                <p>4.2 The Receiving Party acknowledges that the Platform is pre-release software and may contain defects. Valoxi does not warrant that the Platform will be error-free, complete, or fit for any particular purpose during the Beta Period.</p>
                <p><strong>5. Intellectual Property</strong></p>
                <p>5.1 All intellectual property rights in and to the Platform, the Confidential Information, and any improvements or modifications made by Valoxi remain the exclusive property of Valoxi.</p>
                <p>5.2 Any feedback, suggestions, ideas, or recommendations provided by the Receiving Party may be used by Valoxi without restriction. The Receiving Party hereby assigns to Valoxi all rights in and to such Feedback.</p>
                <p>5.3 Nothing in this Agreement grants the Receiving Party any licence or right to use Valoxi's intellectual property, trade marks, or brand materials without prior written consent.</p>
                <p><strong>6. Data Protection</strong></p>
                <p>6.1 The parties acknowledge that any personal data processed in connection with the Beta Programme will be processed in accordance with applicable data protection legislation, including the UK GDPR and the Data Protection Act 2018.</p>
                <p>6.2 The Receiving Party agrees not to upload or input any personal data of third parties into the Platform during the Beta Period without the express knowledge and consent of those individuals.</p>
                <p><strong>7. Disclaimer and Limitation of Liability</strong></p>
                <p>7.1 The Platform and all analysis outputs are provided for informational purposes only. Nothing produced by the Platform constitutes financial advice, investment advice, legal advice, or professional due diligence. The Receiving Party should not rely solely on Platform outputs when making investment or acquisition decisions.</p>
                <p>7.2 To the fullest extent permitted by law, Valoxi shall not be liable for any loss or damage arising from the Receiving Party's use of the Platform during the Beta Period.</p>
                <p><strong>8. Term and Return of Information</strong></p>
                <p>8.1 This Agreement commences on the date of signature and continues until the end of the Beta Period. Confidentiality obligations survive termination for a period of three (3) years.</p>
                <p>8.2 Upon request by Valoxi, the Receiving Party shall promptly return or destroy all Confidential Information in its possession.</p>
                <p><strong>9. General</strong></p>
                <p>9.1 This Agreement is governed by the laws of England and Wales. The parties submit to the exclusive jurisdiction of the courts of England and Wales.</p>
                <p>9.2 This Agreement constitutes the entire agreement between the parties with respect to its subject matter.</p>
                <p>9.3 No amendment to this Agreement is effective unless made in writing and signed by both parties.</p>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Disclosing Party</p>
                <p className="font-semibold text-foreground">ShiftOps Consulting Ltd (Valoxi)</p>
                <p className="text-muted-foreground">Signed by: Adam Auty, Director</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Receiving Party (You)</p>
                <div className="space-y-2">
                  <Label htmlFor="signerName" className="text-xs text-muted-foreground">Full legal name</Label>
                  <Input
                    id="signerName"
                    placeholder="Enter your full legal name"
                    value={signerName}
                    onChange={(e) => { setSignerName(e.target.value); setError(null); }}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(v) => { setAgreed(!!v); setError(null); }}
                className="mt-0.5"
              />
              <Label htmlFor="agree" className="text-sm text-foreground leading-relaxed cursor-pointer">
                I confirm I have read and understood the Valoxi Beta Testing Non-Disclosure Agreement in full, and I agree to be bound by its terms.
              </Label>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={handleSign}
              disabled={signMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              size="lg"
            >
              {signMutation.isPending ? 'Signing...' : 'Sign Agreement & Continue to Valoxi'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              A signed copy will be emailed to you and to hello@valoxi.ai for our records.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
