import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileCheck, CheckCircle, XCircle, Loader2,
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

interface HoTDocument {
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

interface HoTReviewProps {
  documents: HoTDocument[];
  token: string;
  onResponseSubmitted: () => void;
}

export default function HoTReview({ documents, token, onResponseSubmitted }: HoTReviewProps) {
  const latestHoT = documents
    .filter(d => !['withdrawn', 'superseded', 'draft'].includes(d.status))
    .sort((a, b) => b.version - a.version)[0];

  const olderDocs = documents
    .filter(d => d.id !== latestHoT?.id)
    .sort((a, b) => b.version - a.version);

  if (!latestHoT) return null;

  return (
    <div className="space-y-4">
      <HoTCard
        token={token}
        doc={latestHoT}
        isLatest={true}
        onResponseSubmitted={onResponseSubmitted}
      />

      {olderDocs.length > 0 && (
        <VersionHistory docs={olderDocs} />
      )}
    </div>
  );
}

function HoTCard({ token, doc, isLatest, onResponseSubmitted }: {
  token: string;
  doc: HoTDocument;
  isLatest: boolean;
  onResponseSubmitted: () => void;
}) {
  const [showContent, setShowContent] = useState(isLatest);
  const [comments, setComments] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<'accept' | 'reject' | null>(null);
  const { toast } = useToast();

  const canRespond = isLatest && ['sent', 'viewed'].includes(doc.status);

  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ['hot-html', token, doc.id],
    queryFn: async () => {
      const res = await fetch(`/api/v2/public/deal-documents/${token}/${doc.id}/html`);
      if (!res.ok) throw new Error('Failed to load Heads of Terms');
      return res.json();
    },
    enabled: showContent,
  });

  const respondMutation = useMutation({
    mutationFn: async (responseType: 'accepted' | 'rejected') => {
      const res = await fetch(`/api/v2/public/deal-documents/${token}/${doc.id}/respond`, {
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
      const labels: Record<string, string> = {
        accepted: 'Heads of Terms Accepted',
        rejected: 'Heads of Terms Rejected',
      };
      toast({ title: labels[responseType] || 'Response Submitted', description: 'The buyer has been notified.' });
      setComments('');
      setRespondentName('');
      setConfirmDialog(null);
      onResponseSubmitted();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  async function handleDownload() {
    try {
      const response = await fetch(`/api/v2/public/deal-documents/${token}/${doc.id}/download`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Heads_of_Terms_v${doc.version}.docx`;
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
  }[doc.status] || { label: doc.status, variant: 'outline' as const, icon: Clock };

  const StatusIcon = statusBadge.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              Heads of Terms {doc.version > 1 ? `(Revision ${doc.version})` : ''}
            </CardTitle>
            <CardDescription className="mt-1">
              {doc.sentAt
                ? `Received ${new Date(doc.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `Created ${new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
              }
            </CardDescription>
            <p className="text-sm text-muted-foreground mt-2">
              Please review the proposed Heads of Terms below. This document outlines the key commercial terms for the acquisition.
            </p>
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
              <span className="ml-2 text-muted-foreground">Loading Heads of Terms...</span>
            </div>
          ) : (
            <div className="border rounded-lg p-6 bg-card">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: contentData?.html || '<p>Unable to load document content.</p>' }}
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download .docx
            </Button>
          </div>

          {doc.responses && doc.responses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Previous Responses</h4>
              {doc.responses.map((r) => (
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
                Accept Heads of Terms
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmDialog('reject')}
                className="flex-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Heads of Terms
              </Button>
            </div>
          )}

          <AlertDialog open={confirmDialog === 'accept'} onOpenChange={(open) => !open && setConfirmDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Accept Heads of Terms</AlertDialogTitle>
                <AlertDialogDescription>
                  By accepting these Heads of Terms, you agree to the proposed commercial terms including the
                  exclusivity period, restrictive covenants, and transaction timetable. The binding provisions
                  (exclusivity, confidentiality, and costs) will take immediate effect.
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
                  Accept Heads of Terms
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={confirmDialog === 'reject'} onOpenChange={(open) => !open && setConfirmDialog(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject Heads of Terms</AlertDialogTitle>
                <AlertDialogDescription>
                  Please provide your name and the reason for rejection. The buyer may wish to discuss and reissue revised terms.
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
                    placeholder="Please explain why you're rejecting these terms so we can address your concerns..."
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
                  Reject Heads of Terms
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      )}
    </Card>
  );
}

function VersionHistory({ docs }: { docs: HoTDocument[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
        {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
        {docs.length} previous version{docs.length > 1 ? 's' : ''}
      </Button>
      {expanded && (
        <div className="space-y-2 mt-2 ml-4 border-l-2 border-border pl-4">
          {docs.map(d => (
            <div key={d.id} className="text-sm text-muted-foreground py-2">
              <span className="font-medium">v{d.version}</span>
              {' — '}
              <span>{d.status}</span>
              {' — '}
              <span>{new Date(d.sentAt || d.createdAt).toLocaleDateString('en-GB')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
