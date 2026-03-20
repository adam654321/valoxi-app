import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { MessageSquarePlus, Loader2, CheckCircle2, ImagePlus, X } from "lucide-react";

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug", emoji: "🐛" },
  { value: "suggestion", label: "Suggestion", emoji: "💡" },
  { value: "comment", label: "Comment", emoji: "💬" },
  { value: "other", label: "Other", emoji: "📝" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

type FeedbackType = "bug" | "comment" | "suggestion" | "other";
type Severity = "low" | "medium" | "high" | "critical";

export function BetaFeedbackWidget() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: betaConfig } = useQuery<{ data: { feedbackEnabled: boolean; tierSwitchEnabled: boolean } }>({
    queryKey: ["/api/v2/beta/config"],
    staleTime: 60000,
  });

  const feedbackEnabled = betaConfig?.data?.feedbackEnabled ?? false;

  const handleOpen = () => {
    setPageUrl(window.location.href);
    setType("bug");
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setScreenshot(null);
    setScreenshotPreview(null);
    setShowSuccess(false);
    setOpen(true);
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Screenshots must be under 5 MB.", variant: "destructive" });
      return;
    }

    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const csrfRes = await fetch("/api/v2/auth/csrf", { credentials: "include" });
      const csrfData = await csrfRes.json();
      const csrfToken = csrfData?.data?.csrfToken;

      const formData = new FormData();
      formData.append("type", type);
      if (type === "bug") formData.append("severity", severity);
      formData.append("title", title);
      formData.append("description", description);
      if (pageUrl) formData.append("pageUrl", pageUrl);
      formData.append("pageTitle", document.title);
      if (screenshot) formData.append("screenshot", screenshot);

      const res = await fetch("/api/v2/beta-feedback", {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": csrfToken },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `${res.status}: ${JSON.stringify(data)}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setShowSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setShowSuccess(false);
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send feedback",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!feedbackEnabled) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleOpen}
            className="fixed bottom-20 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-amber-600 dark:hover:bg-amber-700"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Beta Feedback</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold text-foreground">Thank you!</p>
              <p className="text-sm text-muted-foreground">Your feedback has been submitted.</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Beta Feedback</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 overflow-y-auto flex-1">
                <div className="space-y-1.5">
                  <Label className="text-sm">Type</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className={`rounded-md border px-2 py-2 text-center transition-colors ${
                          type === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <p className="text-base">{opt.emoji}</p>
                        <p className="text-xs font-medium">{opt.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {type === "bug" && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Severity</Label>
                    <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-sm">Title *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 255))}
                    placeholder="Brief summary of your feedback"
                    maxLength={255}
                  />
                  <p className="text-xs text-muted-foreground text-right">{title.length}/255</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Description *</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                    placeholder="Describe the issue or suggestion in detail"
                    maxLength={2000}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Screenshot</Label>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add a screenshot if the issue is visual — e.g. layout problems, styling glitches, or error messages on screen.
                  </p>
                  {screenshotPreview ? (
                    <div className="relative rounded-md border border-border overflow-hidden bg-muted/30 dark:bg-muted/20">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="w-full max-h-40 object-contain"
                      />
                      <button
                        type="button"
                        onClick={removeScreenshot}
                        className="absolute top-1.5 right-1.5 rounded-full bg-background/80 backdrop-blur-sm p-1 border border-border hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <p className="text-xs text-muted-foreground px-2 py-1 truncate">
                        {screenshot?.name}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-md border-2 border-dashed border-border px-4 py-4 text-center hover:bg-muted/50 transition-colors dark:hover:bg-muted/30"
                    >
                      <ImagePlus className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">
                        Click to attach a screenshot (PNG, JPEG, WebP — max 5 MB)
                      </p>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleScreenshotChange}
                    className="hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Page captured</Label>
                  <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1.5 break-all select-all dark:bg-muted/50">
                    {pageUrl}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={!title.trim() || !description.trim() || mutation.isPending}
                >
                  {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Send Feedback
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
