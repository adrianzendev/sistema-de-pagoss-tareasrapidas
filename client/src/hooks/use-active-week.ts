import { todayPeru } from "@/lib/utils";
import type { Week } from "@shared/schema";

// Ordena las semanas y resuelve cuál mostrar: la seleccionada manualmente, si no la
// semana vigente (hora Perú), si no la más reciente. Usado en tutor-view, tutor/payments
// y verifier/payments.
export function useActiveWeek(weeks: Week[] | undefined, selectedWeekId: string | null) {
  const today = todayPeru();
  const sortedWeeks = [...(weeks ?? [])].sort((a, b) => a.weekNumber - b.weekNumber);
  const currentWeek = sortedWeeks.find(w => w.startDate <= today && w.endDate >= today);
  const activeWeekId = selectedWeekId ?? currentWeek?.id ?? sortedWeeks[sortedWeeks.length - 1]?.id ?? null;
  return { sortedWeeks, currentWeek, activeWeekId };
}
