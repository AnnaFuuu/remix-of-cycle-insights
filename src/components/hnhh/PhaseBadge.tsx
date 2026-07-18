import { Badge } from "@/components/ui/badge";
import type { HormonalPhase } from "@/lib/hormonal/types";
import { PHASE_ACCENT } from "@/lib/hormonal/phase";

export function PhaseBadge({ phase }: { phase: HormonalPhase }) {
  return (
    <Badge
      variant="outline"
      className="rounded-full border-0 px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: PHASE_ACCENT[phase] + "22", color: PHASE_ACCENT[phase] }}
    >
      {phase}
    </Badge>
  );
}