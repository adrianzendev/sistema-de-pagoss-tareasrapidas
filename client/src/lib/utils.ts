import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Fecha de hoy en hora Perú (YYYY-MM-DD). Las semanas contables van de lunes a domingo en America/Lima. */
export const peruDate = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Lima" })
export const todayPeru = () => peruDate(new Date())

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
