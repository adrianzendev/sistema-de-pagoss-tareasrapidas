import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Week } from "@shared/schema";

const day = (d: string) => format(new Date(d + "T12:00:00"), "d MMM", { locale: es });

// Etiqueta de semana para los selectores: "S199 (21 sep – 27 sep)".
// La semana actual se marca solo con peso y color (sin etiqueta "actual").
export function WeekOptionLabel({ week, isCurrent }: { week: Pick<Week, "weekNumber" | "startDate" | "endDate">; isCurrent: boolean }) {
  return (
    <span className={isCurrent ? "font-semibold text-foreground" : "font-normal text-muted-foreground"}>
      S{week.weekNumber} ({day(week.startDate)} – {day(week.endDate)})
    </span>
  );
}
