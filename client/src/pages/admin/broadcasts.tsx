import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SegmentSummary {
  key: string;
  label: string;
  description: string;
  segmentId: string;
  recipientCountEstimate: number;
}

interface BroadcastHistoryRow {
  id: number;
  composerSessionId: string;
  subject: string;
  segmentKey: string;
  isTest: boolean;
  recipientCountEstimate: number | null;
  resendBroadcastId: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

export default function AdminBroadcasts() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const composerSessionId = useMemo(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID().slice(0, 32);
    }
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }, []);

  const [subject, setSubject] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [segmentKey, setSegmentKey] = useState<string>("");
  const [hasSentTestInSession, setHasSentTestInSession] = useState(false);
  const [confirmRealSendOpen, setConfirmRealSendOpen] = useState(false);

  const segmentsQuery = useQuery<{ success: boolean; data: SegmentSummary[] }>({
    queryKey: ["/api/v2/admin/broadcasts/segments"],
  });

  const historyQuery = useQuery<{ success: boolean; data: BroadcastHistoryRow[] }>({
    queryKey: ["/api/v2/admin/broadcasts/history"],
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { isTest: boolean }) => {
      const res = await apiRequest("POST", "/api/v2/admin/broadcasts/send", {
        subject,
        bodyMarkdown,
        segmentKey,
        isTest: payload.isTest,
        composerSessionId,
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      if (variables.isTest) {
        setHasSentTestInSession(true);
        toast({ title: "Test sent", description: "Check your inbox in test_internal segment." });
      } else {
        toast({ title: "Broadcast sent", description: "Recipients will receive shortly." });
      }
      qc.invalidateQueries({ queryKey: ["/api/v2/admin/broadcasts/history"] });
      setConfirmRealSendOpen(false);
    },
    onError: (err: any) => {
      const message = err?.message || "Send failed";
      toast({ title: "Send failed", description: message, variant: "destructive" });
      setConfirmRealSendOpen(false);
    },
  });

  const segments = segmentsQuery.data?.data ?? [];
  const selectedSegment = segments.find((s) => s.key === segmentKey);
  const history = historyQuery.data?.data ?? [];

  const composerValid = subject.trim().length > 0 && bodyMarkdown.trim().length > 0 && segmentKey.length > 0;
  const canSendTest = composerValid && !sendMutation.isPending;
  const canSendReal = composerValid && hasSentTestInSession && !sendMutation.isPending;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Broadcasts</h1>
        <p className="text-muted-foreground mt-1">
          Compose and send broadcast emails to Valoxi user segments. Always send a test to yourself first.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Composer */}
        <Card>
          <CardHeader>
            <CardTitle>Compose</CardTitle>
            <CardDescription>Markdown supported. The Valoxi brand template wraps your content automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. New in Valoxi: Help Center launch"
                maxLength={255}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Body (markdown)</label>
              <Textarea
                value={bodyMarkdown}
                onChange={(e) => setBodyMarkdown(e.target.value)}
                placeholder="Write your message. Markdown is supported: **bold**, [links](https://...), - lists, etc."
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Segment</label>
              <Select value={segmentKey} onValueChange={setSegmentKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose recipient segment..." />
                </SelectTrigger>
                <SelectContent>
                  {segments.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label} (~{s.recipientCountEstimate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSegment && (
                <p className="text-xs text-muted-foreground mt-1">{selectedSegment.description}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={() => sendMutation.mutate({ isTest: true })}
                disabled={!canSendTest}
                variant="outline"
                className="flex-1"
              >
                {sendMutation.isPending && sendMutation.variables?.isTest ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send test to test_internal
              </Button>
              <Button
                onClick={() => setConfirmRealSendOpen(true)}
                disabled={!canSendReal}
                className="flex-1"
              >
                {hasSentTestInSession ? (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                Send to {selectedSegment?.label || "segment"}
              </Button>
            </div>
            {!hasSentTestInSession && (
              <p className="text-xs text-muted-foreground">
                You must send a test first. Real send unlocks after test confirms.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>How your message will appear inside the Valoxi email template.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-4 bg-card min-h-[400px]">
              {subject && <h3 className="text-lg font-semibold mb-3">{subject}</h3>}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {bodyMarkdown ? (
                  <ReactMarkdown>{bodyMarkdown}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground">Start typing in the composer to see a preview.</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: this is a rough preview. The actual email applies the Valoxi brand template (logo, footer, orange #E05115). Use <code className="bg-muted px-1 rounded text-xs">{"{{first_name}}"}</code> to personalise — test sends substitute your own name; real sends use "there" as a fallback (e.g. "Hi there,").
            </p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent broadcasts</CardTitle>
          <CardDescription>Last 50 sends across all admins.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No broadcasts sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(row.sentAt).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{row.subject}</TableCell>
                    <TableCell>{row.segmentKey}</TableCell>
                    <TableCell>
                      {row.isTest ? <Badge variant="outline">test</Badge> : <Badge>real</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{row.recipientCountEstimate ?? "—"}</TableCell>
                    <TableCell>
                      {row.status === "sent" ? (
                        <Badge variant="secondary">sent</Badge>
                      ) : (
                        <Badge variant="destructive">{row.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation modal */}
      <Dialog open={confirmRealSendOpen} onOpenChange={setConfirmRealSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send broadcast?</DialogTitle>
            <DialogDescription>
              This will send the broadcast to {selectedSegment?.label} (~{selectedSegment?.recipientCountEstimate} recipients).
              You cannot undo this once sent.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
            <div><span className="font-medium">Subject:</span> {subject}</div>
            <div><span className="font-medium">Segment:</span> {selectedSegment?.label}</div>
            <div><span className="font-medium">Recipients:</span> ~{selectedSegment?.recipientCountEstimate}</div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => sendMutation.mutate({ isTest: false })}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Confirm send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
