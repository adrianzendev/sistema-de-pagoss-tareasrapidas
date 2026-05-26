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
