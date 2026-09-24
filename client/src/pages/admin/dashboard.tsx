import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Users, CreditCard, Coins, CheckCircle, Clock, XCircle, Calendar, TableIcon } from "lucide-react";
import type { Week } from "@shared/schema";

interface DashboardStats {
  totalTutors: number;
  totalPayments: number;
  pendingPayments: number;
  verifiedPayments: number;
  rejectedPayments: number;
  totalAmount: number;
  tutorStats: Array<{
    id: string;
    name: string;
    totalPayments: number;
    verifiedAmount: number;
  }>;
}

type MatrixCell = {
  grossIncome: number;
  grossDirect: number;
  netIncome: number;
  tutorEarnings: number;
  agencyEarnings: number;
  netTransfer: number;
  tutorAdvertisingShare: number;
  paymentCount: number;
  wasActive: boolean;
};

type CurrencyTotal = { code: string; name: string; symbol: string; total: number };

type SettlementsMatrix = {
  weeks: Week[];
  tutors: Array<{ id: string; name: string; commissionPercent: string; advertisingCostUsd?: string; autoVerificaPagos?: boolean; isActive?: boolean }>;
  matrix: Record<string, Record<string, MatrixCell>>;
  currencyTotals: CurrencyTotal[];
  weekPaidMap: Record<string, string[]>;
  usdRate: number;
};

type TutorRow = { id: string; name: string; commissionPercent: string };

