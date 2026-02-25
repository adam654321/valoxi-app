import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText, CheckCircle, XCircle, Loader2,
  Download, ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface OfferDocument {
  id: number;
  documentType: string;
  status: string;
  version: number;
  createdAt: string;
  sentAt: string;
  viewedAt: string | null;
  respondedAt: string | null;
  generatedFileUrl: string | null;
  documentData: any;
  responses?: Array<{
    id: number;
    responseType: string;
    comments: string | null;
    respondentName: string;
    createdAt: string;
  }>;
}

interface OfferReviewProps {
  token: string;
  offers: OfferDocument[];
  onResponseSubmitted: () => void;
}

export default function OfferReview({ token, offers, onResponseSubmitted }: OfferReviewProps) {
  const latestOffer = offers
    .filter(o => !['withdrawn', 'superseded', 'draft'].includes(o.status))
    .sort((a, b) => b.version - a.version)[0];

  const olderOffers = offers
    .filter(o => o.id !== latestOffer?.id)
    .sort((a, b) => b.version - a.version);

  if (!latestOffer) return null;

  return (
    <div className="space-y-4">
      <OfferCard
        token={token}
        offer={latestOffer}
        isLatest={true}
        onResponseSubmitted={onResponseSubmitted}
      />

      {olderOffers.length > 0 && (
        <VersionHistory offers={olderOffers} token={token} />
      )}
    </div>
  );
}

function OfferCard({ token, offer, isLatest, onResponseSubmitted }: {
  token: string;
  offer: OfferDocument;
  isLatest: boolean;
  onResponseSubmitted: () => void;
}) {
  const [showContent, setShowContent] = useState(isLatest);
  const [comments, setComments] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<'accept' | 'reject' | null>(null);
  const { toast } = useToast();

  const canRespond = isLatest && ['sent', 'viewed'].includes(offer.status);

  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ['offer-html', token, offer.id],
    queryFn: async () => {
      const res = await fetch(`/api/v2/public/deal-documents/${token}/${offer.id}/html`);
      if (!res.ok) throw new Error('Failed to load offer');
      return res.json();
    },
    enabled: showContent,
  });

  const respondMutation = useMutation({
    mutationFn: async (responseType: 'accepted' | 'rejected' | 'countered') => {
      const res = await fetch(`/api/v2/public/deal-documents/${token}/${offer.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseType,
          respondentName: respondentName.trim(),
          comments: comments.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to submit response');
      }
      return res.json();
    },
    onSuccess: (_, responseType) => {
      const labels: Record<string, string> = { accepted: 'Offer Accepted', rejected: 'Offer Rejected' };
      toast({ title: labels[responseType] || 'Response Submitted', description: 'The buyer has been notified.' });
      setComments('');
      setRespondentName('');
      onResponseSubmitted();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  async function handleDownload() {
    try {
      const response = await fetch(`/api/v2/public/deal-documents/${token}/${offer.id}/download`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Offer_Letter_v${offer.version}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  }

  const statusBadge = {
    sent: { label: 'Awaiting Response', variant: 'outline' as const, icon: Clock },
    viewed: { label: 'Awaiting Response', variant: 'outline' as const, icon: Clock },
    accepted: { label: 'Accepted', variant: 'default' as const, icon: CheckCircle },
    rejected: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
    superseded: { label: 'Superseded', variant: 'secondary' as const, icon: Clock },
  }[offer.status] || { label: offer.status, variant: 'outline' as const, icon: Clock };

  const StatusIcon = statusBadge.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Offer Letter {offer.version > 1 ? `(Revision ${offer.version})` : ''}
            </CardTitle>
            <CardDescription className="mt-1">
              Received {new Date(offer.sentAt).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusBadge.variant}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusBadge.label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setShowContent(!showContent)}>
              {showContent ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {showContent && (
        <CardContent className="space-y-4">
          {contentLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
              <span className="ml-2 text-muted-foreground">Loading offer details...</span>
            </div>
          ) : (
            <div className="border rounded-lg p-6 bg-card">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: contentData?.html || '<p>Unable to load offer content.</p>' }}
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download .docx
            </Button>
          </div>

          {offer.responses && offer.responses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Previous Responses</h4>
              {offer.responses.map((r) => (
                <div key={r.id} className="bg-muted rounded p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={r.responseType === 'accepted' ? 'default' : r.responseType === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                      {r.responseType}
                    </Badge>
                    <span className="text-muted-foreground">by {r.respondentName}</span>
                    <span className="text-muted-foreground/70">
                      {new Date(r.createdAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  {r.comments && <p className="text-muted-foreground mt-1">{r.comments}</p>}
                </div>
              ))}
            </div>
          )}

          {canRespond && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => setConfirmDialog('accept')}
                className="bg-green-600 hover:bg-green-700 flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept Offer
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmDialog('reject')}
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Offer
              </Button>
            </div>
          )}

          <AlertDialog open={confirmDialog === 'accept'} onOpenChange={(open) => !open && setConfirmDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Accept Offer</AlertDialogTitle>
                <AlertDialogDescription>
                  By accepting this offer, you agree to the terms outlined in the offer letter.
                  The buyer will be notified and will proceed with preparing Heads of Terms.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <label className="text-sm font-medium">Your Full Name (as confirmation)</label>
                <Input
                  placeholder="Type your full name"
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => respondMutation.mutate('accepted')}
                  disabled={!respondentName.trim() || respondMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Confirm Acceptance
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={confirmDialog === 'reject'} onOpenChange={(open) => !open && setConfirmDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject Offer</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to reject this offer? You can optionally provide a reason.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Your Full Name</label>
                  <Input
                    placeholder="Type your full name"
                    value={respondentName}
                    onChange={(e) => setRespondentName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Reason for rejection</label>
                  <Textarea
                    placeholder="Please explain why you're rejecting this offer so we can address your concerns..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => respondMutation.mutate('rejected')}
                  disabled={!respondentName.trim() || !comments.trim() || respondMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Confirm Rejection
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      )}
    </Card>
  );
}

function VersionHistory({ offers, token }: { offers: OfferDocument[]; token: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
        {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
        {offers.length} previous version{offers.length > 1 ? 's' : ''}
      </Button>
      {expanded && (
        <div className="space-y-2 mt-2 ml-4 border-l-2 border-border pl-4">
          {offers.map(offer => (
            <div key={offer.id} className="text-sm text-muted-foreground py-2">
              <span className="font-medium">v{offer.version}</span>
              {' — '}
              <span>{offer.status}</span>
              {' — '}
              <span>{new Date(offer.sentAt || offer.createdAt).toLocaleDateString('en-GB')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
