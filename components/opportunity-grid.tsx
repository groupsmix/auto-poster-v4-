import { Opportunity } from "@prisma/client";
import { Badge, Card } from "@/components/ui";

export function OpportunityGrid({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {opportunities.map((opportunity) => (
        <Card key={opportunity.id} className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge>{opportunity.suggestedMode}</Badge>
              <h3 className="text-lg font-semibold">{opportunity.title}</h3>
            </div>
            <div className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-cyan-200">
              {opportunity.score}/100
            </div>
          </div>
          <p className="text-sm text-slate-300">{opportunity.summary}</p>
          <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
            <div>Demand: {opportunity.demandScore}</div>
            <div>Authority: {opportunity.authorityScore}</div>
            <div>Money: {opportunity.monetizationScore}</div>
            <div>Speed: {opportunity.speedScore}</div>
          </div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{opportunity.niche}</div>
        </Card>
      ))}
    </div>
  );
}
