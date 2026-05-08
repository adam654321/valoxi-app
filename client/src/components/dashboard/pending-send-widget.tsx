import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Send, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { handleSendResult } from "@/lib/send-result-toast";

interface PendingDoc {
  id: number;
  documentType: string;
  createdAt: string;
  targetCompanyId: number;
  companyName: string;
}

const docTypeLabel: Record<string, string> = {
  heads_of_terms: 'Heads of Terms',
  offer_letter: 'Offer Letter',
  nda: 'NDA',
};

export default function PendingSendWidget() {
  const { toast } = useToast();
  const { data: pending = [], isLoading } = useQuery<PendingDoc[]>({
    queryKey: ['/api/v2/deal-documents/pending-send'],
    select: (response: any) => response?.data || response || [],
    refetchInterval: 60 * 1000,
  });

  const sendMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await apiRequest('POST', `/api/v2/deal-documents/${docId}/send`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deal-documents/pending-send'] });
      handleSendResult(data, toast, 'Document sent to seller');
    },
  });

  if (!isLoading && pending.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-amber-600" />
          Ready to Send
          {pending.length > 0 && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ml-1">
              {pending.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              These documents have been generated but not yet sent to the seller.
            </p>
            {pending.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <div className="flex-1 min-w-0">
                  <Link href={`/target-companies/${doc.targetCompanyId}`}>
                    <p className="font-medium text-sm hover:underline cursor-pointer truncate">
                      {doc.companyName}
                    </p>
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {docTypeLabel[doc.documentType] || doc.documentType} • Generated {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => sendMutation.mutate(doc.id)}
                  disabled={sendMutation.isPending && sendMutation.variables === doc.id}
                  className="ml-3 shrink-0"
                >
                  {sendMutation.isPending && sendMutation.variables === doc.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Send className="h-3 w-3 mr-1" />
                  }
                  Send
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
