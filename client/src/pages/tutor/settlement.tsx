import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      style: "currency",
      currency: "PEN",
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
    }),
    { grossIncome: 0, tutorEarnings: 0, advertisingCost: 0 }
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
            Detalle de ganancias semana a semana (estilo hoja de cálculo)
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {settlements.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Semana</TableHead>
                  <TableHead className="font-bold">Período</TableHead>
                  <TableHead className="font-bold">Estado</TableHead>
                  <TableHead className="text-right font-bold">Pagos</TableHead>
                  <TableHead className="text-right font-bold">Bruto</TableHead>
                  <TableHead className="text-right font-bold">Publicidad</TableHead>
                  <TableHead className="text-right font-bold">Neto</TableHead>
                  <TableHead className="text-right font-bold bg-primary/5">Mi {settings.tutorPercent}%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((s, index) => (
                  <TableRow 
                    key={s.week.id} 
                    className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                    data-testid={`row-settlement-${s.week.weekNumber}`}
                  >
                    <TableCell className="font-medium" data-testid={`text-week-${s.week.weekNumber}`}>
                      S{s.week.weekNumber}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(s.week.startDate)} - {formatDate(s.week.endDate)}
                    </TableCell>
                    <TableCell>{getStatusBadge(s.week.status)}</TableCell>
                    <TableCell className="text-right" data-testid={`text-payments-${s.week.weekNumber}`}>
                      {s.payments.length}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-gross-${s.week.weekNumber}`}>
                      {formatCurrency(s.grossIncome)}
                    </TableCell>
                    <TableCell className="text-right text-destructive" data-testid={`text-advertising-${s.week.weekNumber}`}>
                      {s.tutorAdvertisingShare > 0 ? `-${formatCurrency(s.tutorAdvertisingShare)}` : formatCurrency(0)}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-net-${s.week.weekNumber}`}>
                      {formatCurrency(s.netIncome)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary bg-primary/5" data-testid={`text-earnings-${s.week.weekNumber}`}>
                      {formatCurrency(s.tutorEarnings)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted font-bold border-t-2">
                  <TableCell colSpan={4} className="text-right">TOTALES:</TableCell>
                  <TableCell className="text-right" data-testid="text-total-gross-row">{formatCurrency(totals.grossIncome)}</TableCell>
                  <TableCell className="text-right text-destructive" data-testid="text-total-advertising-row">
                    {totals.advertisingCost > 0 ? `-${formatCurrency(totals.advertisingCost)}` : formatCurrency(0)}
                  </TableCell>
                  <TableCell className="text-right" data-testid="text-total-net-row">
                    {formatCurrency(totals.grossIncome - totals.advertisingCost)}
                  </TableCell>
                  <TableCell className="text-right text-primary bg-primary/10" data-testid="text-total-earnings-row">
                    {formatCurrency(totals.tutorEarnings)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
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
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>1. Ingreso Bruto:</strong> Total de pagos verificados convertidos a PEN</p>
            <p><strong>2. Publicidad:</strong> Gasto compartido = (Costo Total × {settings.tutorPercent}%) ÷ Número de Tutores</p>
            <p><strong>3. Ingreso Neto:</strong> Bruto - Mi parte de Publicidad</p>
            <p><strong>4. Mi Ganancia:</strong> Ingreso Neto × {settings.tutorPercent}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
