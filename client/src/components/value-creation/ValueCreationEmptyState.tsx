import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';

interface ValueCreationEmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
}

export default function ValueCreationEmptyState({
  title,
  message,
  icon,
  action,
}: ValueCreationEmptyStateProps) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        {icon || <Calculator className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />}
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{message}</p>
        {action && (
          <Button variant="outline" size="sm" className="mt-3" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
