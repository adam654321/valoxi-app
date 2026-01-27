import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import { DealSnapshot, formatCurrency, formatLabel } from './types';

interface AnalysisSummaryProps {
  dealSnapshot: DealSnapshot;
}

export function AnalysisSummary({ dealSnapshot }: AnalysisSummaryProps) {
  return (
    <div className="space-y-6">
      {dealSnapshot.meta && (
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
            <CardTitle>Company Overview</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-semibold">{dealSnapshot.meta.company_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Industry</p>
                <p className="font-semibold">{dealSnapshot.meta.industry}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Latest Year</p>
                <p className="font-semibold">{dealSnapshot.meta.latest_year}</p>
              </div>
            </div>
            {dealSnapshot.meta.data_quality && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium mb-3">Data Quality Scores</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(dealSnapshot.meta.data_quality).map(([key, value]: [string, any]) => (
                    <div key={key} className="text-center p-2 rounded-lg bg-muted">
                      <p className="text-xs text-muted-foreground capitalize">{key}</p>
                      <p className="text-lg font-bold">{value}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {dealSnapshot.meta.key_limitations && dealSnapshot.meta.key_limitations.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium mb-3 text-orange-700 dark:text-orange-400">Key Limitations</p>
                <ul className="list-disc pl-5 space-y-1">
                  {dealSnapshot.meta.key_limitations.map((limitation: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">{formatLabel(limitation)}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {dealSnapshot.size_profile && (
        <Card className="border-2 border-green-200 dark:border-green-800">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Size Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Latest Revenue</p>
                <p className="font-semibold">{formatCurrency(dealSnapshot.size_profile.revenue_latest ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className="font-semibold">{formatCurrency(dealSnapshot.size_profile.net_profit_latest ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Margin</p>
                <p className="font-semibold">{dealSnapshot.size_profile.gross_margin_pct?.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Margin</p>
                <p className="font-semibold">{dealSnapshot.size_profile.net_margin_pct?.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="font-semibold">{formatCurrency(dealSnapshot.size_profile.total_assets ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Staff Count</p>
                <p className="font-semibold">{dealSnapshot.size_profile.staff_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
