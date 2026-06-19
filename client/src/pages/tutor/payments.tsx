import { useQuery } from "@tanstack/react-query";
import { PaymentWithDetails, Week } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, XCircle, Clock, FileText, Image as ImageIcon, Calendar, Phone, RotateCcw, PlusCircle, Lock, TrendingUp, Megaphone, DollarSign, Coins, ChevronDown, ChevronUp } from "lucide-react";
import { NewPaymentModal } from "@/components/new-payment-modal";
import { VerifiedPaymentModal } from "@/components/verified-payment-modal";

const statusConfig: Record<string, { label: string; variant: "secondary" | "default" | "destructive" | "outline"; icon: typeof Clock; className: string }> = {
  pending: { label: "Pendiente", variant: "secondary", icon: Clock, className: "bg-warning/10 text-warning" },
  verified: { label: "Verificado", variant: "default", icon: CheckCircle, className: "bg-success/10 text-success" },
  rejected: { label: "Rechazado", variant: "destructive", icon: XCircle, className: "bg-destructive/10 text-destructive" },
  refunded: { label: "Reembolsado", variant: "outline", icon: RotateCcw, className: "bg-muted text-muted-foreground" },
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
  return `PEN ${val.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CurrentWeekSummaryCard({ settlements, currentWeek }: { settlements: SettlementRow[]; currentWeek: Week | undefined }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!currentWeek) return null;

  const s = settlements.find(r => r.week.id === currentWeek.id);
  if (!s) {
    return (
      <Card className="border-dashed" data-testid="card-week-summary">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground text-center">Sin pagos verificados esta semana (S{currentWeek.weekNumber})</p>
        </CardContent>
      </Card>
    );
  }

  const isNegative = s.tutorEarnings < 0;
  const fmt2 = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card className="overflow-hidden" data-testid="card-week-summary">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-white/80" />
          <span className="text-white text-sm font-semibold">Resumen S{currentWeek.weekNumber}</span>
        </div>
        <Badge className="bg-white/20 text-white text-[10px] border-0 hover:bg-white/20">
          Solo verificados
        </Badge>
      </div>

      <CardContent className="py-3 px-4 space-y-1.5">
        {/* Ganancia estimada — siempre visible */}
        <div className={`rounded-md px-3 py-2 flex items-center justify-between ${isNegative ? "bg-destructive/10" : "bg-success/10"}`} data-testid="summary-tutor-earnings">
          <span className={`text-sm font-semibold ${isNegative ? "text-destructive" : "text-success"}`}>
            Ganancia estimada
          </span>
          <span className={`font-mono text-base font-bold ${isNegative ? "text-destructive" : "text-success"}`}>
            {pen(s.tutorEarnings)}
          </span>
        </div>

        {/* Balance de transferencia — quién le debe a quién */}
        {(s.grossRegular > 0 || s.grossDirect > 0) && (() => {
          const transfer = s.netTransfer;
          const agencyOwes = transfer > 0;
          const even = Math.abs(transfer) < 0.01;
          return (
            <div className={`rounded-md px-3 py-2.5 border ${
              even ? "border-muted bg-muted/20" :
              agencyOwes ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
            }`} data-testid="summary-net-transfer">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${even ? "text-muted-foreground" : agencyOwes ? "text-success" : "text-warning"}`}>
                  {even ? "⚖️ Estamos al día" : agencyOwes ? "✅ La agencia te debe" : "🔴 Debes transferir a la agencia"}
                </span>
                {!even && (
                  <span className={`font-mono text-sm font-bold ${agencyOwes ? "text-success" : "text-warning"}`}>
                    {pen(Math.abs(transfer))}
                  </span>
                )}
              </div>
              {!even && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {agencyOwes
                    ? `Agencia cobró PEN ${fmt2(s.grossRegular)} → te paga tu ${s.commissionPercent}% menos gastos`
                    : `Tú cobraste PEN ${fmt2(s.grossDirect)} directo → le pagas a la agencia su ${100 - s.commissionPercent}%`
                  }
                </p>
              )}
            </div>
          );
        })()}

        {/* Toggle detalles */}
        <button
          onClick={() => setShowDetails(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-toggle-details"
        >
          {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
                <div className="bg-muted/40 rounded-md px-3 py-2 space-y-1" data-testid="summary-currency-breakdown">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
                    <Coins className="h-3 w-3" />
                    Cobrado por divisa
                  </div>
                  {entries.map(([code, total]) => (
                    <div key={code} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground">{code}</span>
                      <span className="font-mono font-medium tabular-nums">{fmt2(total)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Fórmula paso a paso */}
            <div className="bg-muted/30 rounded-md px-3 py-2 space-y-1.5 text-xs" data-testid="summary-formula">
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Cálculo</div>

              <div className="flex items-center justify-between" data-testid="summary-gross-income">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3" /> Ingresos brutos
                </span>
                <span className="font-mono font-medium">{pen(s.grossIncome)}</span>
              </div>

              <div className="flex items-center justify-between text-destructive" data-testid="summary-advertising">
                <span className="flex items-center gap-1.5">
                  <Megaphone className="h-3 w-3" /> Publicidad
                </span>
                <span className="font-mono">− {pen(s.advertisingCost)}</span>
              </div>

              <div className="border-t pt-1 flex items-center justify-between text-muted-foreground" data-testid="summary-net-income">
                <span>Base neta</span>
                <span className="font-mono">= {pen(s.grossIncome - s.advertisingCost)}</span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Tu comisión ({s.commissionPercent}%)</span>
                <span className="font-mono">× {s.commissionPercent / 100}</span>
              </div>

              <div className="border-t pt-1 flex items-center justify-between font-semibold">
                <span>= Ganancia tutor</span>
                <span className={`font-mono ${isNegative ? "text-destructive" : "text-success"}`}>{pen(s.tutorEarnings)}</span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Parte agencia (30%)</span>
                <span className="font-mono">{pen(s.agencyEarnings)}</span>
              </div>
            </div>

            {/* Lista de pagos */}
            {s.payments.length > 0 && (
              <div className="space-y-1" data-testid="summary-payments-list">
                <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide px-1">Pagos incluidos ({s.payments.length})</div>
                {s.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-mono truncate text-muted-foreground">{p.clientNumber}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="font-mono font-medium tabular-nums">
                        {fmt2(Number(p.amount))}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">
                        {p.currency?.code ?? "?"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);
  const [isVerifiedPaymentOpen, setIsVerifiedPaymentOpen] = useState(false);

  const { data: payments, isLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/tutor/payments"],
  });

  const { data: weeks } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const { data: settlementData } = useQuery<SettlementData>({
    queryKey: ["/api/tutor/settlement"],
  });

  const sortedWeeks = [...(weeks ?? [])].sort((a, b) => a.weekNumber - b.weekNumber);

  const isPaymentInWeek = (payment: PaymentWithDetails, week: Week) => {
    if (!payment.createdAt) return false;
    const paymentDate = new Date(payment.createdAt);
    const startDate = new Date(week.startDate + "T00:00:00");
    const endDate = new Date(week.endDate + "T23:59:59");
    return paymentDate >= startDate && paymentDate <= endDate;
  };

  const getWeekForPayment = (payment: PaymentWithDetails) => {
    return sortedWeeks.find(w => isPaymentInWeek(payment, w));
  };

  const today = new Date().toISOString().split("T")[0];
  const currentWeek = sortedWeeks.find(w => w.startDate <= today && w.endDate >= today);
  const isWeekPast = (week: Week) => week.endDate < today;

  const activeWeekId = selectedWeekId ?? currentWeek?.id ?? sortedWeeks[sortedWeeks.length - 1]?.id ?? null;

  const filteredPayments = activeWeekId
    ? payments?.filter(p => {
        const week = sortedWeeks.find(w => w.id === activeWeekId);
        return week ? isPaymentInWeek(p, week) : false;
      })
    : [];

  const selectedWeek = sortedWeeks.find(w => w.id === activeWeekId);

  return (
    <div className="space-y-4 relative pb-24">

      {/* Saludo de bienvenida */}
      <div className="px-1">
        <h1 className="text-xl font-bold text-foreground">
          Bienvenido, {user?.name?.split(" ")[0]} 👋
        </h1>
        {currentWeek ? (
          <p className="text-sm text-muted-foreground mt-0.5">
            Semana S{currentWeek.weekNumber} · {format(new Date(currentWeek.startDate + "T12:00:00"), "d MMM", { locale: es })} – {format(new Date(currentWeek.endDate + "T12:00:00"), "d MMM yyyy", { locale: es })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-0.5">Sin semana activa</p>
        )}
      </div>

      {/* Resumen semana actual */}
      {settlementData && (
        <CurrentWeekSummaryCard
          settlements={settlementData.settlements}
          currentWeek={currentWeek}
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Historial de Pagos</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {selectedWeek ? `${filteredPayments?.length ?? 0} pago${filteredPayments?.length !== 1 ? "s" : ""} en S${selectedWeek.weekNumber}` : "Selecciona una semana"}
              </CardDescription>
            </div>
            <Select
              value={activeWeekId ?? ""}
              onValueChange={(val) => setSelectedWeekId(val)}
              data-testid="select-week"
            >
              <SelectTrigger className="w-44 h-8 text-xs" data-testid="trigger-select-week">
                <SelectValue placeholder="Semana…" />
              </SelectTrigger>
              <SelectContent>
                {[...sortedWeeks].reverse().map((week) => {
                  const isCurrent = currentWeek?.id === week.id;
                  return (
                    <SelectItem key={week.id} value={week.id} data-testid={`option-week-${week.weekNumber}`}>
                      <span className="font-mono">S{week.weekNumber}</span>
                      {isCurrent && <span className="ml-2 text-[10px] text-success font-medium">● actual</span>}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <div className="px-4 py-2 border-t bg-muted/30 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Total: <strong className="text-foreground">{filteredPayments?.length ?? 0}</strong></span>
          <span>Pendientes: <strong className="text-warning">{filteredPayments?.filter((p) => p.status === "pending").length ?? 0}</strong></span>
          <span>Verificados: <strong className="text-success">{filteredPayments?.filter((p) => p.status === "verified").length ?? 0}</strong></span>
        </div>
      </Card>

      {/* Botones de pago */}
      <div className={`flex gap-2 ${user?.autoVerificaPagos ? "flex-col sm:flex-row" : ""}`}>
        <button
          onClick={() => {
            if (!currentWeek || currentWeek.status !== "open") return;
            setIsNewPaymentOpen(true);
          }}
          disabled={!currentWeek || currentWeek.status !== "open"}
          data-testid="button-nuevo-pago-first"
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed text-sm font-medium transition-colors
            ${currentWeek?.status === "open"
              ? "border-primary/40 text-primary hover:bg-primary/5 hover:border-primary"
              : "border-muted text-muted-foreground opacity-50 cursor-default"
            }`}
        >
          {currentWeek?.status === "open" ? <PlusCircle className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          Nuevo Pago
          {currentWeek && <span className="text-[11px] font-mono opacity-70">S{currentWeek.weekNumber}</span>}
        </button>

        {user?.autoVerificaPagos && (
          <button
            onClick={() => {
              if (!currentWeek || currentWeek.status !== "open") return;
              setIsVerifiedPaymentOpen(true);
            }}
            disabled={!currentWeek || currentWeek.status !== "open"}
            data-testid="button-pago-verificado-first"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed text-sm font-medium transition-colors
              ${currentWeek?.status === "open"
                ? "border-success/40 text-success hover:bg-success/5 hover:border-success"
                : "border-muted text-muted-foreground opacity-50 cursor-default"
              }`}
          >
            {currentWeek?.status === "open" ? <CheckCircle className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            Agregar Pago Verificado
            {currentWeek && <span className="text-[11px] font-mono opacity-70">S{currentWeek.weekNumber}</span>}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredPayments?.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-lg">No hay pagos</h3>
          <p className="text-muted-foreground text-sm">
            {activeWeekId ? "No hay pagos en esta semana" : "Registra tu primer pago"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments?.map((payment, index) => {
            const status = statusConfig[payment.status] ?? statusConfig.pending;
            const StatusIcon = status.icon;
            const paymentWeek = getWeekForPayment(payment);

            return (
              <div
                key={payment.id}
                className="bg-card border rounded-lg p-4 shadow-sm"
                data-testid={`payment-card-${payment.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5" data-testid={`badge-week-${payment.id}`}>
                      S{selectedWeek?.weekNumber ?? paymentWeek?.weekNumber ?? "?"}
                    </Badge>
                  </div>
                  <Badge className={`gap-1 text-[11px] px-2 py-0.5 ${status.className}`} data-testid={`badge-status-${payment.id}`}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-foreground text-xs">
                      {payment.createdAt && format(new Date(payment.createdAt), "dd/MM/yyyy hh:mm a", { locale: es })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-foreground text-xs font-mono">{payment.clientNumber}</span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-foreground font-semibold">
                      {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })} {payment.currency?.code ?? ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {payment.proofImage ? (
                      <button
                        onClick={() => setPreviewImage(payment.proofImage!)}
                        className="w-14 h-14 rounded overflow-hidden border bg-muted hover:opacity-80 transition-opacity"
                        data-testid={`button-proof-${payment.id}`}
                      >
                        <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-14 h-14 rounded border bg-muted/30 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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

      <NewPaymentModal open={isNewPaymentOpen} onOpenChange={setIsNewPaymentOpen} />
      <VerifiedPaymentModal open={isVerifiedPaymentOpen} onOpenChange={setIsVerifiedPaymentOpen} />
    </div>
  );
}
