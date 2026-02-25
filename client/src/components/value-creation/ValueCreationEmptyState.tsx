import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { type LucideIcon } from 'lucide-react';

interface ValueCreationEmptyStateProps {
  title: string;
  message: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
}

export default function ValueCreationEmptyState({ title, message, icon: Icon = Calculator, action }: ValueCreationEmptyStateProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <EmptyState
          icon={Icon}
          title={title}
          description={message}
          size="lg"
          action={action && (
            <Button variant="outline" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        />
      </CardContent>
    </Card>
  );
}
