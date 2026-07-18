import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/60 shadow-sm", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-muted-foreground">
            {trend === "up" && <span className="mr-1 text-emerald-600">▲</span>}
            {trend === "down" && <span className="mr-1 text-rose-600">▼</span>}
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}