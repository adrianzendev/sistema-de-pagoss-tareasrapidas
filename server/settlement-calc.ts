import type { Currency, Payment, TutorDailyCampaign, User } from "@shared/schema";
import { peruDateOf } from "./utils/peru-time";

/** Sum of daily-campaign charges (USD, full amount before 50/50 split) that fall inside a week.
 *  Dates are YYYY-MM-DD strings (Peru); comparison is lexicographic. Active campaigns accrue up to today. */
export function dailyCampaignUsdForWeek(
  campaigns: Array<{ dailyCostUsd: string; startDate: string; endDate: string | null }>,
  weekStart: string,
  weekEnd: string,
  todayStr: string,
): { totalUsd: number; days: number } {
  let totalUsd = 0;
  let days = 0;
  for (const c of campaigns) {
    const effectiveEnd = c.endDate ?? todayStr;
    const from = c.startDate > weekStart ? c.startDate : weekStart;
    const to = effectiveEnd < weekEnd ? effectiveEnd : weekEnd;
    if (to < from) continue;
    const d = Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000) + 1;
    days += d;
    totalUsd += d * Number(c.dailyCostUsd);
  }
  return { totalUsd, days };
}

/** Historical active check: was the tutor considered active during the week ending on weekEndDate (YYYY-MM-DD, hora Perú)? */
export function wasActiveForWeek(tutor: { activatedAt?: Date | string | null; deactivatedAt?: Date | string | null }, weekEndDate: string): boolean {
  if (tutor.activatedAt && peruDateOf(new Date(tutor.activatedAt)) > weekEndDate) return false;
  if (tutor.deactivatedAt && peruDateOf(new Date(tutor.deactivatedAt)) <= weekEndDate) return false;
  return true;
}

export type WeekTutorSettlement = {
  grossIncome: number;
  grossDirect: number;
  grossRegular: number;
  currencyCommissionHalf: number;
  ownAdvertisingShare: number;
  sharedAdvertisingShare: number;
  tutorAdvertisingShare: number;
  dailyAdvUsd: number;
  dailyAdvDays: number;
  weeklyAdvDisabled: boolean;
  wasActive: boolean;
  netIncome: number;
  tutorEarnings: number;
  agencyEarnings: number;
  tutorEarningsFromRegular: number;
  agencyEarningsFromDirect: number;
  netTransfer: number;
};

/**
 * Cálculo único de la liquidación de un tutor para una semana. Usado por todas las vistas
 * de liquidación (admin por tutor, admin por semana, matriz, y la del propio tutor) para
 * que no diverjan entre sí.
 *
 * IMPORTANTE: la conversión a soles siempre usa `exchangeRateSnapshot` del pago (la tasa
 * vigente cuando se registró), nunca la tasa actual de la divisa — si no, los montos de
 * semanas pasadas cambiarían cada vez que se actualiza el tipo de cambio.
 */
export function computeWeekTutorSettlement(params: {
  tutor: Pick<User, "commissionPercent" | "advertisingCostUsd" | "activatedAt" | "deactivatedAt">;
  verifiedPayments: Payment[];
  allCurrencies: Currency[];
  usdRate: number;
  weekStartDate: string;
  weekEndDate: string;
  sharedAdvertisingUsd: number;
  activeTutorCount: number;
  weekAdvOverrideUsd: number | undefined;
  weekAdvDisabled: boolean;
  campaigns: TutorDailyCampaign[];
  todayPeru: string;
}): WeekTutorSettlement {
  const {
    tutor, verifiedPayments, allCurrencies, usdRate, weekStartDate, weekEndDate,
    sharedAdvertisingUsd, activeTutorCount, weekAdvOverrideUsd, weekAdvDisabled, campaigns, todayPeru,
  } = params;

  const commission = Number(tutor.commissionPercent) / 100;
  const wasActive = wasActiveForWeek(tutor, weekEndDate);

  const ownAdvUsd = weekAdvOverrideUsd ?? Number(tutor.advertisingCostUsd ?? 0);
  const daily = weekAdvDisabled
    ? { totalUsd: 0, days: 0 }
    : dailyCampaignUsdForWeek(campaigns, weekStartDate, weekEndDate, todayPeru);
  const ownAdvertisingShare = wasActive && !weekAdvDisabled ? (ownAdvUsd + daily.totalUsd) * usdRate * 0.5 : 0;
  const sharedAdvertisingShare = wasActive ? (sharedAdvertisingUsd * usdRate * 0.5) / activeTutorCount : 0;
  const tutorAdvertisingShare = ownAdvertisingShare + sharedAdvertisingShare;

  let grossIncome = 0;
  let grossDirect = 0;
  let currencyCommissionHalf = 0;
  for (const p of verifiedPayments) {
    const currency = allCurrencies.find(c => c.id === p.currencyId);
    const rate = Number(p.exchangeRateSnapshot ?? currency?.exchangeRate ?? 1);
    const rawAmountPen = Number(p.amount) * rate;
    grossIncome += rawAmountPen;
    if (p.status === "autoverificado") {
      grossDirect += rawAmountPen;
    } else {
      currencyCommissionHalf += rawAmountPen * (Number(currency?.commissionPercent ?? 0) / 100) * 0.5;
    }
  }
  const grossRegular = grossIncome - grossDirect;

  const netIncome = grossIncome * commission;
  const tutorEarnings = netIncome - tutorAdvertisingShare - currencyCommissionHalf;
  const agencyEarnings = grossIncome * (1 - commission) - tutorAdvertisingShare - currencyCommissionHalf;

  const tutorEarningsFromRegular = grossRegular * commission - tutorAdvertisingShare - currencyCommissionHalf;
  const agencyEarningsFromDirect = grossDirect * (1 - commission);
  const netTransfer = tutorEarningsFromRegular - agencyEarningsFromDirect;

  return {
    grossIncome, grossDirect, grossRegular, currencyCommissionHalf,
    ownAdvertisingShare, sharedAdvertisingShare, tutorAdvertisingShare,
    dailyAdvUsd: daily.totalUsd, dailyAdvDays: daily.days, weeklyAdvDisabled: weekAdvDisabled,
    wasActive, netIncome, tutorEarnings, agencyEarnings,
    tutorEarningsFromRegular, agencyEarningsFromDirect, netTransfer,
  };
}
