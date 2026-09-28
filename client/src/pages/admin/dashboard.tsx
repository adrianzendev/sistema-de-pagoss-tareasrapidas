import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaidToggleButton } from "@/components/paid-toggle-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Users, CreditCard, Coins, TableIcon, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import type { Week, User } from "@shared/schema";
import { todayPeru, formatShortDate } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  tutors: Array<{ id: string; username: string; name: string; commissionPercent: string; advertisingCostUsd?: string; autoVerificaPagos?: boolean; isActive?: boolean }>;
  matrix: Record<string, Record<string, MatrixCell>>;
  currencyTotals: CurrencyTotal[];
  weekPaidMap: Record<string, string[]>;
  weekCurrencyTotals: Record<string, Record<string, { code: string; symbol: string; total: number }>>;
  tutorWeekAdvMap: Record<string, Record<string, number>>;
  usdRate: number;
};

type TutorRow = { id: string; name: string; commissionPercent: string };

const DEFAULT_TUTOR_COL_WIDTH = 160;
const DEFAULT_WEEK_COL_WIDTH = 144;
const DEFAULT_TOTAL_COL_WIDTH = 130;
const MIN_COL_WIDTH = 96;

function ColumnResizeHandle({ width, onResize }: { width: number; onResize: (newWidth: number) => void }) {
  return (
    <div
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none z-20"
      onMouseDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = width;
        const handleMove = (moveEvent: MouseEvent) => {
          onResize(Math.max(MIN_COL_WIDTH, startWidth + (moveEvent.clientX - startX)));
        };
        const handleUp = () => {
          document.removeEventListener("mousemove", handleMove);
          document.removeEventListener("mouseup", handleUp);
        };
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleUp);
      }}
    />
  );
}

