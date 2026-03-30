import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatRelativeTimestamp } from "@/lib/dashboard/format";
import { HealthDot } from "./health-dot";
import type { HealthStatus } from "@/lib/dashboard/types";

interface SourceStatusCardProps {
  source: string;
  metrics: Record<string, string | number>;
  freshness: {
    lastTimestamp: string | null;
    stale: boolean;
    usingFallback?: boolean;
    fallbackTimestamp?: string | null;
    validationStatus?: string | null;
  };
  health: HealthStatus;
}

export function SourceStatusCard({
  source,
  metrics,
  freshness,
  health,
}: SourceStatusCardProps) {
  return (
    <Card className={cn(freshness.stale && "border-amber-300 dark:border-amber-700")}>
      <CardHeader className="flex-row items-center gap-2">
        <CardTitle className="text-sm font-medium">{source}</CardTitle>
        <HealthDot status={health} />
      </CardHeader>
      <CardContent className="space-y-1">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{key}</span>
            <span className="font-medium">{String(value)}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-[10px]">
        {freshness.lastTimestamp ? (
          <span className="text-muted-foreground">
            {formatRelativeTimestamp(freshness.lastTimestamp)}
          </span>
        ) : (
          <span className="text-muted-foreground">No data collected yet</span>
        )}
        {freshness.stale && (
          <span className="text-amber-600 dark:text-amber-400">
            Data may be stale
          </span>
        )}
        {freshness.usingFallback && freshness.fallbackTimestamp && (
          <span className="text-amber-600 dark:text-amber-400">
            Using data from {freshness.fallbackTimestamp} -- latest scrape had issues
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
