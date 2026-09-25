import { useQuery } from "@tanstack/react-query";
import { PaymentWithDetails, Week } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, XCircle, Clock, FileText, Image as ImageIcon, RotateCcw, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { PaymentActions } from "@/components/payment-actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { todayPeru } from "@/lib/utils";
import { WeekSelector } from "@/components/week-selector";

const statusConfig: Record<string, { label: string; variant: "secondary" | "default" | "destructive" | "outline"; icon: typeof Clock; className: string }> = {
  pending: { label: "Pendiente", variant: "secondary", icon: Clock, className: "text-warning border-warning/40" },
  verified: { label: "Verificado", variant: "default", icon: CheckCircle, className: "text-success border-success/40" },
  rejected: { label: "Rechazado", variant: "destructive", icon: XCircle, className: "text-destructive border-destructive/40" },
  refunded: { label: "Reembolsado", variant: "outline", icon: RotateCcw, className: "text-muted-foreground border-border" },
};

type SettlementRow = {
  week: Week;
  grossIncome: number;
  grossRegular: number;
  grossDirect: number;
  advertisingCost: number;
  netIncome: number;
  tutorEarnings: number;
  agencyEarnings: number;
  netTransfer: number;
  commissionPercent: number;
  payments: PaymentWithDetails[];
};

type SettlementData = {
  settlements: SettlementRow[];
  commissionPercent: number;
};

function pen(val: number) {
  // Formato único de montos: valor primero, divisa después ("70.00 PEN")
  return `${val.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PEN`;
}

