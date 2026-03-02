import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Send, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface WebhookLog {
  id: number;
  timestamp: string;
  targetCompanyId: number | null;
  webhookUrl: string;
  payload: any;
  response: any;
  status: string;
  processingTime: number;
}

interface WebhookConfig {
  webhookUrl: string | null;
  responseUrl: string;
}

export default function WebhookTest() {
  const [testWebsite, setTestWebsite] = useState("");
  const [testWebhookUrl, setTestWebhookUrl] = useState("");
  const { toast } = useToast();

  // Fetch webhook logs
  const { data: webhookLogs = [], isLoading: logsLoading } = useQuery<WebhookLog[]>({
    queryKey: ["/api/webhook/logs"],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Fetch webhook configuration
  const { data: webhookConfig } = useQuery<WebhookConfig>({
    queryKey: ["/api/webhook/config"],
  });

  // Send test webhook
  const testWebhookMutation = useMutation({
    mutationFn: async (data: { website: string; webhookUrl?: string }) => {
      const response = await apiRequest("POST", "/api/webhook/test", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Test webhook sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/webhook/logs"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to send test webhook";
      toast({ 
        title: "Webhook Test Failed", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  // Simulate webhook response
  const simulateResponseMutation = useMutation({
    mutationFn: async (data: { targetCompanyId: number; output: string }) => {
      const response = await apiRequest("POST", "/api/webhook/website-analysis", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Webhook response simulated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/webhook/logs"] });
    },
    onError: () => {
      toast({ title: "Failed to simulate webhook response", variant: "destructive" });
    },
  });

  const handleTestWebhook = () => {
    if (!testWebsite.trim()) {
      toast({ title: "Please enter a website URL", variant: "destructive" });
      return;
    }
    
    // Basic URL validation
    try {
      new URL(testWebsite);
    } catch {
      toast({ 
        title: "Invalid URL format", 
        description: "Please enter a valid URL starting with http:// or https://",
        variant: "destructive" 
      });
      return;
    }

    if (testWebhookUrl && testWebhookUrl.trim()) {
      try {
        new URL(testWebhookUrl);
      } catch {
        toast({ 
          title: "Invalid webhook URL format", 
          description: "Please enter a valid webhook URL starting with http:// or https://",
          variant: "destructive" 
        });
        return;
      }
    }

    testWebhookMutation.mutate({
      website: testWebsite.trim(),
      webhookUrl: testWebhookUrl.trim() || undefined,
    });
  };

  const handleSimulateResponse = (targetCompanyId: number) => {
    const sampleOutput = `# Website Analysis Report

## 1. Company Overview
This is a sample analysis generated for testing purposes.

## 2. Key Findings
- Business model: Technology services
- Revenue estimate: $1M - $5M annually
- Employee count: 10-50 employees

## 3. Strategic Fit
High potential acquisition target with complementary technology stack.`;

    simulateResponseMutation.mutate({
      targetCompanyId,
      output: sampleOutput,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Webhook Testing Tool</h1>
        <p className="text-muted-foreground">
          Test your external webhook integration and verify responses
        </p>
      </div>

      {/* Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle>Current Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Webhook URL</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 p-2 bg-muted rounded text-sm">
                {webhookConfig?.webhookUrl || "Not configured (using WEBHOOK_URL env var)"}
              </code>
              {webhookConfig?.webhookUrl && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookConfig.webhookUrl!)}
                  data-testid="button-copy-webhook-url"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Response Endpoint</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 p-2 bg-muted rounded text-sm">
                {webhookConfig?.responseUrl || `${window.location.origin}/api/webhook/website-analysis`}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookConfig?.responseUrl ?? `${window.location.origin}/api/webhook/website-analysis`)}
                data-testid="button-copy-response-url"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Webhook */}
      <Card>
        <CardHeader>
          <CardTitle>Send Test Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Website URL</label>
            <Input
              value={testWebsite}
              onChange={(e) => setTestWebsite(e.target.value)}
              placeholder="https://example.com"
              data-testid="input-test-website"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Custom Webhook URL (optional)</label>
            <Input
              value={testWebhookUrl}
              onChange={(e) => setTestWebhookUrl(e.target.value)}
              placeholder="Leave empty to use default WEBHOOK_URL"
              data-testid="input-custom-webhook-url"
            />
          </div>
          <Button
            onClick={handleTestWebhook}
            disabled={testWebhookMutation.isPending}
            data-testid="button-send-test-webhook"
          >
            {testWebhookMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Test Webhook
          </Button>
        </CardContent>
      </Card>

      {/* Webhook Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Recent Webhook Activity
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/webhook/logs"] })}
              disabled={logsLoading}
              data-testid="button-refresh-logs"
            >
              <RefreshCw className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : webhookLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No webhook activity yet. Send a test webhook to see logs here.
            </div>
          ) : (
            <div className="space-y-4">
              {webhookLogs.map((log: WebhookLog) => (
                <div key={log.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <Badge variant={log.status === "success" ? "default" : "destructive"}>
                        {log.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {log.processingTime}ms
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        OUTGOING PAYLOAD
                      </label>
                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                    {log.response && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          WEBHOOK RESPONSE
                        </label>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(log.response, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {log.targetCompanyId && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <span className="text-sm">Target Company ID: {log.targetCompanyId}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSimulateResponse(log.targetCompanyId!)}
                        disabled={simulateResponseMutation.isPending}
                        data-testid={`button-simulate-response-${log.targetCompanyId}`}
                      >
                        Simulate Response
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}