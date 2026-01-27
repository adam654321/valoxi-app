import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { formatCurrency, formatLabel } from './types';

interface ScenarioSummary {
  name: string;
  term_months: number;
  interest_rate_annual_pct: number;
  annual_debt_service_total: number;
  dscr: number;
}

interface RepaymentRow {
  year: number;
  annual_payment: number;
}

interface RepaymentPlan {
  scenario_name: string;
  rows: RepaymentRow[];
}

interface FinancialTableProps {
  scenarioSummary?: ScenarioSummary[];
  repaymentPlans?: RepaymentPlan[];
}

export function ScenarioSummaryTable({ scenarios }: { scenarios: ScenarioSummary[] }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">Financing Scenarios</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="text-left p-2 border">Scenario</th>
              <th className="text-right p-2 border">Term</th>
              <th className="text-right p-2 border">Interest Rate</th>
              <th className="text-right p-2 border">Annual Debt Service</th>
              <th className="text-right p-2 border">DSCR</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario, idx) => (
              <tr key={idx} className="border-b">
                <td className="p-2 border font-medium">{formatLabel(scenario.name)}</td>
                <td className="text-right p-2 border">{scenario.term_months} months</td>
                <td className="text-right p-2 border">{scenario.interest_rate_annual_pct}%</td>
                <td className="text-right p-2 border">{formatCurrency(scenario.annual_debt_service_total)}</td>
                <td className="text-right p-2 border">
                  <Badge className={scenario.dscr >= 1.5 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-amber-100 text-amber-800'}>
                    {scenario.dscr.toFixed(2)}x
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RepaymentPlansCard({ plans }: { plans: RepaymentPlan[] }) {
  return (
    <Card className="border-2 border-slate-200 dark:border-slate-700">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/20 dark:to-gray-950/20">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Repayment Plans
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan, planIdx) => (
            <div key={planIdx}>
              <p className="text-sm font-medium mb-2">{formatLabel(plan.scenario_name)}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2 border">Year</th>
                      <th className="text-right p-2 border">Annual Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b">
                        <td className="p-2 border">Year {row.year}</td>
                        <td className="text-right p-2 border font-medium">{formatCurrency(row.annual_payment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
