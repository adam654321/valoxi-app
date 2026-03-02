import { useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiRequest } from '@/lib/queryClient';

interface ExplainButtonProps {
  metricKey: string;
  metricValue: string | number;
  context: {
    companyName: string;
    sector: string;
    revenue?: number;
    adjustedEbitda?: number;
  };
}

export default function ExplainButton({ metricKey, metricValue, context }: ExplainButtonProps) {
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function fetchExplanation() {
    if (explanation) return;
    setLoading(true);
    setError(false);
    try {
      const res = await apiRequest('POST', '/api/v2/explain/metric', {
        metricKey,
        metricValue,
        context,
      });
      const data = await res.json();
      setExplanation(data.data?.explanation || data.explanation || 'No explanation available.');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && !explanation && !loading) {
      fetchExplanation();
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-full text-muted-foreground hover:text-primary"
          title="What does this mean?"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" side="top">
        {loading && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Generating explanation…</span>
          </div>
        )}
        {error && (
          <p className="text-destructive">Unable to load explanation — please try again</p>
        )}
        {explanation && !loading && (
          <div className="space-y-2">
            <p>{explanation}</p>
            <p className="text-xs text-muted-foreground italic">For educational purposes only. Not financial advice.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