export default function AdminDashboard() {
  const [selectedTutor, setSelectedTutor] = useState<TutorRow | null>(null);
  const [periodFilter, setPeriodFilterState] = useState<string>("all");

  const { data: me } = useQuery<User>({ queryKey: ["/api/auth/me"] });

  useEffect(() => {
    if (me?.dashboardPeriodFilter) setPeriodFilterState(me.dashboardPeriodFilter);
  }, [me?.dashboardPeriodFilter]);

  const setPeriodFilter = (value: string) => {
    setPeriodFilterState(value);
    queryClient.setQueryData<User>(["/api/auth/me"], (prev) =>
      prev ? { ...prev, dashboardPeriodFilter: value } : prev
    );
    apiRequest("PATCH", "/api/auth/preferences", { dashboardPeriodFilter: value }).catch(console.error);
  };
  const [detailsCell, setDetailsCell] = useState<{
    tutorName: string;
    weekNumber: number;
    commissionPercent: string;
    cell: MatrixCell | undefined;
  } | null>(null);
  const [hiddenTutors, setHiddenTutors] = useState<Set<string>>(new Set());
  const toggleTutorHidden = (tutorId: string) => {
    setHiddenTutors(prev => {
      const next = new Set(prev);
      if (next.has(tutorId)) next.delete(tutorId);
      else next.add(tutorId);
      return next;
    });
  };
  const [tutorColWidth, setTutorColWidth] = useState(DEFAULT_TUTOR_COL_WIDTH);
  const [totalColWidth, setTotalColWidth] = useState(DEFAULT_TOTAL_COL_WIDTH);
  const [weekColWidths, setWeekColWidths] = useState<Record<string, number>>({});

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/stats?period=all`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: matrixData, isLoading: matrixLoading } = useQuery<SettlementsMatrix>({
    queryKey: ["/api/admin/settlements/matrix"],
    staleTime: 5 * 60 * 1000,
  });

  const fmt = (n: number) =>
    `${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} PEN`;

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

  const today = todayPeru();
  const allWeeks = matrixData?.weeks ?? [];
  const tutors = matrixData?.tutors ?? [];
  const matrix = matrixData?.matrix ?? {};
  const currencyTotals = matrixData?.currencyTotals ?? [];
  const weekCurrencyTotals: Record<string, Record<string, { code: string; symbol: string; total: number }>> = matrixData?.weekCurrencyTotals ?? {};
  const weekPaidMap: Record<string, string[]> = matrixData?.weekPaidMap ?? {};
  const tutorWeekAdvMap: Record<string, Record<string, number>> = matrixData?.tutorWeekAdvMap ?? {};
  const usdRate = matrixData?.usdRate ?? 1;

  const tutorsWithAnyPayment = tutors;

  const monthOptions = Array.from(
    new Map(
      allWeeks.map(w => {
        const d = new Date(w.startDate + "T00:00:00");
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
        return [key, label];
      })
    ).entries()
  ).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const weeks = periodFilter === "all"
    ? allWeeks
    : periodFilter.startsWith("week:")
      ? allWeeks.filter(w => w.id === periodFilter.slice(5))
      : allWeeks.filter(w => {
          const d = new Date(w.startDate + "T00:00:00");
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return key === periodFilter;
        });

  const gridTemplateColumns = `${tutorColWidth}px ${weeks.map(w => `${weekColWidths[w.id] ?? DEFAULT_WEEK_COL_WIDTH}px`).join(" ")} ${totalColWidth}px`;
  const resizeWeekCol = (weekId: string, newWidth: number) => {
    setWeekColWidths(prev => ({ ...prev, [weekId]: newWidth }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general del sistema de gestión de tutores</p>
      </div>


      {/* Settlements matrix table */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Ganancias por Tutor y Semana</h2>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-56" data-testid="select-period-filter">
            <SelectValue placeholder="Todas las semanas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las semanas</SelectItem>
            {monthOptions.map(([key, label]) => (
              <SelectItem key={key} value={key} className="capitalize">{label}</SelectItem>
            ))}
            {[...allWeeks].sort((a, b) => b.weekNumber - a.weekNumber).map(w => (
              <SelectItem key={w.id} value={`week:${w.id}`}>
                S{w.weekNumber} ({formatShortDate(new Date(w.startDate + "T00:00:00"))} - {formatShortDate(new Date(w.endDate + "T00:00:00"))})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {matrixLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : tutorsWithAnyPayment.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TableIcon className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p>No hay liquidaciones registradas aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${tutorColWidth + weeks.reduce((sum, w) => sum + (weekColWidths[w.id] ?? DEFAULT_WEEK_COL_WIDTH), 0) + totalColWidth}px` }}>
                {/* Header */}
                <div
                  className="grid border-b-2 border-border text-xs font-bold uppercase"
                  style={{ gridTemplateColumns }}
                >
                  <div className="relative p-3 border-r border-border sticky left-0 z-10 bg-card">
                    Tutor
                    <ColumnResizeHandle width={tutorColWidth} onResize={setTutorColWidth} />
                  </div>
                  {weeks.map(w => {
                    const isCurrent = w.startDate <= today && w.endDate >= today;
                    return (
                      <div key={w.id} className="relative p-2 text-center border-r border-border last:border-r-0">
                        <div className={`normal-case ${isCurrent ? "font-bold text-foreground" : "font-normal text-muted-foreground"}`}>
                          S{w.weekNumber}
                          <span className="text-xs"> ({formatShortDate(new Date(w.startDate + "T00:00:00"))}{" - "}{formatShortDate(new Date(w.endDate + "T00:00:00"))})</span>
                        </div>
                        <ColumnResizeHandle
                          width={weekColWidths[w.id] ?? DEFAULT_WEEK_COL_WIDTH}
                          onResize={(newWidth) => resizeWeekCol(w.id, newWidth)}
                        />
                      </div>
                    );
                  })}
                  <div className="relative p-2 text-center text-primary">
                    TOTAL
                    <ColumnResizeHandle width={totalColWidth} onResize={setTotalColWidth} />
                  </div>
                </div>

                {/* Tutor rows */}
                {tutorsWithAnyPayment.map((tutor) => {
                  const rowTotal = weeks.reduce((sum, w) => sum + (matrix[tutor.id]?.[w.id]?.tutorEarnings ?? 0), 0);
                  const rowAgencyTotal = weeks.reduce((sum, w) => sum + (matrix[tutor.id]?.[w.id]?.agencyEarnings ?? 0), 0);
                  return (
                    <div
                      key={tutor.id}
                      className="grid border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
                      style={{ gridTemplateColumns }}
                      data-testid={`row-matrix-${tutor.id}`}
                    >
                      {/* Tutor name cell */}
                      <div className="p-3 border-r border-border sticky left-0 z-10 bg-card">
                        <div className="flex items-center gap-1">
                          <Link href={`/admin/tutors/${tutor.username}/view`}>
                            <div className={`font-semibold text-sm truncate underline cursor-pointer ${tutor.isActive === false ? "text-muted-foreground" : "text-foreground"}`}>{tutor.name}</div>
                          </Link>
                          <button
                            className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0"
                            onClick={() => toggleTutorHidden(tutor.id)}
                            title={hiddenTutors.has(tutor.id) ? "Mostrar (no afecta los totales)" : "Ocultar (no afecta los totales)"}
                            data-testid={`btn-toggle-hidden-${tutor.id}`}
                          >
                            {hiddenTutors.has(tutor.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                        {tutor.isActive === false && (
                          <Badge variant="outline" className="text-xs px-2 py-0 h-5 leading-none text-muted-foreground border-muted-foreground/40 mt-1">inactivo</Badge>
                        )}
                        <div className="text-xs text-muted-foreground">
                          <span className="text-muted-foreground/60">Comisión:</span> {tutor.commissionPercent}%
                        </div>
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
                        const isCurrentWeek = w.startDate <= today && w.endDate >= today;
                        const isHidden = hiddenTutors.has(tutor.id);
                        return (
                          <div
                            key={w.id}
                            className="p-2 text-right border-r border-border last:border-r-0 text-xs cursor-pointer"
                            onClick={() => setDetailsCell({ tutorName: tutor.name, weekNumber: w.weekNumber, commissionPercent: tutor.commissionPercent, cell })}
                            data-testid={`cell-${tutor.id}-${w.weekNumber}`}
                          >
                            {isHidden && showCell ? (
                              <span className="text-xs text-muted-foreground/40 italic">oculto</span>
                            ) : showCell ? (
                              <>
                                <div className="flex items-baseline justify-between gap-1">
                                  <span className="text-xs text-muted-foreground/60">Tutor:</span>
                                  <span className={`text-xs ${tutorE < 0 ? "text-negative" : tutorE > 0 ? "text-positive" : "text-foreground"}`}>{fmt(tutorE)}</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-1">
                                  <span className="text-xs text-muted-foreground/60">Agencia:</span>
                                  <span className={`text-xs ${agencyE < 0 ? "text-negative" : agencyE > 0 ? "text-positive" : "text-foreground"}`}>{fmt(agencyE)}</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-1 mt-1">
                                  <span className="text-xs text-muted-foreground/60">Cantidad:</span>
                                  <span className="text-xs text-foreground">{cell?.paymentCount ?? 0} pagos</span>
                                </div>
                                <div className="flex justify-end mt-1" onClick={e => e.stopPropagation()}>
                                  <PaidToggleButton
                                    tutorId={tutor.id}
                                    tutorName={tutor.name}
                                    weekId={w.id}
                                    weekNumber={w.weekNumber}
                                    isPaid={isTutorPaid}
                                  />
                                </div>
                                {isAutoVerif && (
                                  <div className="mt-1 pt-1 border-t border-border text-xs font-semibold text-foreground">
                                    {netTransfer < 0
                                      ? `${tutor.name} → Agencia: ${fmt(Math.abs(netTransfer))}`
                                      : `Agencia → ${tutor.name}: ${fmt(netTransfer)}`
                                    }
                                  </div>
                                )}
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
                        {hiddenTutors.has(tutor.id) ? (
                          <span className="text-xs text-muted-foreground/40 italic">oculto</span>
                        ) : (
                          <>
                            <div className={`text-xs font-bold ${rowTotal < 0 ? "text-negative" : rowTotal > 0 ? "text-positive" : "text-foreground"}`}>
                              {fmt(rowTotal)}
                            </div>
                            <div className={`text-xs font-medium ${rowAgencyTotal < 0 ? "text-negative" : rowAgencyTotal > 0 ? "text-positive" : "text-muted-foreground"}`}>
                              {fmt(rowAgencyTotal)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Totals row */}
                <div
                  className="grid border-t-2 border-border text-sm"
                  style={{ gridTemplateColumns }}
                >
                  <div className="p-2 border-r border-border sticky left-0 z-10 bg-card" />
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
                            <div className="flex items-baseline justify-between gap-1 leading-4">
                              <span className="text-muted-foreground/60">Bruto:</span>
                              <span className="text-muted-foreground/70">
                                {fmt(tutorsWithAnyPayment.reduce((sum, t) => sum + (matrix[t.id]?.[w.id]?.grossIncome ?? 0), 0))}
                              </span>
                            </div>
                            {(() => {
                              const sharedUsd = Number(w.sharedAdvertisingUsd ?? 0);
                              const ownUsd = tutorsWithAnyPayment.reduce((sum, t) => {
                                if (matrix[t.id]?.[w.id]?.wasActive === false) return sum;
                                const v = tutorWeekAdvMap[t.id]?.[w.id] ?? Number((t as any).advertisingCostUsd ?? 0);
                                return sum + v;
                              }, 0);
                              const totalUsd = sharedUsd + ownUsd;
                              if (totalUsd <= 0) {
                                return (
                                  <div className="flex items-baseline justify-between gap-1 leading-4">
                                    <span className="text-muted-foreground/60">Publicidad:</span>
                                    <span className="text-muted-foreground/60">—</span>
                                  </div>
                                );
                              }
                              const totalPen = totalUsd * usdRate;
                              return (
                                <div className="flex items-baseline justify-between gap-1 leading-4">
                                  <span className="text-muted-foreground/60">Publicidad (USD {totalUsd.toFixed(2)}):</span>
                                  <span className="text-muted-foreground/60">{`−${fmt(totalPen)}`}</span>
                                </div>
                              );
                            })()}
                            <div className="flex items-baseline justify-between gap-1 leading-4">
                              <span className="text-muted-foreground/60">Tutor:</span>
                              <span className={`font-semibold ${colTutor < 0 ? "text-negative" : colTutor > 0 ? "text-positive" : "text-foreground"}`}>{fmt(colTutor)}</span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1 leading-4">
                              <span className="text-muted-foreground/60">Agencia:</span>
                              <span className={`font-semibold ${colAgency < 0 ? "text-negative" : colAgency > 0 ? "text-positive" : "text-foreground"}`}>{fmt(colAgency)}</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </div>
                    );
                  })}
                  {(() => {
                    const grandTutor = tutorsWithAnyPayment.reduce((sum, t) => sum + weeks.reduce((s, w) => s + (matrix[t.id]?.[w.id]?.tutorEarnings ?? 0), 0), 0);
                    const grandAgency = tutorsWithAnyPayment.reduce((sum, t) => sum + weeks.reduce((s, w) => s + (matrix[t.id]?.[w.id]?.agencyEarnings ?? 0), 0), 0);
                    return (
                      <div className="p-2 text-right">
                        <div className={`text-xs font-semibold ${grandTutor < 0 ? "text-negative" : grandTutor > 0 ? "text-positive" : "text-foreground"}`}>
                          {fmt(grandTutor)}
                        </div>
                        <div className={`text-xs font-semibold ${grandAgency < 0 ? "text-negative" : grandAgency > 0 ? "text-positive" : "text-foreground"}`}>
                          {fmt(grandAgency)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailsCell} onOpenChange={(open) => !open && setDetailsCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detailsCell?.tutorName} — S{detailsCell?.weekNumber}
            </DialogTitle>
          </DialogHeader>
          {detailsCell?.cell ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-muted-foreground/60">Bruto:</span>
                <span className="text-foreground">{fmt(detailsCell.cell.grossIncome)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-muted-foreground/60">Comisión Tutor ({detailsCell.commissionPercent}%):</span>
                <span className={detailsCell.cell.netIncome < 0 ? "text-negative" : "text-foreground"}>{fmt(detailsCell.cell.netIncome)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-muted-foreground/60">Comisión Agencia ({100 - Number(detailsCell.commissionPercent)}%):</span>
                <span className={detailsCell.cell.grossIncome - detailsCell.cell.netIncome < 0 ? "text-negative" : "text-foreground"}>{fmt(detailsCell.cell.grossIncome - detailsCell.cell.netIncome)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-muted-foreground/60">Publicidad Tutor:</span>
                <span className={detailsCell.cell.tutorAdvertisingShare > 0 ? "text-negative" : "text-foreground"}>{fmt(detailsCell.cell.tutorAdvertisingShare > 0 ? -detailsCell.cell.tutorAdvertisingShare : 0)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-muted-foreground/60">Publicidad Agencia:</span>
                <span className={detailsCell.cell.tutorAdvertisingShare > 0 ? "text-negative" : "text-foreground"}>{fmt(detailsCell.cell.tutorAdvertisingShare > 0 ? -detailsCell.cell.tutorAdvertisingShare : 0)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1 pt-2 border-t border-border">
                <span className="text-muted-foreground/60">Saldo Tutor:</span>
                <span className="font-semibold text-foreground">{fmt(detailsCell.cell.tutorEarnings)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-muted-foreground/60">Saldo Agencia:</span>
                <span className="text-foreground">{fmt(detailsCell.cell.agencyEarnings)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin actividad</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
