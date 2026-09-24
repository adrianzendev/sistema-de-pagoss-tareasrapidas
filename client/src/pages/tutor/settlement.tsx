import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, Calendar, Coins, DollarSign } from "lucide-react";
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="default">Abierta</Badge>;
      case "closed":
        return <Badge variant="secondary">Cerrada</Badge>;
      case "paid":
        return <Badge className="border-success/40 bg-background text-success">Pagada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Calculator className="h-6 w-6" />
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
                <Coins className="h-6 w-6 text-primary" />
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
                <DollarSign className="h-6 w-6 text-destructive" />
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
                <Calculator className="h-6 w-6 text-success" />
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
            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[40px_100px_140px_80px_80px_120px_130px_130px_130px] border-b-2 border-border font-bold text-xs uppercase">
                  <div className="p-2 text-center border-r border-border text-muted-foreground">#</div>
                  <div className="p-2 text-center border-r border-primary/25 text-primary">SEMANA</div>
                  <div className="p-2 text-center border-r border-border text-muted-foreground">PERÍODO</div>
                  <div className="p-2 text-center border-r border-border text-muted-foreground">ESTADO</div>
                  <div className="p-2 text-center border-r border-border text-muted-foreground">PAGOS</div>
                  <div className="p-2 text-center border-r border-success/25 text-success">BRUTO</div>
                  <div className="p-2 text-center border-r border-primary/30 text-primary">× {commissionPercent}%</div>
                  <div className="p-2 text-center border-r border-destructive/25 text-destructive">− PUBLICIDAD</div>
                  <div className="p-2 text-center text-success">GANANCIA</div>
                </div>

                {settlements.map((s, index) => (
                  <div
                    key={s.week.id}
                    className="grid grid-cols-[40px_100px_140px_80px_80px_120px_130px_130px_130px] border-b border-border text-sm"
                    data-testid={`row-settlement-${s.week.weekNumber}`}
                  >
                    <div className="p-2 text-center border-r border-border font-medium text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="p-2 text-center border-r border-primary/30 font-bold" data-testid={`text-week-${s.week.weekNumber}`}>
                      S{s.week.weekNumber}
                    </div>
                    <div className="p-2 text-center border-r border-border text-xs">
                      {formatDate(s.week.startDate)} - {formatDate(s.week.endDate)}
                    </div>
                    <div className="p-2 text-center border-r border-border flex items-center justify-center">
                      {getStatusBadge(s.week.status)}
                    </div>
                    <div className="p-2 text-center border-r border-border font-medium" data-testid={`text-payments-${s.week.weekNumber}`}>
                      {s.payments.length}
                    </div>
                    <div className="p-2 text-right border-r border-success/30 font-medium text-success" data-testid={`text-gross-${s.week.weekNumber}`}>
                      {formatCurrency(s.grossIncome)}
                    </div>
                    <div className="p-2 text-right border-r border-primary/30 font-medium text-primary" data-testid={`text-net-commission-${s.week.weekNumber}`}>
                      {formatCurrency(s.netIncome)}
                    </div>
                    <div className="p-2 text-right border-r border-destructive/30 font-medium text-destructive" data-testid={`text-advertising-${s.week.weekNumber}`}>
                      {s.tutorAdvertisingShare > 0 ? (
                        <div>
                          <span title={`$${formatCurrency(s.sharedAdvertisingUsd)} USD × TC ${formatCurrency(s.usdRate)}`}>
                            -{formatCurrency(s.tutorAdvertisingShare)}
                          </span>
                          {(s.dailyAdvUsd ?? 0) > 0 && (
                            <div className="text-xs font-normal text-destructive/70" data-testid={`text-daily-adv-${s.week.weekNumber}`}>
                              incl. diaria: {s.dailyAdvDays} {s.dailyAdvDays === 1 ? "día" : "días"} = ${formatCurrency(s.dailyAdvUsd ?? 0)} USD (50%)
                            </div>
                          )}
                        </div>
                      ) : "—"}
                    </div>
                    <div className="p-2 text-right font-bold text-success" data-testid={`text-earnings-${s.week.weekNumber}`}>
                      {formatCurrency(s.tutorEarnings)}
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-[40px_100px_140px_80px_80px_120px_130px_130px_130px] border-t-2 border-border font-bold text-sm">
                  <div className="p-3 text-center border-r border-border"></div>
                  <div className="p-3 border-r border-border col-span-4 text-right pr-4">
                    TOTALES:
                  </div>
                  <div className="p-3 text-right border-r border-success/30 text-success" data-testid="text-total-gross-row">
                    {formatCurrency(totals.grossIncome)}
                  </div>
                  <div className="p-3 text-right border-r border-primary/30 text-primary" data-testid="text-total-net-row">
                    {formatCurrency(totals.netIncome)}
                  </div>
                  <div className="p-3 text-right border-r border-destructive/30 text-destructive" data-testid="text-total-advertising-row">
                    {totals.advertisingCost > 0 ? `-${formatCurrency(totals.advertisingCost)}` : "—"}
                  </div>
                  <div className="p-3 text-right text-success" data-testid="text-total-earnings-row">
                    {formatCurrency(totals.tutorEarnings)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
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
