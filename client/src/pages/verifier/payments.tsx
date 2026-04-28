import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentWithDetails, Week } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, ImageIcon, ShieldCheck, Calendar } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Pendiente", variant: "secondary", icon: Clock },
  verified: { label: "Verificado", variant: "default", icon: CheckCircle },
  rejected: { label: "Rechazado", variant: "destructive", icon: XCircle },
  refunded: { label: "Reembolsado", variant: "outline", icon: XCircle },
};

type WeekGroup = {
  weekLabel: string;
  dateRange: string;
  payments: PaymentWithDetails[];
  verifiedTotals: { code: string; total: number }[];
  pendingCount: number;
};

function groupPaymentsByWeek(payments: PaymentWithDetails[], weeks: Week[]): WeekGroup[] {
  const sortedWeeks = [...weeks].sort((a, b) => b.weekNumber - a.weekNumber);

  const groups: WeekGroup[] = [];
  const assigned = new Set<string>();

  for (const week of sortedWeeks) {
    const start = parseISO(week.startDate);
    const end = parseISO(week.endDate);
    const weekPayments = payments.filter(p => {
      if (assigned.has(p.id)) return false;
      const date = new Date(p.createdAt);
      return isWithinInterval(date, { start, end });
    });
    if (weekPayments.length === 0) continue;
    weekPayments.forEach(p => assigned.add(p.id));

    const startLabel = format(start, "d MMM", { locale: es });
    const endLabel = format(end, "d MMM", { locale: es });

    const verifiedMap: Record<string, number> = {};
    for (const p of weekPayments) {
      if (p.status === "verified" && p.currency?.code) {
        verifiedMap[p.currency.code] = (verifiedMap[p.currency.code] ?? 0) + Number(p.amount);
      }
    }
    const verifiedTotals = Object.entries(verifiedMap).map(([code, total]) => ({ code, total }));
    const pendingCount = weekPayments.filter(p => p.status === "pending").length;

    groups.push({
      weekLabel: `S${week.weekNumber}`,
      dateRange: `${startLabel} – ${endLabel}`,
      payments: weekPayments,
      verifiedTotals,
      pendingCount,
    });
  }

  const unassigned = payments.filter(p => !assigned.has(p.id));
  if (unassigned.length > 0) {
    const verifiedMap: Record<string, number> = {};
    for (const p of unassigned) {
      if (p.status === "verified" && p.currency?.code) {
        verifiedMap[p.currency.code] = (verifiedMap[p.currency.code] ?? 0) + Number(p.amount);
      }
    }
    groups.push({
      weekLabel: "Sin semana",
      dateRange: "",
      payments: unassigned,
      verifiedTotals: Object.entries(verifiedMap).map(([code, total]) => ({ code, total })),
      pendingCount: unassigned.filter(p => p.status === "pending").length,
    });
  }

  return groups;
}

function WeekSeparator({ group, showPending }: { group: WeekGroup; showPending?: boolean }) {
  const hasVerified = group.verifiedTotals.length > 0;
  return (
    <div className="flex items-center gap-2 px-1 py-1.5" data-testid={`week-header-${group.weekLabel}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground">{group.weekLabel}</span>
        {group.dateRange && (
          <span className="text-xs text-muted-foreground">{group.dateRange}</span>
        )}
      </div>
      <div className="flex-1 h-px bg-border" />
      <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
        {showPending && group.pendingCount > 0 && (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {group.pendingCount} pendiente{group.pendingCount !== 1 ? "s" : ""}
          </span>
        )}
        {hasVerified && (
          <span className="font-medium text-green-600 dark:text-green-400">
            ✓ {group.verifiedTotals.map(v =>
              `${v.code} ${v.total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
            ).join(" · ")}
          </span>
        )}
        {!hasVerified && !showPending && (
          <span className="italic">sin verificados</span>
        )}
      </div>
    </div>
  );
}

