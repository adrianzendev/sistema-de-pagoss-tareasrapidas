import { storage } from "./storage";

const DAY_MS = 24 * 60 * 60 * 1000;

async function ensureCurrentWeekExists() {
  try {
    const current = await storage.getCurrentWeek();
    if (current) return;
    const week = await storage.generateNextWeek();
    console.log(`[week-scheduler] Semana ${week.weekNumber} generada automáticamente (${week.startDate} - ${week.endDate})`);
  } catch (error) {
    console.error("Error generando semana automática:", error);
  }
}

function msUntilNextPeruMidnight(): number {
  const PERU_OFFSET_MS = -5 * 60 * 60 * 1000;
  const now = new Date();
  const peruNow = new Date(now.getTime() + PERU_OFFSET_MS);
  const nextPeruMidnight = new Date(Date.UTC(
    peruNow.getUTCFullYear(), peruNow.getUTCMonth(), peruNow.getUTCDate() + 1
  ));
  return nextPeruMidnight.getTime() - peruNow.getTime();
}

export function startWeekScheduler() {
  ensureCurrentWeekExists();
  setTimeout(function scheduleDaily() {
    ensureCurrentWeekExists();
    setInterval(ensureCurrentWeekExists, DAY_MS);
  }, msUntilNextPeruMidnight());
}
