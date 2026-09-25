import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { es } from "date-fns/locale"

/** Fecha de hoy en hora Perú (YYYY-MM-DD). Las semanas contables van de lunes a domingo en America/Lima. */
export const peruDate = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Lima" })
export const todayPeru = () => peruDate(new Date())

/** "21 sep": abreviatura de mes de 3 letras sin punto. No usar toLocaleDateString("es-PE", { month: "short" }): da "set." con punto. */
export const formatShortDate = (d: Date) => format(d, "d MMM", { locale: es })

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
