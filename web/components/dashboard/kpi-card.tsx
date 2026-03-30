import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { EstimatedBadge } from "./estimated-badge";

interface KpiCardProps {
  title: string;
  value: string;
  trend?: {
    value: number;
    label: string;
    direction: "up" | "down" | "flat";
  };
  estimated?: boolean;
  tooltipText?: string;
  icon: React.ReactNode;
  updatedAt: string;
  stale?: boolean;
}

export function KpiCard({
  title,
  value,
  trend,
  estimated,
  tooltipText,
  icon,
  updatedAt,
  stale,
}: KpiCardProps) {
  return (
    <Card className={cn(stale && "border-amber-300 dark:border-amber-700")} size="sm">
      <CardHeader className="flex-row items-center gap-2 pb-2">
        <div className="size-4 text-muted-foreground">{icon}</div>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono">{value}</span>
          {trend && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs",
                trend.direction === "up" &&
                  "text-green-600 dark:text-green-400",
                trend.direction === "down" &&
                  "text-red-600 dark:text-red-400",
                trend.direction === "flat" && "text-muted-foreground"
              )}
            >
              {trend.direction === "up" && (
                <TrendingUp className="size-3" />
              )}
              {trend.direction === "down" && (
                <TrendingDown className="size-3" />
              )}
              {trend.direction === "flat" && (
                <Minus className="size-3" />
              )}
              {trend.label}
            </span>
          )}
        </div>
        {estimated && <EstimatedBadge tooltipText={tooltipText} />}
        <p className="text-[10px] text-muted-foreground mt-1">{updatedAt}</p>
        {stale && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            Data may be stale
          </p>
        )}
      </CardContent>
    </Card>
  );
}
