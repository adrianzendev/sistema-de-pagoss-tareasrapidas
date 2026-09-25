import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WeekOptionLabel } from "@/components/week-option-label";
import type { Week } from "@shared/schema";

// Selector de semana estándar del CRM: mismo control (con borde) en todas las vistas.
export function WeekSelector({
  weeks,
  value,
  onValueChange,
  currentWeekId,
}: {
  weeks: Week[];
  value: string | null;
  onValueChange: (id: string) => void;
  currentWeekId?: string;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onValueChange} data-testid="select-week">
      <SelectTrigger className="w-auto gap-2" data-testid="trigger-select-week">
        <SelectValue placeholder="Semana…" />
      </SelectTrigger>
      <SelectContent>
        {[...weeks].reverse().map((week) => (
          <SelectItem key={week.id} value={week.id} data-testid={`option-week-${week.weekNumber}`}>
            <WeekOptionLabel week={week} isCurrent={currentWeekId === week.id} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
