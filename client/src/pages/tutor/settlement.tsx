import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, Calendar, Coins, DollarSign } from "lucide-react";
import { WeeklySettlementTable } from "@/components/weekly-settlement-table";
import type { Week, PaymentWithDetails } from "@shared/schema";

type TutorSettlement = {
  week: Week;
  tutorId: string;
  tutorName: string;
  commissionPercent: number;
  grossIncome: number;
  advertisingCost: number;
  tutorAdvertisingShare: number;
  sharedAdvertisingUsd: number;
  usdRate: number;
  dailyAdvUsd?: number;
  dailyAdvDays?: number;
  weeklyAdvDisabled?: boolean;
  netIncome: number;
  tutorEarnings: number;
  agencyEarnings: number;
  payments: PaymentWithDetails[];
};

type SettlementResponse = {
  settlements: TutorSettlement[];
  settings: {
    agencyPercent: number;
    tutorPercent: number;
  };
  commissionPercent: number;
};

export default function TutorSettlementPage() {
  const { data, isLoading } = useQuery<SettlementResponse>({
    queryKey: ["/api/tutor/settlement"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const settlements = data?.settlements ?? [];
  const commissionPercent = data?.commissionPercent ?? 0;

  const totals = settlements.reduce(
    (acc, s) => ({
      grossIncome: acc.grossIncome + s.grossIncome,
      tutorEarnings: acc.tutorEarnings + s.tutorEarnings,
      advertisingCost: acc.advertisingCost + s.tutorAdvertisingShare,
      netIncome: acc.netIncome + s.netIncome,
    }),
    { grossIncome: 0, tutorEarnings: 0, advertisingCost: 0, netIncome: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          <Calculator className="h-5 w-5" />
          Mi Liquidación
        </h1>
        <p className="text-muted-foreground">
          Mi comisión: <span className="font-bold text-foreground">{commissionPercent}%</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg border border-primary/30">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ingreso Bruto Total</p>
                <p className="text-2xl font-bold" data-testid="text-total-gross">{formatCurrency(totals.grossIncome)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg border border-destructive/30">
                <DollarSign className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Publicidad Compartida</p>
                <p className="text-2xl font-bold" data-testid="text-total-advertising">{formatCurrency(totals.advertisingCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg border border-success/30">
                <Calculator className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mi Ganancia Total</p>
                <p className="text-2xl font-bold text-success" data-testid="text-total-earnings">{formatCurrency(totals.tutorEarnings)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Liquidación por Semana
          </CardTitle>
          <CardDescription>
            Hoja de cálculo de ganancias semana a semana
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {settlements.length > 0 ? (
            <WeeklySettlementTable settlements={settlements} commissionPercent={commissionPercent} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p>No hay semanas con pagos aún</p>
              <p className="text-sm">Registra pagos para ver tu liquidación</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fórmula de Cálculo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded-lg border border-success/30">
              <p className="font-bold text-success">1. Ingreso Bruto</p>
              <p className="text-success/70 text-xs">Pagos verificados convertidos a PEN</p>
            </div>
            <div className="p-3 rounded-lg border border-primary/30">
              <p className="font-bold text-primary">2. Aplicar Comisión ({commissionPercent}%)</p>
              <p className="text-primary/70 text-xs">Bruto × {commissionPercent}%</p>
            </div>
            <div className="p-3 rounded-lg border border-destructive/30">
              <p className="font-bold text-destructive">3. Restar Publicidad</p>
              <p className="text-destructive/70 text-xs">Publicidad USD × TC × 50% ÷ tutores activos</p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg text-center border border-border">
            <p className="text-sm font-mono font-bold">
              Ganancia = (Bruto × {commissionPercent}%) − Publicidad compartida
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