function CurrentWeekSummaryCard({ settlements, currentWeek }: { settlements: SettlementRow[]; currentWeek: Week | undefined }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showNegWarning, setShowNegWarning] = useState(false);

  if (!currentWeek) return null;

  const s = settlements.find(r => r.week.id === currentWeek.id);
  if (!s) {
    return (
      <Card className="border-dashed" data-testid="card-week-summary">
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground text-center">Sin pagos verificados esta semana (S{currentWeek.weekNumber})</p>
        </CardContent>
      </Card>
    );
  }

  const isNegative = s.tutorEarnings < 0;
  const fmt2 = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card className="overflow-hidden" data-testid="card-week-summary">
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="text-foreground text-sm font-semibold">Resumen S{currentWeek.weekNumber}</span>
        {/* Popover y no tooltip: en móvil se abre con un toque */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-primary"
              aria-label="Solo pagos verificados"
              data-testid="button-summary-info"
            >
              <AlertCircle className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto px-3 py-2 text-xs">Solo pagos verificados</PopoverContent>
        </Popover>
      </div>

      <CardContent className="pt-6 space-y-2">
        {/* Ganancia estimada: solo cuando no hay balance de transferencia (sin pagos, p. ej. solo publicidad); si lo hay, repetiría el mismo monto */}
        {!(s.grossRegular > 0 || s.grossDirect > 0) && (
        <div data-testid="summary-tutor-earnings">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2 text-foreground">
              Ganancia estimada
              {isNegative && (
                <button
                  onClick={() => setShowNegWarning(v => !v)}
                  className="inline-flex items-center justify-center rounded-full w-4 h-4 hover:bg-accent transition-colors border border-destructive/30"
                  data-testid="button-neg-warning"
                >
                  <AlertCircle className="h-3 w-3 text-destructive" />
                </button>
              )}
            </span>
            <span className="font-mono text-base font-bold text-foreground">
              {pen(s.tutorEarnings)}
            </span>
          </div>
          {isNegative && showNegWarning && (
            <div className="mt-2 text-xs text-destructive/80 rounded-sm px-2 py-2 border border-destructive/30" data-testid="text-neg-warning">
              ⚠️ El costo de publicidad de esta semana (<strong>{pen(s.advertisingCost)}</strong>) supera tu comisión sobre los pagos regulares (<strong>{pen(s.grossRegular * s.commissionPercent / 100)}</strong>). Eso genera una ganancia negativa. Si tienes pagos DIRECTO, parte de esa diferencia puede quedar cubierta por lo que le debes a la agencia.
            </div>
          )}
        </div>
        )}

        {/* Balance de transferencia — quién le debe a quién */}
        {(s.grossRegular > 0 || s.grossDirect > 0) && (() => {
          const transfer = s.netTransfer;
          const agencyOwes = transfer > 0;
          const even = Math.abs(transfer) < 0.01;
          return (
            <div data-testid="summary-net-transfer">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${even ? "font-semibold text-muted-foreground" : agencyOwes ? "text-foreground" : "font-semibold text-warning"}`}>
                  {even ? "⚖️ Estamos al día" : agencyOwes ? "Tus ingresos" : "🔴 Debes transferir a la agencia"}
                </span>
                {!even && (
                  <span className={`font-mono text-base font-bold ${agencyOwes ? "text-success" : "text-warning"}`}>
                    {pen(Math.abs(transfer))}
                  </span>
                )}
              </div>
              {!even && (() => {
                const commission = s.commissionPercent / 100;
                const agencyCommission = s.grossDirect * (1 - commission);
                const regularTutorGross = s.grossRegular * commission;
                const uncoveredAdv = Math.max(0, s.advertisingCost - regularTutorGross);
                // Si la agencia te debe, el desglose ya está en "Ver cálculo detallado"
                if (agencyOwes) return null;
                // Tutor pays agency: (direct * 30%) + uncovered advertising
                return (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground border-t border-border pt-2">
                    {agencyCommission > 0 && (
                      <div className="flex justify-between">
                        <span>Comisión agencia ({100 - s.commissionPercent}%) sobre {pen(s.grossDirect)}</span>
                        <span className="text-right font-mono tabular-nums">{fmt2(agencyCommission)} PEN</span>
                      </div>
                    )}
                    {uncoveredAdv > 0 && (
                      <div className="flex justify-between">
                        <span>Publicidad sin cubrir por tus ingresos regulares</span>
                        <span className="text-right font-mono tabular-nums">{fmt2(uncoveredAdv)} PEN</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Toggle detalles */}
        <button
          onClick={() => setShowDetails(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-toggle-details"
        >
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showDetails ? "Ocultar detalles" : "Ver cálculo detallado"}
        </button>

        {/* Detalles expandibles */}
        {showDetails && (
          <div className="space-y-3 border-t pt-2">

            {/* Desglose por divisa */}
            {(() => {
              const byCode: Record<string, number> = {};
              s.payments.forEach(p => {
                const code = p.currency?.code ?? "?";
                byCode[code] = (byCode[code] ?? 0) + Number(p.amount);
              });
              const entries = Object.entries(byCode);
              if (entries.length === 0) return null;
              return (
                <div className="space-y-1" data-testid="summary-currency-breakdown">
                  <div className="text-sm font-normal text-muted-foreground">
                    Cobrado por divisa
                  </div>
                  {entries.map(([code, total]) => (
                    <div key={code} className="flex items-center justify-between text-sm font-normal text-muted-foreground">
                      <span>Ingresos en {code}</span>
                      <span className="text-right font-mono tabular-nums text-foreground">{fmt2(total)} {code}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Fórmula paso a paso */}
            <div className="space-y-2 text-sm font-normal text-muted-foreground" data-testid="summary-formula">
              <div className="text-sm font-normal text-muted-foreground">Cálculo</div>

              <div className="flex items-center justify-between" data-testid="summary-gross-income">
                <span className="flex items-center gap-2">
                  Ingresos brutos
                </span>
                <span className="text-right font-mono tabular-nums text-foreground">{pen(s.grossIncome)}</span>
              </div>

              <div className="flex items-center justify-between" data-testid="summary-advertising">
                <span className="flex items-center gap-2">
                  Publicidad tutor
                </span>
                <span className="text-right font-mono tabular-nums text-foreground">- {pen(s.advertisingCost)}</span>
              </div>

              <div className="flex items-center justify-between" data-testid="summary-advertising-agency">
                <span className="flex items-center gap-2">
                  Publicidad agencia
                </span>
                <span className="text-right font-mono tabular-nums text-foreground">- {pen(s.advertisingCost)}</span>
              </div>

              <div className="border-t border-border pt-1 flex items-center justify-between" data-testid="summary-net-income">
                <span>Ingresos netos base</span>
                <span className="text-right font-mono tabular-nums text-foreground">{pen(s.grossIncome - s.advertisingCost)}</span>
              </div>

              <div className="text-sm font-normal text-muted-foreground pt-3">Reparto</div>

              <div className="flex items-center justify-between">
                <span>Tutor ({s.commissionPercent}%)</span>
                <span className="text-right font-mono tabular-nums text-foreground">{pen(s.tutorEarnings)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  Agencia ({100 - s.commissionPercent}%)
                  {s.agencyEarnings < 0 && (
                    <button onClick={() => setShowNegWarning(v => !v)} className="inline-flex">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                    </button>
                  )}
                </span>
                <span className="text-right font-mono tabular-nums text-foreground">{pen(s.agencyEarnings)}</span>
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TutorPaymentsPage() {
  const { user } = useAuth();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  const { data: weeks } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const { data: settlementData } = useQuery<SettlementData>({
    queryKey: ["/api/tutor/settlement"],
  });

  const sortedWeeks = [...(weeks ?? [])].sort((a, b) => a.weekNumber - b.weekNumber);

  const today = todayPeru();
  const currentWeek = sortedWeeks.find(w => w.startDate <= today && w.endDate >= today);
  const isWeekPast = (week: Week) => week.endDate < today;

  const activeWeekId = selectedWeekId ?? currentWeek?.id ?? sortedWeeks[sortedWeeks.length - 1]?.id ?? null;

  const { data: payments, isLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/tutor/payments", "week", activeWeekId],
    queryFn: async () => {
      if (!activeWeekId) return [];
      const res = await fetch(`/api/tutor/payments?weekId=${activeWeekId}`);
      if (!res.ok) throw new Error("Error al cargar pagos");
      return res.json();
    },
    enabled: !!activeWeekId,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const filteredPayments = payments ?? [];

  const selectedWeek = sortedWeeks.find(w => w.id === activeWeekId);

  return (
    <div className="space-y-6 relative pb-24">

      {/* Saludo + selector de semana: filtro global de la pantalla (historial y resumen) */}
      <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenido, {user?.name?.split(" ")[0]} 👋
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WeekSelector
            weeks={sortedWeeks}
            value={activeWeekId}
            onValueChange={setSelectedWeekId}
            currentWeekId={currentWeek?.id}
          />
        </div>
      </div>

      {/* Acción principal del tutor: ancho completo, encima de la tabla */}
      <PaymentActions className="sm:flex-row [&>button]:flex-1" disabled={!!selectedWeek && selectedWeek.id !== currentWeek?.id} />

      <Card className="overflow-hidden">
      {isLoading ? (
        <div>
          <div className="space-y-0 divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-8 rounded-sm" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredPayments?.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-border">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-lg">No hay pagos</h3>
          <p className="text-muted-foreground text-sm">
            {activeWeekId ? "No hay pagos en esta semana" : "Registra tu primer pago"}
          </p>
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-muted/40">
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-center">Img</TableHead>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Teléfono</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments?.map((payment, index) => {
                  const status = statusConfig[payment.status] ?? statusConfig.pending;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={payment.id} data-testid={`payment-card-${payment.id}`} className="hover:bg-muted/40">
                      <TableCell>
                        <Badge className={`gap-1 text-xs px-2 py-1 ${status.className}`} data-testid={`badge-status-${payment.id}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-sm tabular-nums">
                          {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">{payment.currency?.code ?? ""}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {payment.proofImage ? (
                          <button
                            onClick={() => setPreviewImage(payment.proofImage!)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-sm overflow-hidden border hover:opacity-80 transition-opacity mx-auto"
                            data-testid={`button-proof-${payment.id}`}
                          >
                            <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="inline-flex items-center justify-center w-8 h-8 rounded-sm border mx-auto">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        #{index + 1}
                      </TableCell>
                      <TableCell>
                        {payment.createdAt && format(new Date(payment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{payment.clientNumber}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      </Card>

      {/* Resumen de la semana seleccionada */}
      {settlementData && (
        <CurrentWeekSummaryCard
          settlements={settlementData.settlements}
          currentWeek={selectedWeek}
        />
      )}



      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Comprobante de Pago</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="overflow-y-auto flex-1">
              <img
                src={previewImage}
                alt="Comprobante"
                className="w-full rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
