import { Fragment, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentWithDetails, Week } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Image as ImageIcon, ShieldCheck, Calendar, Phone, RotateCcw } from "lucide-react";

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  pending:  { label: "Pendiente",   icon: Clock,        className: "bg-secondary text-secondary-foreground" },
  verified: { label: "Verificado",  icon: CheckCircle,  className: "bg-success/10 text-success" },
  rejected: { label: "Rechazado",   icon: XCircle,      className: "bg-destructive/10 text-destructive" },
  refunded: { label: "Reembolsado", icon: RotateCcw,    className: "bg-muted text-muted-foreground" },
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
    const start = startOfDay(parseISO(week.startDate));
    const end = endOfDay(parseISO(week.endDate));
    const weekPayments = payments.filter(p => {
      if (assigned.has(p.id)) return false;
      return isWithinInterval(new Date(p.createdAt), { start, end });
    });
    if (weekPayments.length === 0) continue;
    weekPayments.forEach(p => assigned.add(p.id));

    const verifiedMap: Record<string, number> = {};
    for (const p of weekPayments) {
      if (p.status === "verified" && p.currency?.code) {
        verifiedMap[p.currency.code] = (verifiedMap[p.currency.code] ?? 0) + Number(p.amount);
      }
    }
    groups.push({
      weekLabel: `S${week.weekNumber}`,
      dateRange: `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM", { locale: es })}`,
      payments: weekPayments,
      verifiedTotals: Object.entries(verifiedMap).map(([code, total]) => ({ code, total })),
      pendingCount: weekPayments.filter(p => p.status === "pending").length,
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

function WeekSeparatorRow({ group, colSpan, showPending }: { group: WeekGroup; colSpan: number; showPending?: boolean }) {
  return (
    <TableRow className="hover:bg-transparent border-0" data-testid={`week-header-${group.weekLabel}`}>
      <TableCell colSpan={colSpan} className="py-2 px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground">{group.weekLabel}</span>
            {group.dateRange && (
              <span className="text-xs text-muted-foreground">{group.dateRange}</span>
            )}
          </div>
          <div className="flex-1 h-px bg-border" />
          <div className="flex items-center gap-2 shrink-0 text-xs">
            {showPending && group.pendingCount > 0 && (
              <span className="font-medium text-warning">
                {group.pendingCount} pendiente{group.pendingCount !== 1 ? "s" : ""}
              </span>
            )}
            {group.verifiedTotals.length > 0 && (
              <span className="font-medium text-success">
                ✓ {group.verifiedTotals.map(v =>
                  `${v.code} ${v.total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
                ).join(" · ")}
              </span>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
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

  const pendingPayments = payments?.filter(p => p.status === "pending") ?? [];
  const processedPayments = payments?.filter(p => p.status !== "pending") ?? [];
  const pendingGroups = groupPaymentsByWeek(pendingPayments, weeks);
  const processedGroups = groupPaymentsByWeek(processedPayments, weeks);

  return (
    <div className="space-y-6">

      {/* Pending */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Pagos Pendientes
          </CardTitle>
          <CardDescription>
            {pendingPayments.length} pagos esperando verificación
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-0 divide-y divide-border px-4 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-7 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm px-4 pb-4">
              No hay pagos pendientes de verificación
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-right text-xs">Monto</TableHead>
                    <TableHead className="text-center text-xs">Img</TableHead>
                    <TableHead className="text-xs">Tutor</TableHead>
                    <TableHead className="text-xs w-32">Fecha</TableHead>
                    <TableHead className="text-xs">Teléfono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingGroups.map((group) => (
                    <Fragment key={group.weekLabel}>
                      <WeekSeparatorRow group={group} colSpan={6} showPending />
                      {group.payments.map((payment) => (
                        <TableRow key={payment.id} data-testid={`card-payment-${payment.id}`} className="hover:bg-muted/30">
                          <TableCell className="py-3">
                            <button
                              onClick={() => setActionPayment({ payment, action: "verified" })}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-warning/10 text-warning hover:bg-warning/20 border border-warning/30 transition-colors cursor-pointer"
                              data-testid={`button-status-${payment.id}`}
                            >
                              <Clock className="h-3 w-3" />
                              Pendiente
                            </button>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <span className="font-semibold text-sm tabular-nums">
                              {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1">{payment.currency?.code}</span>
                          </TableCell>
                          <TableCell className="py-3 text-center">
                            {payment.proofImage ? (
                              <button
                                onClick={() => setPreviewImage(payment.proofImage!)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded overflow-hidden border bg-muted hover:opacity-80 transition-opacity mx-auto"
                                data-testid={`button-proof-${payment.id}`}
                              >
                                <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded border bg-muted/30 mx-auto">
                                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-xs font-medium">{payment.tutor?.name ?? "—"}</TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <div>
                                <div className="text-foreground">{format(new Date(payment.createdAt), "dd/MM/yyyy", { locale: es })}</div>
                                <div>{format(new Date(payment.createdAt), "HH:mm", { locale: es })}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="font-mono">{payment.clientNumber}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {processedPayments.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Historial</CardTitle>
            <CardDescription>{processedPayments.length} pagos procesados</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-right text-xs">Monto</TableHead>
                    <TableHead className="text-center text-xs">Img</TableHead>
                    <TableHead className="text-xs">Tutor</TableHead>
                    <TableHead className="text-xs w-32">Fecha</TableHead>
                    <TableHead className="text-xs">Teléfono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedGroups.map((group) => (
                    <Fragment key={group.weekLabel}>
                      <WeekSeparatorRow group={group} colSpan={6} />
                      {group.payments.map((payment) => {
                        const status = statusConfig[payment.status] ?? statusConfig.pending;
                        const StatusIcon = status.icon;
                        return (
                          <TableRow key={payment.id} data-testid={`card-history-${payment.id}`} className="hover:bg-muted/30">
                            <TableCell className="py-3">
                              <Badge className={`gap-1 text-[10px] px-1.5 py-0.5 ${status.className}`}>
                                <StatusIcon className="h-2.5 w-2.5" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <span className="font-semibold text-sm tabular-nums">
                                {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1">{payment.currency?.code}</span>
                            </TableCell>
                            <TableCell className="py-3 text-center">
                              {payment.proofImage ? (
                                <button
                                  onClick={() => setPreviewImage(payment.proofImage!)}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded overflow-hidden border bg-muted hover:opacity-80 transition-opacity mx-auto"
                                  data-testid={`button-proof-history-${payment.id}`}
                                >
                                  <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                                </button>
                              ) : (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded border bg-muted/30 mx-auto">
                                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-xs font-medium">{payment.tutor?.name ?? "—"}</TableCell>
                            <TableCell className="py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <div>
                                  <div className="text-foreground">{format(new Date(payment.createdAt), "dd/MM/yyyy", { locale: es })}</div>
                                  <div>{format(new Date(payment.createdAt), "HH:mm", { locale: es })}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-1.5 text-xs">
                                <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="font-mono">{payment.clientNumber}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm action dialog */}
      <Dialog open={!!actionPayment} onOpenChange={(open) => { if (!open) setActionPayment(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar estado del pago</DialogTitle>
            <DialogDescription>Elige una acción para este pago</DialogDescription>
          </DialogHeader>
          {actionPayment && (
            <div className="space-y-4">
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{actionPayment.payment.tutor?.name}</span>
                  <span className="font-mono font-bold">
                    {Number(actionPayment.payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })} {actionPayment.payment.currency?.code}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Cliente: {actionPayment.payment.clientNumber}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="gap-2 bg-success/10 text-success hover:bg-success/20 border border-success/30"
                  variant="ghost"
                  onClick={() => updateMutation.mutate({ id: actionPayment.payment.id, status: "verified" })}
                  disabled={updateMutation.isPending}
                  data-testid="button-confirm-verify"
                >
                  <CheckCircle className="h-4 w-4" />
                  Verificar
                </Button>
                <Button
                  className="gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"
                  variant="ghost"
                  onClick={() => updateMutation.mutate({ id: actionPayment.payment.id, status: "rejected" })}
                  disabled={updateMutation.isPending}
                  data-testid="button-confirm-reject"
                >
                  <XCircle className="h-4 w-4" />
                  Rechazar
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setActionPayment(null)}>
                Cancelar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview image dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="sm:max-w-lg p-2 max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 px-2 pt-2">
            <DialogTitle>Prueba de Pago</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="overflow-y-auto flex-1 px-2 pb-2">
              <img src={previewImage} alt="Prueba de pago" className="w-full rounded-lg" />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
