import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Flag, Loader2 } from "lucide-react";

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low", description: "Something looks wrong" },
  { value: "medium", label: "Medium", description: "Feature not working" },
  { value: "high", label: "High", description: "I can't continue" },
] as const;

export function ReportIssueButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  const handleOpen = () => {
    setPageUrl(window.location.href);
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setOpen(true);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/v2/issue-reports", {
        title,
        description: description || undefined,
        severity,
        pageUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Report sent — thank you", description: "We'll look into this as soon as possible." });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send report",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-lg transition-colors hover:bg-indigo-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Flag className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Report an issue</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Severity</Label>
              <div className="grid grid-cols-3 gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSeverity(opt.value)}
                    className={`rounded-md border px-3 py-2 text-center transition-colors ${
                      severity === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">What's the problem? *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                placeholder="What's the problem?"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground text-right">{title.length}/100</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Extra detail (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                placeholder="Any extra detail that would help us fix this faster"
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">{description.length}/500</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Page captured</Label>
              <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1.5 break-all select-all">
                {pageUrl}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!title.trim() || mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Send Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
