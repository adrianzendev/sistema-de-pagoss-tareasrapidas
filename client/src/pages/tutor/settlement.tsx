import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, TrendingUp, Calendar, DollarSign } from "lucide-react";
import type { Week, PaymentWithDetails } from "@shared/schema";

type TutorSettlement = {
  week: Week;
  tutorId: string;
  tutorName: string;
  grossIncome: number;
  advertisingCost: number;
  tutorAdvertisingShare: number;
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
        return <Badge className="bg-green-600">Pagada</Badge>;
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
  const settings = data?.settings ?? { agencyPercent: 30, tutorPercent: 70 };

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
          Resumen de tus ganancias por semana ({settings.tutorPercent}% tutor / {settings.agencyPercent}% agencia)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
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
              <div className="p-3 rounded-lg bg-destructive/10">
                <TrendingUp className="h-6 w-6 text-destructive" />
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
              <div className="p-3 rounded-lg bg-green-500/10">
                <Calculator className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mi Ganancia Total</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-total-earnings">{formatCurrency(totals.tutorEarnings)}</p>
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
              <div className="min-w-[800px]">
                <div className="grid grid-cols-[40px_100px_140px_80px_100px_120px_120px_120px_120px] border-b-2 border-gray-400 dark:border-gray-600 font-bold text-xs uppercase">
                  <div className="bg-gray-300 dark:bg-gray-700 p-2 text-center border-r border-gray-400 dark:border-gray-600">#</div>
                  <div className="bg-blue-200 dark:bg-blue-900 p-2 text-center border-r border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100">SEMANA</div>
                  <div className="bg-purple-200 dark:bg-purple-900 p-2 text-center border-r border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100">PERÍODO</div>
                  <div className="bg-slate-200 dark:bg-slate-800 p-2 text-center border-r border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">ESTADO</div>
                  <div className="bg-cyan-200 dark:bg-cyan-900 p-2 text-center border-r border-cyan-300 dark:border-cyan-700 text-cyan-900 dark:text-cyan-100">PAGOS</div>
                  <div className="bg-green-300 dark:bg-green-800 p-2 text-center border-r border-green-400 dark:border-green-700 text-green-900 dark:text-green-100">BRUTO</div>
                  <div className="bg-pink-300 dark:bg-pink-900 p-2 text-center border-r border-pink-400 dark:border-pink-700 text-pink-900 dark:text-pink-100">PUBLICIDAD</div>
                  <div className="bg-amber-200 dark:bg-amber-900 p-2 text-center border-r border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100">NETO</div>
                  <div className="bg-emerald-400 dark:bg-emerald-800 p-2 text-center text-emerald-900 dark:text-emerald-100">MI {settings.tutorPercent}%</div>
                </div>
                
                {settlements.map((s, index) => (
                  <div 
                    key={s.week.id}
                    className="grid grid-cols-[40px_100px_140px_80px_100px_120px_120px_120px_120px] border-b border-gray-200 dark:border-gray-700 text-sm"
                    data-testid={`row-settlement-${s.week.weekNumber}`}
                  >
                    <div className="bg-gray-200 dark:bg-gray-800 p-2 text-center border-r border-gray-300 dark:border-gray-600 font-medium text-gray-600 dark:text-gray-400">
                      {index + 1}
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 p-2 text-center border-r border-blue-100 dark:border-blue-900 font-bold" data-testid={`text-week-${s.week.weekNumber}`}>
                      S{s.week.weekNumber}
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-2 text-center border-r border-purple-100 dark:border-purple-900 text-xs">
                      {formatDate(s.week.startDate)} - {formatDate(s.week.endDate)}
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-2 text-center border-r border-slate-100 dark:border-slate-800 flex items-center justify-center">
                      {getStatusBadge(s.week.status)}
                    </div>
                    <div className="bg-cyan-50 dark:bg-cyan-950 p-2 text-center border-r border-cyan-100 dark:border-cyan-900 font-medium" data-testid={`text-payments-${s.week.weekNumber}`}>
                      {s.payments.length}
                    </div>
                    <div className="bg-green-100 dark:bg-green-950 p-2 text-right border-r border-green-200 dark:border-green-900 font-medium text-green-800 dark:text-green-200" data-testid={`text-gross-${s.week.weekNumber}`}>
                      {formatCurrency(s.grossIncome)}
                    </div>
                    <div className="bg-pink-100 dark:bg-pink-950 p-2 text-right border-r border-pink-200 dark:border-pink-900 font-medium text-pink-700 dark:text-pink-300" data-testid={`text-advertising-${s.week.weekNumber}`}>
                      {s.tutorAdvertisingShare > 0 ? `-${formatCurrency(s.tutorAdvertisingShare)}` : formatCurrency(0)}
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950 p-2 text-right border-r border-amber-100 dark:border-amber-900 font-medium" data-testid={`text-net-${s.week.weekNumber}`}>
                      {formatCurrency(s.netIncome)}
                    </div>
                    <div className="bg-emerald-100 dark:bg-emerald-950 p-2 text-right font-bold text-emerald-700 dark:text-emerald-300" data-testid={`text-earnings-${s.week.weekNumber}`}>
                      {formatCurrency(s.tutorEarnings)}
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-[40px_100px_140px_80px_100px_120px_120px_120px_120px] border-t-2 border-gray-500 dark:border-gray-400 font-bold text-sm bg-gray-100 dark:bg-gray-800">
                  <div className="bg-gray-300 dark:bg-gray-700 p-3 text-center border-r border-gray-400 dark:border-gray-600"></div>
                  <div className="bg-gray-200 dark:bg-gray-800 p-3 border-r border-gray-300 dark:border-gray-700 col-span-4 text-right pr-4">
                    TOTALES:
                  </div>
                  <div className="bg-green-200 dark:bg-green-900 p-3 text-right border-r border-green-300 dark:border-green-800 text-green-800 dark:text-green-200" data-testid="text-total-gross-row">
                    {formatCurrency(totals.grossIncome)}
                  </div>
                  <div className="bg-pink-200 dark:bg-pink-900 p-3 text-right border-r border-pink-300 dark:border-pink-800 text-pink-700 dark:text-pink-300" data-testid="text-total-advertising-row">
                    {totals.advertisingCost > 0 ? `-${formatCurrency(totals.advertisingCost)}` : formatCurrency(0)}
                  </div>
                  <div className="bg-amber-100 dark:bg-amber-900 p-3 text-right border-r border-amber-200 dark:border-amber-800" data-testid="text-total-net-row">
                    {formatCurrency(totals.netIncome)}
                  </div>
                  <div className="bg-emerald-300 dark:bg-emerald-800 p-3 text-right text-emerald-800 dark:text-emerald-200" data-testid="text-total-earnings-row">
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <p className="font-bold text-green-800 dark:text-green-200">1. Bruto</p>
              <p className="text-green-700 dark:text-green-300 text-xs">Pagos verificados en PEN</p>
            </div>
            <div className="p-3 rounded-lg bg-pink-100 dark:bg-pink-950 border border-pink-200 dark:border-pink-800">
              <p className="font-bold text-pink-800 dark:text-pink-200">2. Publicidad</p>
              <p className="text-pink-700 dark:text-pink-300 text-xs">Costo ÷ tutores activos</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <p className="font-bold text-amber-800 dark:text-amber-200">3. Neto</p>
              <p className="text-amber-700 dark:text-amber-300 text-xs">Bruto - Publicidad</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
              <p className="font-bold text-emerald-800 dark:text-emerald-200">4. Mi {settings.tutorPercent}%</p>
              <p className="text-emerald-700 dark:text-emerald-300 text-xs">Neto × {settings.tutorPercent}%</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg text-center">
            <p className="text-sm font-mono font-bold">
              Ganancia = (Bruto - Publicidad) × {settings.tutorPercent}%
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