export default function VerifierPaymentsPage() {
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [actionPayment, setActionPayment] = useState<{ payment: PaymentWithDetails; action: "verified" | "rejected" } | null>(null);

  const { data: payments, isLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/verifier/payments"],
  });

  const { data: weeks = [] } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/verifier/payments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verifier/payments"] });
      setActionPayment(null);
      toast({ title: "Pago actualizado", description: "El estado del pago ha sido actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAction = () => {
    if (!actionPayment) return;
    updateMutation.mutate({
      id: actionPayment.payment.id,
      status: actionPayment.action,
    });
  };

  const pendingPayments = payments?.filter(p => p.status === "pending") ?? [];
  const processedPayments = payments?.filter(p => p.status !== "pending") ?? [];

  const pendingGroups = groupPaymentsByWeek(pendingPayments, weeks);
  const processedGroups = groupPaymentsByWeek(processedPayments, weeks);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] ?? statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="text-[10px] px-1.5 py-0" data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3 mr-0.5" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Pagos Pendientes
          </CardTitle>
          <CardDescription>
            {pendingPayments.length} pagos esperando verificación
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay pagos pendientes de verificación
            </div>
          ) : (
            <div className="space-y-4">
              {pendingGroups.map((group) => (
                <div key={group.weekLabel} className="space-y-2">
                  <WeekSeparator group={group} showPending />
                  <div className="space-y-3">
                    {group.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="border rounded-lg p-4 space-y-3"
                        data-testid={`card-payment-${payment.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{payment.tutor?.name ?? "Tutor"}</span>
                              {getStatusBadge(payment.status)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Cliente: <span className="font-mono">{payment.clientNumber}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {payment.createdAt && format(new Date(payment.createdAt), "dd/MM/yyyy hh:mm a", { locale: es })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {payment.currency?.code}
                            </div>
                          </div>
                        </div>

                        {payment.proofImage && (
                          <button
                            onClick={() => setPreviewImage(payment.proofImage!)}
                            className="w-16 h-16 rounded overflow-hidden border bg-white dark:bg-gray-800 hover:opacity-80 transition-opacity"
                            data-testid={`button-proof-${payment.id}`}
                          >
                            <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                          </button>
                        )}

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setActionPayment({ payment, action: "verified" })}
                            data-testid={`button-verify-${payment.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Verificar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setActionPayment({ payment, action: "rejected" })}
                            data-testid={`button-reject-${payment.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rechazar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {processedPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
            <CardDescription>
              {processedPayments.length} pagos procesados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {processedGroups.map((group) => (
                <div key={group.weekLabel} className="space-y-2">
                  <WeekSeparator group={group} />
                  <div className="space-y-2">
                    {group.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between border rounded-lg p-3 gap-2"
                        data-testid={`card-history-${payment.id}`}
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{payment.tutor?.name}</span>
                            {getStatusBadge(payment.status)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Cliente: {payment.clientNumber} - {payment.createdAt && format(new Date(payment.createdAt), "dd/MM/yy", { locale: es })}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {payment.proofImage ? (
                            <button
                              onClick={() => setPreviewImage(payment.proofImage!)}
                              className="w-12 h-12 rounded overflow-hidden border bg-muted hover:opacity-80 transition-opacity"
                              data-testid={`button-proof-history-${payment.id}`}
                            >
                              <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded border bg-muted/30 flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="text-right">
                            <div className="font-medium">
                              {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{payment.currency?.code}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!actionPayment} onOpenChange={(open) => { if (!open) setActionPayment(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionPayment?.action === "verified" ? "Verificar Pago" : "Rechazar Pago"}
            </DialogTitle>
            <DialogDescription>
              {actionPayment?.action === "verified"
                ? "Confirma que este pago ha sido recibido correctamente"
                : "Indica el motivo del rechazo"}
            </DialogDescription>
          </DialogHeader>
          {actionPayment && (
            <div className="space-y-4">
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="flex justify-between">
                  <span className="text-sm">{actionPayment.payment.tutor?.name}</span>
                  <span className="font-mono font-bold">
                    {Number(actionPayment.payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })} {actionPayment.payment.currency?.code}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Cliente: {actionPayment.payment.clientNumber}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActionPayment(null)}>
                  Cancelar
                </Button>
                <Button
                  variant={actionPayment.action === "verified" ? "default" : "destructive"}
                  onClick={handleAction}
                  disabled={updateMutation.isPending}
                  data-testid="button-confirm-action"
                >
                  {updateMutation.isPending ? "Procesando..." : actionPayment.action === "verified" ? "Confirmar Verificación" : "Confirmar Rechazo"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="sm:max-w-lg p-2">
          <DialogHeader>
            <DialogTitle>Prueba de Pago</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="overflow-y-auto max-h-[80vh]">
              <img src={previewImage} alt="Prueba de pago" className="w-full rounded-lg" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
