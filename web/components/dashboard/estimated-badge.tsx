import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export function EstimatedBadge({ tooltipText }: { tooltipText?: string }) {
  if (tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="text-[10px] text-muted-foreground"
          >
            ESTIMATED
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] text-muted-foreground">
      ESTIMATED
    </Badge>
  );
}
