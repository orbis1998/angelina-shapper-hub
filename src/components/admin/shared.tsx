import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, highlight, sub }: { label: string; value: string; highlight?: boolean; sub?: string }) {
  return (
    <Card className={cn("border shadow-sm", highlight && "border-foreground/20 bg-foreground text-background")}>
      <CardContent className="p-5">
        <div className={cn("text-[11px] font-medium uppercase tracking-widest", highlight ? "text-background/60" : "text-muted-foreground")}>{label}</div>
        <div className={cn("text-2xl font-semibold tabular-nums mt-2 tracking-tight", highlight ? "text-background" : "text-foreground")}>{value}</div>
        {sub && <div className={cn("text-xs mt-1", highlight ? "text-background/50" : "text-muted-foreground")}>{sub}</div>}
      </CardContent>
    </Card>
  );
}

export const CHART_COLORS = ["#171717", "#525252", "#737373", "#a3a3a3", "#d4d4d4", "#404040", "#262626"];
