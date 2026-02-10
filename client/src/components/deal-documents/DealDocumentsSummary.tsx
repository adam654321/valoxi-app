import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Shield, Send, FileCheck,
  CheckCircle, XCircle, MessageSquare, Clock, AlertCircle
} from 'lucide-react';

interface DealDocumentsSummaryProps {
  targetCompanyId: number;
}

export default function DealDocumentsSummary({ targetCompanyId }: DealDocumentsSummaryProps) {
  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/v2/deal-documents/company', targetCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/v2/deal-documents/company/${targetCompanyId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return null;
  if (!documents || documents.length === 0) return null;

  const byType: Record<string, any[]> = {};
  for (const doc of documents) {
    if (!byType[doc.documentType]) byType[doc.documentType] = [];
    byType[doc.documentType].push(doc);
  }

  const docTypes = [
    { key: 'nda', label: 'Non-Disclosure Agreement', icon: Shield },
    { key: 'offer_letter', label: 'Offer Letter', icon: Send },
    { key: 'heads_of_terms', label: 'Heads of Terms', icon: FileCheck },
  ];

  const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    draft: { label: 'Draft', variant: 'outline', icon: FileText },
    sent: { label: 'Sent', variant: 'outline', icon: Clock },
    viewed: { label: 'Viewed', variant: 'outline', icon: Clock },
    accepted: { label: 'Accepted', variant: 'default', icon: CheckCircle },
    rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
    countered: { label: 'Countered', variant: 'secondary', icon: MessageSquare },
    withdrawn: { label: 'Withdrawn', variant: 'outline', icon: AlertCircle },
    superseded: { label: 'Superseded', variant: 'outline', icon: Clock },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Deal Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {docTypes.map(({ key, label, icon: Icon }) => {
            const docs = byType[key];
            if (!docs || docs.length === 0) return null;

            const latest = docs
              .filter((d: any) => d.status !== 'superseded')
              .sort((a: any, b: any) => b.version - a.version)[0] || docs[0];

            const status = statusConfig[latest.status] || statusConfig.draft;
            const StatusIcon = status.icon;

            return (
              <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-gray-500">
                      {latest.version > 1 ? `v${latest.version} · ` : ''}
                      {latest.sentAt
                        ? `Sent ${new Date(latest.sentAt).toLocaleDateString('en-GB')}`
                        : `Created ${new Date(latest.createdAt).toLocaleDateString('en-GB')}`
                      }
                    </p>
                  </div>
                </div>
                <Badge variant={status.variant} className="flex items-center gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