export default function AdminDashboard() {
  const [period, setPeriod] = useState("all");
  const [selectedTutor, setSelectedTutor] = useState<TutorRow | null>(null);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/stats?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: matrixData, isLoading: matrixLoading } = useQuery<SettlementsMatrix>({
    queryKey: ["/api/admin/settlements/matrix"],
    staleTime: 5 * 60 * 1000,
  });

  const fmt = (n: number) =>
    "PEN " + new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const StatCard = ({
    title,
    value,
    description,
    icon: Icon,
    variant = "default",
  }: {
    title: string;
    value: string | number;
    description: string;
    icon: typeof Users;
    variant?: "default" | "success" | "warning" | "destructive";
  }) => {
    const iconColors = {
      default: "text-primary",
      success: "text-success",
      warning: "text-warning",
      destructive: "text-destructive",
    };
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${iconColors[variant]}`} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const weeks = matrixData?.weeks ?? [];
  const tutors = matrixData?.tutors ?? [];
  const matrix = matrixData?.matrix ?? {};
  const currencyTotals = matrixData?.currencyTotals ?? [];
  const weekCurrencyTotals: Record<string, Record<string, { code: string; symbol: string; total: number }>> = matrixData?.weekCurrencyTotals ?? {};
  const weekPaidMap: Record<string, string[]> = matrixData?.weekPaidMap ?? {};
  const tutorWeekAdvMap: Record<string, Record<string, number>> = matrixData?.tutorWeekAdvMap ?? {};
  const usdRate = matrixData?.usdRate ?? 1;

  const tutorsWithAnyPayment = tutors;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general del sistema de gestión de tutores</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el tiempo</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="quarter">Último trimestre</SelectItem>
              <SelectItem value="year">Este año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      <div className="hidden grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>Ingresos por Tutor</CardTitle>
            <CardDescription>Monto verificado en el periodo seleccionado</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-6">
                {stats?.tutorStats?.map((tutor) => (
                  <div key={tutor.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">{tutor.name}</div>
                      <div className="font-mono font-bold text-primary">
                        {tutor.verifiedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(100, (tutor.verifiedAmount / (stats.totalAmount || 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        {tutor.totalPayments} pagos verificados
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {((tutor.verifiedAmount / (stats.totalAmount || 1)) * 100).toFixed(1)}% del periodo
                      </p>
                    </div>
                  </div>
                ))}
                {(!stats?.tutorStats || stats.tutorStats.filter(t => t.totalPayments > 0).length === 0) && (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-muted-foreground">No hay pagos verificados en este periodo</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Pagos</CardTitle>
            <CardDescription>En el periodo seleccionado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg border border-warning/30">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pendientes</p>
                <p className="text-lg font-bold">{stats?.pendingPayments ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg border border-success/30">
              <CheckCircle className="h-5 w-5 text-success" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Verificados</p>
                <p className="text-lg font-bold">{stats?.verifiedPayments ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg border border-destructive/30">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Rechazados</p>
                <p className="text-lg font-bold">{stats?.rejectedPayments ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settlements matrix table */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Ganancias por Tutor y Semana</CardTitle>
                <CardDescription>
                  Liquidación neta (bruto × comisión − publicidad) — últimas {weeks.length} semanas
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {matrixLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : tutorsWithAnyPayment.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TableIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No hay liquidaciones registradas aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${160 + weeks.length * 120}px` }}>
                {/* Header */}
                <div
                  className="grid border-b-2 border-border text-xs font-bold uppercase"
                  style={{ gridTemplateColumns: `160px repeat(${weeks.length}, 120px) 130px` }}
                >
                  <div className="p-3 border-r border-border sticky left-0 z-10">
                    Tutor
                  </div>
                  {weeks.map(w => {
                    const activeTutorsThisWeek = tutorsWithAnyPayment.filter(t =>
                      (matrix[t.id]?.[w.id]?.paymentCount ?? 0) > 0 ||
                      (matrix[t.id]?.[w.id]?.tutorAdvertisingShare ?? 0) > 0
                    );
                    const paidCount = activeTutorsThisWeek.filter(t => weekPaidMap[w.id]?.includes(t.id)).length;
                    const totalActive = activeTutorsThisWeek.length;
                    return (
                      <div key={w.id} className="p-2 text-center border-r border-border last:border-r-0">
                        <div className="text-foreground">S{w.weekNumber}</div>
                        <div className="text-muted-foreground font-normal normal-case text-xs">
                          {new Date(w.startDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                          {" - "}
                          {new Date(w.endDate + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                        </div>
                        {totalActive > 0 && paidCount > 0 && (
                          <div className="mt-1">
                            <span className={`text-xs font-semibold ${paidCount === totalActive ? "text-success" : "text-muted-foreground/60"}`}>
                              {paidCount}/{totalActive} pagados
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="p-2 text-center text-primary">
                    TOTAL
                  </div>
                </div>

                {/* Tutor rows */}
                {tutorsWithAnyPayment.map((tutor, rowIdx) => {
                  const rowTotal = weeks.reduce((sum, w) => sum + (matrix[tutor.id]?.[w.id]?.tutorEarnings ?? 0), 0);
                  const rowAgencyTotal = weeks.reduce((sum, w) => sum + (matrix[tutor.id]?.[w.id]?.agencyEarnings ?? 0), 0);
                  return (
                    <div
                      key={tutor.id}
                      className="grid border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                      style={{ gridTemplateColumns: `160px repeat(${weeks.length}, 120px) 130px` }}
                      data-testid={`row-matrix-${tutor.id}`}
                    >
                      {/* Tutor name cell */}
                      <div className={`p-3 border-r border-border sticky left-0 z-10 ${rowIdx % 2 === 0 ? "bg-background" : ""} ${tutor.isActive === false ? "opacity-50" : ""}`}>
                        <Link href={`/admin/tutors/${tutor.id}/detail`}>
                          <div className={`font-semibold text-sm truncate hover:underline cursor-pointer ${tutor.isActive === false ? "text-muted-foreground" : "text-primary"}`}>{tutor.name}</div>
                        </Link>
                        {tutor.isActive === false && (
                          <Badge variant="outline" className="text-xs px-2 py-0 h-5 leading-none text-muted-foreground border-muted-foreground/40 mt-1">inactivo</Badge>
                        )}
                        <div className="text-xs text-muted-foreground">{tutor.commissionPercent}%</div>
                        {Number(tutor.advertisingCostUsd ?? 0) > 0 && (() => {
                          const half = Number(tutor.advertisingCostUsd) / 2;
                          const pen = half * usdRate;
                          return (
                            <div className="text-xs text-muted-foreground/60 leading-tight">
                              <span className="text-muted-foreground/40">USD</span> {half.toFixed(2)}
                              <span className="text-muted-foreground/30"> · </span>
                              <span className="text-muted-foreground/40">PEN</span> {pen.toFixed(2)}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Week cells */}
                      {weeks.map(w => {
                        const cell = matrix[tutor.id]?.[w.id];
                        const tutorE = cell?.tutorEarnings ?? 0;
                        const agencyE = cell?.agencyEarnings ?? 0;
                        const netTransfer = cell?.netTransfer ?? 0;
                        const hasPayments = (cell?.paymentCount ?? 0) > 0;
                        const hasAdvCharge = (cell?.tutorAdvertisingShare ?? 0) > 0;
                        const showCell = hasPayments || hasAdvCharge;
                        const isAutoVerif = !!(tutor as any).autoVerificaPagos;
                        const isTutorPaid = weekPaidMap[w.id]?.includes(tutor.id) ?? false;
                        return (
                          <div
                            key={w.id}
                            className="p-2 text-right border-r border-border last:border-r-0 text-xs"
                            title={showCell ? `Bruto: ${fmt(cell!.grossIncome)} | ×${tutor.commissionPercent}% = ${fmt(cell!.netIncome)} | −pub = ${fmt(cell!.tutorAdvertisingShare)} | Tutor: ${fmt(tutorE)} | Agencia: ${fmt(agencyE)}` : "Sin actividad"}
                            data-testid={`cell-${tutor.id}-${w.weekNumber}`}
                          >
                            {showCell ? (
                              <>
                                <div className={`text-xs font-bold ${tutorE >= 0 ? "text-success" : "text-destructive"}`}>
                                  {fmt(tutorE)}
                                </div>
                                <div className={`text-xs font-medium ${agencyE >= 0 ? "text-muted-foreground" : "text-destructive"}`}>
                                  {fmt(agencyE)}
                                </div>
                                {isAutoVerif && (
                                  <div className={`text-xs font-semibold mt-1 ${netTransfer < 0 ? "text-destructive" : "text-success"}`}>
                                    {netTransfer < 0
                                      ? `→ te debe ${fmt(Math.abs(netTransfer))}`
                                      : `← agencia paga ${fmt(netTransfer)}`
                                    }
                                  </div>
                                )}
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  <span className="text-xs text-muted-foreground/60">{cell?.paymentCount ?? 0} pg</span>
                                  {isTutorPaid && (
                                    <Badge className="text-xs px-2 py-0 h-5 border-success/40 bg-background text-success leading-none">Pagado</Badge>
                                  )}
                                </div>
                              </>
                            ) : cell?.wasActive === false ? (
                              <span className="text-xs text-muted-foreground/40 italic">inactivo</span>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </div>
                        );
                      })}

                      {/* Total cell */}
                      <div className="p-2 text-right" data-testid={`total-${tutor.id}`}>
                        <div className={`text-xs font-bold ${rowTotal >= 0 ? "text-success" : "text-destructive"}`}>
                          {fmt(rowTotal)}
                        </div>
                        <div className={`text-xs font-medium ${rowAgencyTotal >= 0 ? "text-muted-foreground" : "text-destructive"}`}>
                          {fmt(rowAgencyTotal)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Totals row */}
                <div
                  className="grid border-t-2 border-border font-bold text-sm"
                  style={{ gridTemplateColumns: `160px repeat(${weeks.length}, 120px) 130px` }}
                >
                  <div className="p-2 border-r border-border sticky left-0 z-10 flex flex-col justify-center">
                    <div className="text-xs uppercase text-muted-foreground/70 font-normal leading-4">Total Bruto</div>
                    <div className="text-xs uppercase text-muted-foreground/60 font-normal leading-4">Publicidad Total</div>
                    <div className="text-xs uppercase text-success leading-4">Tutores</div>
                    <div className="text-xs uppercase text-muted-foreground leading-4">Agencia</div>
                  </div>
                  {weeks.map(w => {
                    const colTutor = tutorsWithAnyPayment.reduce(
                      (sum, t) => sum + (matrix[t.id]?.[w.id]?.tutorEarnings ?? 0), 0
                    );
                    const colAgency = tutorsWithAnyPayment.reduce(
                      (sum, t) => sum + (matrix[t.id]?.[w.id]?.agencyEarnings ?? 0), 0
                    );
                    const anyPayments = tutorsWithAnyPayment.some(t =>
                      (matrix[t.id]?.[w.id]?.paymentCount ?? 0) > 0 ||
                      (matrix[t.id]?.[w.id]?.tutorAdvertisingShare ?? 0) > 0
                    );
                    const wkCurrencies = Object.values(weekCurrencyTotals[w.id] ?? {});
                    return (
                      <div key={w.id} className="p-2 text-right text-xs border-r border-border last:border-r-0">
                        {anyPayments ? (
                          <>
                            <div className="text-xs text-muted-foreground/70 font-normal tabular-nums leading-4">
                              {fmt(tutorsWithAnyPayment.reduce((sum, t) => sum + (matrix[t.id]?.[w.id]?.grossIncome ?? 0), 0))}
                            </div>
                            <div className="text-xs text-muted-foreground/60 font-normal tabular-nums leading-4 flex items-center justify-end gap-1">
                              {(() => {
                                const sharedUsd = Number(w.sharedAdvertisingUsd ?? 0);
                                const ownUsd = tutorsWithAnyPayment.reduce((sum, t) => {
                                  const v = tutorWeekAdvMap[t.id]?.[w.id] ?? Number((t as any).advertisingCostUsd ?? 0);
                                  return sum + v;
                                }, 0);
                                const totalUsd = sharedUsd + ownUsd;
                                if (totalUsd <= 0) return "—";
                                const totalPen = totalUsd * usdRate;
                                return (
                                  <>
                                    <span className="text-muted-foreground/40">−USD {totalUsd.toFixed(2)}</span>
                                    <span>{`−${fmt(totalPen)}`}</span>
                                  </>
                                );
                              })()}
                            </div>
                            <div className={`font-bold leading-4 ${colTutor >= 0 ? "text-success" : "text-destructive"}`}>
                              {fmt(colTutor)}
                            </div>
                            <div className={`font-medium leading-4 ${colAgency >= 0 ? "text-muted-foreground" : "text-destructive"}`}>
                              {fmt(colAgency)}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </div>
                    );
                  })}
                  <div className="p-2 text-right">
                    <div className={`text-xs font-bold ${
                      tutorsWithAnyPayment.reduce((sum, t) => sum + weeks.reduce((s, w) => s + (matrix[t.id]?.[w.id]?.tutorEarnings ?? 0), 0), 0) >= 0
                        ? "text-success" : "text-destructive"
                    }`}>
                      {fmt(tutorsWithAnyPayment.reduce((sum, t) => sum + weeks.reduce((s, w) => s + (matrix[t.id]?.[w.id]?.tutorEarnings ?? 0), 0), 0))}
                    </div>
                    <div className={`text-xs font-medium ${
                      tutorsWithAnyPayment.reduce((sum, t) => sum + weeks.reduce((s, w) => s + (matrix[t.id]?.[w.id]?.agencyEarnings ?? 0), 0), 0) >= 0
                        ? "text-muted-foreground" : "text-destructive"
                    }`}>
                      {fmt(tutorsWithAnyPayment.reduce((sum, t) => sum + weeks.reduce((s, w) => s + (matrix[t.id]?.[w.id]?.agencyEarnings ?? 0), 0), 0))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
