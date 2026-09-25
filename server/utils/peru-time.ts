const PERU_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5

/** Retorna la fecha actual en hora Perú como string YYYY-MM-DD */
export function todayPeru(): string {
  const now = new Date();
  const peruTime = new Date(now.getTime() + PERU_OFFSET_MS);
  return peruTime.toISOString().split('T')[0];
}

/**
 * Retorna un objeto Date ajustado a hora Perú para cálculos de día de semana.
 * No representa una fecha UTC real — úsalo solo para getDay(), getDate(), etc.
 */
export function nowPeru(): Date {
  const now = new Date();
  return new Date(now.getTime() + PERU_OFFSET_MS);
}

/** Formatea cualquier Date a YYYY-MM-DD usando sus propiedades UTC (sin conversión extra) */
export function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Suma días a una fecha YYYY-MM-DD */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

/** Regla de negocio: semana contable = LUNES a DOMINGO (hora Perú) que contiene la fecha dada */
export function weekRangeOf(dateStr: string): { startDate: string; endDate: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  const startDate = addDays(dateStr, -((d.getUTCDay() + 6) % 7));
  return { startDate, endDate: addDays(startDate, 6) };
}

/** Fecha YYYY-MM-DD en hora Perú de un instante (p. ej. createdAt de un pago) */
export function peruDateOf(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}
