import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  FileText, Shield, Send, FileCheck, 
  CheckCircle, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronDown, ChevronUp, Download, Eye, User, Calendar,
  Loader2, GitMerge, Lock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface DocumentResponse {
  id: number;
  responseType: string;
  comments: string | null;
  respondentName: string;
  respondentEmail: string | null;
  createdAt: string;
}

interface DealDocument {
  id: number;
  documentType: string;
  status: string;
  deliveryMethod?: string;
  version: number;
  createdAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  generatedFileUrl: string | null;
  documentData: any;
  responses?: DocumentResponse[];
}

interface DealDocumentsSummaryProps {
  targetCompanyId: number;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary'; icon: any; bgColour: string; textColour?: string }> = {
  draft: { label: 'Draft', variant: 'outline', icon: FileText, bgColour: 'bg-muted' },
  sent: { label: 'Sent — Awaiting Response', variant: 'outline', icon: Clock, bgColour: 'bg-blue-50 dark:bg-blue-950/30' },
  viewed: { label: 'Viewed — Awaiting Response', variant: 'outline', icon: Eye, bgColour: 'bg-blue-50 dark:bg-blue-950/30' },
  accepted: { label: 'Accepted', variant: 'default', icon: CheckCircle, bgColour: 'bg-green-50 dark:bg-green-950/30' },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle, bgColour: 'bg-red-50 dark:bg-red-950/30' },
  withdrawn: { label: 'Withdrawn', variant: 'outline', icon: AlertCircle, bgColour: 'bg-muted' },
  superseded: { label: 'Superseded', variant: 'outline', icon: Clock, bgColour: 'bg-muted' },
  countered: { label: 'Countered', variant: 'outline', icon: GitMerge, bgColour: 'bg-amber-50 dark:bg-amber-950/30', textColour: 'text-amber-700 dark:text-amber-300' },
  downloaded: { label: 'Downloaded', variant: 'outline', icon: Download, bgColour: 'bg-purple-50 dark:bg-purple-950/30', textColour: 'text-purple-700 dark:text-purple-300' },
};

