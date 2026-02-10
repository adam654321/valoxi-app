import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, Shield, Send, FileCheck, 
  CheckCircle, XCircle, Clock, AlertCircle,
  ChevronDown, ChevronUp, Download, Eye, User, Calendar
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

const statusConfig: Record<string, { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary'; icon: any; bgColour: string }> = {
  draft: { label: 'Draft', variant: 'outline', icon: FileText, bgColour: 'bg-gray-50' },
  sent: { label: 'Sent — Awaiting Response', variant: 'outline', icon: Clock, bgColour: 'bg-blue-50' },
  viewed: { label: 'Viewed — Awaiting Response', variant: 'outline', icon: Eye, bgColour: 'bg-blue-50' },
  accepted: { label: 'Accepted', variant: 'default', icon: CheckCircle, bgColour: 'bg-green-50' },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle, bgColour: 'bg-red-50' },
  withdrawn: { label: 'Withdrawn', variant: 'outline', icon: AlertCircle, bgColour: 'bg-gray-50' },
  superseded: { label: 'Superseded', variant: 'outline', icon: Clock, bgColour: 'bg-gray-50' },
};

export default function DealDocumentsSummary({ targetCompanyId }: DealDocumentsSummaryProps) {
  const { data: documents, isLoading } = useQuery<DealDocument[]>({
    queryKey: ['/api/v2/deal-documents/company', targetCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/v2/deal-documents/company/${targetCompanyId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return null;
  if (!documents || documents.length === 0) return null;

  const byType: Record<string, DealDocument[]> = {};
  for (const doc of documents) {
    if (!byType[doc.documentType]) byType[doc.documentType] = [];
    byType[doc.documentType].push(doc);
  }

  const docTypes = [
    { key: 'nda', label: 'Non-Disclosure Agreement', icon: Shield },
    { key: 'offer_letter', label: 'Offer Letter', icon: Send },
    { key: 'heads_of_terms', label: 'Heads of Terms', icon: FileCheck },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Deal Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {docTypes.map(({ key, label, icon: Icon }) => {
          const docs = byType[key];
          if (!docs || docs.length === 0) return null;
          return (
            <DocumentRow 
              key={key} 
              label={label} 
              icon={Icon} 
              documents={docs}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

function DocumentRow({ label, icon: Icon, documents }: {
  label: string;
  icon: any;
  documents: DealDocument[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<DealDocument | null>(null);

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

  const displayDoc = fullDoc || latest;
  const responses = displayDoc.responses || [];
  const latestResponse = responses[0];

  const status = statusConfig[latest.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <>
      <div className={`rounded-lg border p-3 ${status.bgColour}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-gray-500" />
            <div>
              <p className="font-medium text-sm">
                {label}
                {latest.version > 1 && <span className="text-gray-400 ml-1">v{latest.version}</span>}
              </p>
              <p className="text-xs text-gray-500">
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
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {latestResponse && (
              <div className={`rounded p-3 ${
                latestResponse.responseType === 'accepted' ? 'bg-green-100 border border-green-200' :
                latestResponse.responseType === 'rejected' ? 'bg-red-100 border border-red-200' :
                'bg-amber-100 border border-amber-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {latestResponse.responseType === 'accepted' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {latestResponse.responseType === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                  <span className="font-medium text-sm capitalize">{latestResponse.responseType}</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="h-3 w-3" />
                    <span>{latestResponse.respondentName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(latestResponse.createdAt).toLocaleDateString('en-GB', { 
                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}</span>
                  </div>
                  {latestResponse.comments && (
                    <div className="mt-2 p-2 bg-white rounded text-gray-700">
                      <p className="text-xs font-medium text-gray-500 mb-1">Comments:</p>
                      <p className="text-sm whitespace-pre-wrap">{latestResponse.comments}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 space-y-1">
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
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    const res = await fetch(`/api/v2/deal-documents/download/${latest.id}`);
                    if (!res.ok) throw new Error();
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${label.replace(/\s+/g, '_')}_v${latest.version}.docx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } catch {
                  }
                }}>
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
              )}
            </div>

            {documents.length > 1 && (
              <div className="text-xs text-gray-400 pt-2 border-t">
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
            <div className="flex items-center justify-center py-10 text-gray-400">Loading document...</div>
          ) : (
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlData?.html || '<p>Unable to load document.</p>' }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