export default function DealDocumentsSummary({ targetCompanyId }: DealDocumentsSummaryProps) {
  const { toast } = useToast();
  const [showHotDialog, setShowHotDialog] = useState(false);
  const [ndaLoading, setNdaLoading] = useState(false);
  const [offerLoading, setOfferLoading] = useState(false);
  const [hotLoading, setHotLoading] = useState(false);
  const [showNdaSwitchConfirm, setShowNdaSwitchConfirm] = useState(false);
  const [showNdaSentConfirm, setShowNdaSentConfirm] = useState(false);
  const [showNdaResponseConfirm, setShowNdaResponseConfirm] = useState<string | null>(null);
  const [ndaConfirmDate, setNdaConfirmDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ndaConfirmNotes, setNdaConfirmNotes] = useState('');

  const { data: documents, isLoading } = useQuery<DealDocument[]>({
    queryKey: ['/api/v2/deal-documents/company', targetCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/v2/deal-documents/company/${targetCompanyId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: dealModelsData } = useQuery({
    queryKey: ['/api/v2/deal-models/company', targetCompanyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/v2/deal-models/company/${targetCompanyId}`);
      return res.json();
    },
  });

  const latestDealModelId: number | undefined = dealModelsData?.data?.[0]?.id;

  if (isLoading) return null;

  const byType: Record<string, DealDocument[]> = {};
  for (const doc of (documents || [])) {
    if (!byType[doc.documentType]) byType[doc.documentType] = [];
    byType[doc.documentType].push(doc);
  }

  const docTypes = [
    { key: 'nda', label: 'Non-Disclosure Agreement', icon: Shield },
    { key: 'offer_letter', label: 'Offer Letter', icon: Send },
    { key: 'heads_of_terms', label: 'Heads of Terms', icon: FileCheck },
  ];

  const hotDocs = byType['heads_of_terms'] || [];
  const latestHot = hotDocs
    .filter(d => d.status !== 'superseded')
    .sort((a, b) => b.version - a.version)[0];
  const hasActiveHot = latestHot && !['withdrawn', 'rejected'].includes(latestHot.status);

  const offerAccepted = (documents || []).some(d => d.documentType === 'offer_letter' && d.status === 'accepted');

  const showGenerateHotButton = offerAccepted && !hasActiveHot;

  const ndaAccepted = (documents || []).some(d => d.documentType === 'nda' && d.status === 'accepted');
  const hasNda = (documents || []).some(d => d.documentType === 'nda');
  const hotAccepted = (documents || []).some(d => d.documentType === 'heads_of_terms' && d.status === 'accepted');

  const dealModelExists = latestDealModelId !== undefined;
  const ndaDoc = (documents || []).filter(d => d.documentType === 'nda' && d.status !== 'superseded').sort((a, b) => b.version - a.version)[0];
  const offerDoc = (documents || []).filter(d => d.documentType === 'offer_letter' && d.status !== 'superseded' && d.status !== 'withdrawn').sort((a, b) => b.version - a.version)[0];
  const hotDoc = (documents || []).filter(d => d.documentType === 'heads_of_terms' && d.status !== 'superseded').sort((a, b) => b.version - a.version)[0];
  const ndaIsOffline = ndaDoc?.deliveryMethod === 'offline';
  const offerIsOffline = offerDoc?.deliveryMethod === 'offline';
  const hotIsOffline = hotDoc?.deliveryMethod === 'offline';

  const downloadWord = async (
    documentType: 'nda' | 'offer_letter' | 'heads_of_terms',
    setLoading: (v: boolean) => void,
  ) => {
    setLoading(true);
    try {
      let res;
      if (documentType === 'heads_of_terms') {
        res = await apiRequest('POST', '/api/v2/deal-documents/generate-hot-offline', { targetCompanyId });
      } else {
        console.log('create-offline request body', JSON.stringify({ targetCompanyId, documentType, dealModelId: latestDealModelId }));
        res = await apiRequest('POST', '/api/v2/deal-documents/create-offline', {
          targetCompanyId,
          documentType,
          ...(documentType === 'offer_letter' && latestDealModelId ? { dealModelId: latestDealModelId } : {}),
        });
      }
      const data = await res.json();
      const docId = data?.id ?? data?.data?.id;
      if (docId) {
        window.location.href = `/api/v2/deal-documents/${docId}/download-word`;
        queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/company', targetCompanyId] });
      }
    } catch (err) {
      console.error('Offline download failed', err);
      toast({ title: 'Download Failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Deal Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* NDA Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="font-medium">Non-Disclosure Agreement</span>
              </div>
              {ndaAccepted && !ndaIsOffline && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Signed via portal
                </Badge>
              )}
              {ndaAccepted && ndaIsOffline && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Signed offline
                </Badge>
              )}
              {!ndaAccepted && ndaDoc && (ndaDoc.status === 'sent' || ndaDoc.status === 'viewed') && !ndaIsOffline && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  Awaiting signature
                </Badge>
              )}
              {!ndaAccepted && ndaDoc && ndaIsOffline && (ndaDoc.status === 'draft' || ndaDoc.status === 'downloaded') && (
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                  Downloaded
                </Badge>
              )}
              {!ndaAccepted && ndaDoc && ndaIsOffline && ndaDoc.status === 'sent' && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                  Sent
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {/* State 1: accepted via portal */}
            {ndaAccepted && !ndaIsOffline && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Signed via portal
              </Badge>
            )}
            {/* State 2: accepted offline */}
            {ndaAccepted && ndaIsOffline && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Signed offline
              </Badge>
            )}
            {/* State 3: portal NDA sent/viewed, awaiting signature */}
            {!ndaAccepted && ndaDoc && (ndaDoc.status === 'sent' || ndaDoc.status === 'viewed') && !ndaIsOffline && (
              <div className="space-y-3">
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  Awaiting signature
                </Badge>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={ndaLoading} onClick={() => downloadWord('nda', setNdaLoading)}>
                    {ndaLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                    Download Word
                  </Button>
                  {!showNdaSwitchConfirm && (
                    <Button size="sm" variant="ghost" onClick={() => setShowNdaSwitchConfirm(true)}>
                      Switch to Offline
                    </Button>
                  )}
                </div>
                {showNdaSwitchConfirm && (
                  <div className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
                    <p className="text-sm">This will withdraw the portal NDA.</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="destructive" onClick={async () => {
                        await apiRequest('POST', `/api/v2/deal-documents/${ndaDoc.id}/withdraw`, {});
                        queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/company', targetCompanyId] });
                        setShowNdaSwitchConfirm(false);
                      }}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowNdaSwitchConfirm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* State 4: offline NDA downloaded/draft, needs to be marked as sent */}
            {!ndaAccepted && ndaDoc && ndaIsOffline && (ndaDoc.status === 'draft' || ndaDoc.status === 'downloaded') && (
              <div className="space-y-3">
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                  Downloaded
                </Badge>
                {!showNdaSentConfirm && (
                  <Button size="sm" variant="default" onClick={() => setShowNdaSentConfirm(true)}>
                    Mark as Sent
                  </Button>
                )}
                {showNdaSentConfirm && (
                  <div className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ndaSentDate" className="text-xs">Date sent</Label>
                      <Input
                        id="ndaSentDate"
                        type="date"
                        className="h-8 text-sm"
                        value={ndaConfirmDate}
                        onChange={e => setNdaConfirmDate(e.target.value)}
                      />
                    </div>
                    <Textarea
                      placeholder="Optional notes"
                      className="text-sm min-h-[60px]"
                      value={ndaConfirmNotes}
                      onChange={e => setNdaConfirmNotes(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={async () => {
                        await apiRequest('POST', `/api/v2/deal-documents/${ndaDoc.id}/manual-status`, {
                          status: 'sent',
                          confirmedAt: ndaConfirmDate,
                          notes: ndaConfirmNotes || undefined,
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/company', targetCompanyId] });
                        setShowNdaSentConfirm(false);
                        setNdaConfirmNotes('');
                      }}>
                        Confirm Sent
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowNdaSentConfirm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* State 5: offline NDA sent, awaiting response */}
            {!ndaAccepted && ndaDoc && ndaIsOffline && ndaDoc.status === 'sent' && (
              <div className="space-y-3">
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                  Sent
                </Badge>
                {!showNdaResponseConfirm && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="text-green-700 dark:text-green-300 border-green-300 dark:border-green-700" onClick={() => setShowNdaResponseConfirm('accepted')}>
                      Accepted
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700" onClick={() => setShowNdaResponseConfirm('rejected')}>
                      Rejected
                    </Button>
                    <Button size="sm" variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700" onClick={() => setShowNdaResponseConfirm('countered')}>
                      Countered
                    </Button>
                  </div>
                )}
                {showNdaResponseConfirm && (
                  <div className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
                    <p className="text-sm font-medium capitalize">{showNdaResponseConfirm}</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="ndaResponseDate" className="text-xs">Date</Label>
                      <Input
                        id="ndaResponseDate"
                        type="date"
                        className="h-8 text-sm"
                        value={ndaConfirmDate}
                        onChange={e => setNdaConfirmDate(e.target.value)}
                      />
                    </div>
                    <Textarea
                      placeholder="Optional notes"
                      className="text-sm min-h-[60px]"
                      value={ndaConfirmNotes}
                      onChange={e => setNdaConfirmNotes(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={async () => {
                        await apiRequest('POST', `/api/v2/deal-documents/${ndaDoc.id}/manual-status`, {
                          status: showNdaResponseConfirm,
                          confirmedAt: ndaConfirmDate,
                          notes: ndaConfirmNotes || undefined,
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/company', targetCompanyId] });
                        setShowNdaResponseConfirm(null);
                        setNdaConfirmNotes('');
                      }}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowNdaResponseConfirm(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* State 6: no NDA document at all */}
            {!ndaDoc && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default" disabled title="Use the Seller Portal tab to send the NDA">
                  <Send className="h-3 w-3 mr-1" />
                  Send via Portal
                </Button>
                <Button size="sm" variant="outline" disabled={ndaLoading} onClick={() => downloadWord('nda', setNdaLoading)}>
                  {ndaLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                  Download Word
                </Button>
              </div>
            )}
            {!ndaAccepted && (
              <p className="text-xs text-muted-foreground">Once signed, return to this section to record the outcome.</p>
            )}
          </CardContent>
        </Card>

        {/* PROMPT 3 */}
        <div>{/* Offer Letter card — to be built in Prompt 3 */}</div>

        {/* PROMPT 4 */}
        <div>{/* Heads of Terms card — to be built in Prompt 4 */}</div>

        {docTypes.map(({ key, label, icon: Icon }) => {
          const docs = byType[key];
          if (!docs || docs.length === 0) return null;
          return (
            <DocumentRow 
              key={key} 
              label={label} 
              icon={Icon} 
              documents={docs}
              targetCompanyId={targetCompanyId}
            />
          );
        })}

        {/* TODO Stage 4: Gate hotBuilder advanced features for Expert+ once builder is complete. Standard HoT available to all tiers. */}
        {showGenerateHotButton && (
            <div className="rounded-lg border border-dashed border-border p-3 bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileCheck className="h-5 w-5 text-muted-foreground/70" />
                  <div>
                    <p className="font-medium text-sm text-muted-foreground">Heads of Terms</p>
                    <p className="text-xs text-muted-foreground/70">Offer accepted — ready to generate HoT</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setShowHotDialog(true)}>
                  Generate HoT
                </Button>
              </div>
            </div>
        )}
      </CardContent>

      <HoTConfigDialog
        open={showHotDialog}
        onClose={() => setShowHotDialog(false)}
        targetCompanyId={targetCompanyId}
      />
    </Card>
  );
}

function HoTConfigDialog({ open, onClose, targetCompanyId }: {
  open: boolean;
  onClose: () => void;
  targetCompanyId: number;
}) {
  const [exclusivityPeriodDays, setExclusivityPeriodDays] = useState(90);
  const [nonCompetePeriodYears, setNonCompetePeriodYears] = useState(2);
  const [nonSolicitPeriodYears, setNonSolicitPeriodYears] = useState(2);
  const [warrantyClaimPeriodMonths, setWarrantyClaimPeriodMonths] = useState(18);
  const [warrantyMinClaim, setWarrantyMinClaim] = useState(5000);
  const [targetCompletionWeeks, setTargetCompletionWeeks] = useState(12);
  const [additionalConditions, setAdditionalConditions] = useState('');
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);
  const [generatedDocId, setGeneratedDocId] = useState<number | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const hotTerms: Record<string, any> = {
        exclusivityPeriodDays,
        nonCompetePeriodYears,
        nonSolicitPeriodYears,
        warrantyClaimPeriodMonths,
        warrantyMinClaim,
        targetCompletionWeeks,
      };
      if (additionalConditions.trim()) {
        hotTerms.additionalConditions = additionalConditions.trim();
      }
      const res = await apiRequest('POST', '/api/v2/deal-documents/generate-hot', {
        targetCompanyId,
        hotTerms,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/company', targetCompanyId] });
      setError('');
      const docId = data?.id ?? data?.data?.id ?? null;
      setGeneratedDocId(docId);
      setGenerated(true);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to generate Heads of Terms');
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await apiRequest('POST', `/api/v2/deal-documents/${docId}/send`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/company', targetCompanyId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to send document');
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) {
        setGenerated(false);
        setGeneratedDocId(null);
        setError('');
        onClose();
      }
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure Heads of Terms</DialogTitle>
          <DialogDescription>
            Set the key terms for the Heads of Terms document. These will be merged with the accepted offer details.
          </DialogDescription>
        </DialogHeader>

        {generated ? (
          <div className="space-y-5 pt-2">
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 px-4 py-4">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Heads of Terms generated</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                  Ready to send to the seller. This will email the portal contact directly.
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={sendMutation.isPending}>
                I'll send later
              </Button>
              <Button
                onClick={() => generatedDocId && sendMutation.mutate(generatedDocId)}
                disabled={!generatedDocId || sendMutation.isPending}
              >
                {sendMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send to Seller Now
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="exclusivity">Exclusivity Period (days)</Label>
                <Input id="exclusivity" type="number" value={exclusivityPeriodDays} onChange={(e) => setExclusivityPeriodDays(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nonCompete">Non-Compete Period (years)</Label>
                <Input id="nonCompete" type="number" value={nonCompetePeriodYears} onChange={(e) => setNonCompetePeriodYears(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nonSolicit">Non-Solicitation (years)</Label>
                <Input id="nonSolicit" type="number" value={nonSolicitPeriodYears} onChange={(e) => setNonSolicitPeriodYears(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="warranty">Warranty Claim Period (months)</Label>
                <Input id="warranty" type="number" value={warrantyClaimPeriodMonths} onChange={(e) => setWarrantyClaimPeriodMonths(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minClaim">Minimum Warranty Claim (£)</Label>
                <Input id="minClaim" type="number" value={warrantyMinClaim} onChange={(e) => setWarrantyMinClaim(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="completion">Target Completion (weeks)</Label>
                <Input id="completion" type="number" value={targetCompletionWeeks} onChange={(e) => setTargetCompletionWeeks(Number(e.target.value))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conditions">Additional Conditions</Label>
              <Textarea
                id="conditions"
                value={additionalConditions}
                onChange={(e) => setAdditionalConditions(e.target.value)}
                placeholder="Any additional conditions to include..."
                rows={3}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={generateMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                {generateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Heads of Terms
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DocumentRow({ label, icon: Icon, documents, targetCompanyId }: {
  label: string;
  icon: any;
  documents: DealDocument[];
  targetCompanyId: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<DealDocument | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [confirmDate, setConfirmDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [confirmNotes, setConfirmNotes] = useState('');
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

  const latest = documents
    .filter(d => d.status !== 'superseded')
    .sort((a, b) => b.version - a.version)[0] || documents[0];

  const { data: fullDoc } = useQuery<DealDocument>({
    queryKey: ['/api/v2/deal-documents', latest.id],
    queryFn: async () => {
      const res = await fetch(`/api/v2/deal-documents/${latest.id}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    enabled: expanded,
  });

  const sendMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await apiRequest('POST', `/api/v2/deal-documents/${docId}/send`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/company', targetCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents', latest.id] });
    },
  });

  const manualStatusMutation = useMutation({
    mutationFn: async ({ status, confirmedAt, notes }: { status: string; confirmedAt: string; notes: string }) => {
      const res = await apiRequest('POST', `/api/v2/deal-documents/${latest.id}/manual-status`, {
        status,
        confirmedAt,
        notes: notes || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/company', targetCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents', latest.id] });
      setShowConfirm(false);
      setPendingStatus('');
      setConfirmNotes('');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/v2/deal-documents/${latest.id}/withdraw`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/company', targetCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents', latest.id] });
      setShowSwitchConfirm(false);
    },
  });

  const openConfirm = (status: string) => {
    setPendingStatus(status);
    setConfirmDate(new Date().toISOString().slice(0, 10));
    setConfirmNotes('');
    setShowConfirm(true);
  };

  const displayDoc = fullDoc || latest;
  const responses = displayDoc.responses || [];
  const latestResponse = responses[0];

  const status = statusConfig[latest.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  const showSendButton = latest.status === 'draft' && !!latest.generatedFileUrl && latest.deliveryMethod !== 'offline';
  const isOffline = latest.deliveryMethod === 'offline';

  return (
    <>
      <div className={`rounded-lg border p-3 ${status.bgColour}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">
                {label}
                {latest.version > 1 && <span className="text-muted-foreground/70 ml-1">v{latest.version}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {latest.sentAt 
                  ? `Sent ${new Date(latest.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : `Created ${new Date(latest.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.variant} className="flex items-center gap-1">
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
            {isOffline && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Offline
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {latestResponse && (
              <div className={`rounded p-3 ${
                latestResponse.responseType === 'accepted' ? 'bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-800' :
                latestResponse.responseType === 'rejected' ? 'bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-800' :
                'bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {latestResponse.responseType === 'accepted' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {latestResponse.responseType === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                  <span className="font-medium text-sm capitalize">{latestResponse.responseType}</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{latestResponse.respondentName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(latestResponse.createdAt).toLocaleDateString('en-GB', { 
                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}</span>
                  </div>
                  {latestResponse.comments && (
                    <div className="mt-2 p-2 bg-card rounded text-foreground">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Comments:</p>
                      <p className="text-sm whitespace-pre-wrap">{latestResponse.comments}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              {latest.sentAt && (
                <div className="flex items-center gap-2">
                  <Send className="h-3 w-3" /> Sent: {new Date(latest.sentAt).toLocaleString('en-GB')}
                </div>
              )}
              {latest.viewedAt && (
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3" /> First viewed: {new Date(latest.viewedAt).toLocaleString('en-GB')}
                </div>
              )}
              {latest.respondedAt && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" /> Responded: {new Date(latest.respondedAt).toLocaleString('en-GB')}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewingDoc(displayDoc)}>
                <Eye className="h-3 w-3 mr-1" /> View Document
              </Button>
              {latest.generatedFileUrl && (
                <Button variant="outline" size="sm" disabled={downloading} onClick={async () => {
                  setDownloading(true);
                  try {
                    const res = await fetch(`/api/v2/deal-documents/download/${latest.id}`);
                    if (!res.ok) throw new Error();
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${label.replace(/\s+/g, '_')}_v${latest.version}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } catch {
                  } finally {
                    setDownloading(false);
                  }
                }}>
                  {downloading
                    ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>
                    : <><Download className="h-3 w-3 mr-1" /> Download</>
                  }
                </Button>
              )}
              {showSendButton && (
                <Button size="sm" onClick={() => sendMutation.mutate(latest.id)} disabled={sendMutation.isPending}>
                  {sendMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                  Send to Seller
                </Button>
              )}
              {latest.deliveryMethod !== 'offline' && (latest.status === 'sent' || latest.status === 'viewed') && !showSwitchConfirm && (
                <div className="flex flex-col gap-0.5">
                  <Button size="sm" variant="ghost" onClick={() => setShowSwitchConfirm(true)}>
                    Switch to Offline
                  </Button>
                  <span className="text-xs text-muted-foreground text-center">Withdraw portal version and download as Word instead</span>
                </div>
              )}
              {isOffline && (latest.status === 'draft' || latest.status === 'downloaded') && !showConfirm && (
                <Button size="sm" variant="outline" onClick={() => openConfirm('sent')}>
                  Mark as Sent
                </Button>
              )}
              {isOffline && latest.status === 'sent' && !showConfirm && (
                <>
                  <Button size="sm" variant="outline" className="text-green-700 dark:text-green-300 border-green-300 dark:border-green-700" onClick={() => openConfirm('accepted')}>
                    Accepted
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700" onClick={() => openConfirm('rejected')}>
                    Rejected
                  </Button>
                  <Button size="sm" variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700" onClick={() => openConfirm('countered')}>
                    Countered
                  </Button>
                </>
              )}
            </div>

            {showSwitchConfirm && (
              <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
                <p className="text-sm font-medium">Are you sure? This will withdraw the portal version.</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => withdrawMutation.mutate()}
                    disabled={withdrawMutation.isPending}
                  >
                    {withdrawMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    Confirm
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowSwitchConfirm(false)} disabled={withdrawMutation.isPending}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {showConfirm && (
              <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-3">
                <p className="text-sm font-medium capitalize">Confirm: {pendingStatus}</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={confirmDate} onChange={e => setConfirmDate(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={confirmNotes}
                    onChange={e => setConfirmNotes(e.target.value)}
                    placeholder="Optional notes e.g. sent by email on 3 April"
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={manualStatusMutation.isPending}
                    onClick={() => manualStatusMutation.mutate({ status: pendingStatus, confirmedAt: confirmDate, notes: confirmNotes })}
                  >
                    {manualStatusMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {pendingStatus === 'sent' ? 'Confirm Sent' : 'Confirm'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowConfirm(false); setPendingStatus(''); setConfirmNotes(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {documents.length > 1 && (
              <div className="text-xs text-muted-foreground/70 pt-2 border-t">
                {documents.length} version{documents.length > 1 ? 's' : ''} — latest is v{latest.version}
              </div>
            )}
          </div>
        )}
      </div>

      <DocumentViewerDialog 
        document={viewingDoc} 
        onClose={() => setViewingDoc(null)} 
      />
    </>
  );
}

function DocumentViewerDialog({ document, onClose }: { document: DealDocument | null; onClose: () => void }) {
  const { data: htmlData, isLoading } = useQuery({
    queryKey: ['document-html-preview', document?.id],
    queryFn: async () => {
      const res = await fetch(`/api/v2/deal-documents/${document!.id}/html`);
      if (!res.ok) throw new Error('Failed to load document');
      return res.json();
    },
    enabled: !!document,
  });

  return (
    <Dialog open={!!document} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {document?.documentType === 'nda' && 'Non-Disclosure Agreement'}
            {document?.documentType === 'offer_letter' && 'Offer Letter'}
            {document?.documentType === 'heads_of_terms' && 'Heads of Terms'}
            {document?.version && document.version > 1 && ` (v${document.version})`}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground/70">Loading document...</div>
          ) : (
            <div className="bg-white text-gray-900 rounded-lg shadow-sm p-6">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: htmlData?.html || '<p>Unable to load document.</p>' }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
