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
import { CheckCircle, XCircle, Clock, Image as ImageIcon, ShieldCheck, Calendar, Phone, RotateCcw, ChevronLeft, ChevronRight, X } from "lucide-react";

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  pending:  { label: "Pendiente",   icon: Clock,        className: "text-foreground border-border" },
  verified: { label: "Verificado",  icon: CheckCircle,  className: "text-success border-success/40" },
  rejected: { label: "Rechazado",   icon: XCircle,      className: "text-destructive border-destructive/40" },
  refunded: { label: "Reembolsado", icon: RotateCcw,    className: "text-muted-foreground border-border" },
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
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
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
  const [previewPayment, setPreviewPayment] = useState<PaymentWithDetails | null>(null);
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
                  <TableRow className="hover:bg-muted/40">
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
                          <TableCell>
                            <button
                              onClick={() => setActionPayment({ payment, action: "verified" })}
                              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-warning hover:bg-accent border border-warning/30 transition-colors cursor-pointer"
                              data-testid={`button-status-${payment.id}`}
                            >
                              <Clock className="h-3 w-3" />
                              Pendiente
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-sm tabular-nums">
                              {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">{payment.currency?.code}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {payment.proofImage ? (
                              <button
                                onClick={() => setPreviewPayment(payment)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded overflow-hidden border hover:opacity-80 transition-opacity mx-auto"
                                data-testid={`button-proof-${payment.id}`}
                              >
                                <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded border mx-auto">
                                <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{payment.tutor?.name ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <div>
                                <div className="text-foreground">{format(new Date(payment.createdAt), "dd/MM/yyyy", { locale: es })}</div>
                                <div>{format(new Date(payment.createdAt), "HH:mm", { locale: es })}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs">
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
                  <TableRow className="hover:bg-muted/40">
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
                            <TableCell>
                              <Badge className={`gap-1 text-xs px-2 py-1 ${status.className}`}>
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold text-sm tabular-nums">
                                {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">{payment.currency?.code}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              {payment.proofImage ? (
                                <button
                                  onClick={() => setPreviewPayment(payment)}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded overflow-hidden border hover:opacity-80 transition-opacity mx-auto"
                                  data-testid={`button-proof-history-${payment.id}`}
                                >
                                  <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                                </button>
                              ) : (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded border mx-auto">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-medium">{payment.tutor?.name ?? "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <div>
                                  <div className="text-foreground">{format(new Date(payment.createdAt), "dd/MM/yyyy", { locale: es })}</div>
                                  <div>{format(new Date(payment.createdAt), "HH:mm", { locale: es })}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-xs">
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
              <div className="border rounded-lg p-3">
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
                  className="gap-2 text-success hover:bg-accent border border-success/30"
                  variant="ghost"
                  onClick={() => updateMutation.mutate({ id: actionPayment.payment.id, status: "verified" })}
                  disabled={updateMutation.isPending}
                  data-testid="button-confirm-verify"
                >
                  <CheckCircle className="h-4 w-4" />
                  Verificar
                </Button>
                <Button
                  className="gap-2 text-destructive hover:bg-accent border border-destructive/30"
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
      {(() => {
        const paymentsWithImage = (payments ?? []).filter(p => p.proofImage);
        const currentIdx = previewPayment ? paymentsWithImage.findIndex(p => p.id === previewPayment.id) : -1;
        const hasPrev = currentIdx > 0;
        const hasNext = currentIdx < paymentsWithImage.length - 1;
        const navigate = (delta: number) => {
          const next = paymentsWithImage[currentIdx + delta];
          if (next) setPreviewPayment(next);
        };
        const isPending = previewPayment?.status === "pending";
        return (
          <Dialog open={!!previewPayment} onOpenChange={(open) => { if (!open) setPreviewPayment(null); }}>
            <DialogContent className="sm:max-w-lg p-0 max-h-[92vh] flex flex-col gap-0 overflow-hidden [&>button]:hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <div>
                  <p className="font-semibold text-sm">{previewPayment?.tutor?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {previewPayment && Number(previewPayment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })} {previewPayment?.currency?.code}
                    {previewPayment?.clientNumber && <span className="ml-2 font-mono">{previewPayment.clientNumber}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-2">
                    {currentIdx + 1} / {paymentsWithImage.length}
                  </span>
                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => navigate(-1)} disabled={!hasPrev} data-testid="button-prev-payment">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => navigate(1)} disabled={!hasNext} data-testid="button-next-payment">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setPreviewPayment(null)} data-testid="button-close-preview">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Image */}
              <div className="overflow-y-auto flex-1 p-3">
                {previewPayment?.proofImage && (
                  <img src={previewPayment.proofImage} alt="Comprobante" className="w-full rounded-lg" />
                )}
              </div>

              {/* Actions for pending */}
              {isPending && (
                <div className="flex gap-2 p-3 border-t shrink-0">
                  <Button
                    className="flex-1 gap-2 text-success hover:bg-accent border border-success/30"
                    variant="ghost"
                    onClick={() => {
                      updateMutation.mutate({ id: previewPayment!.id, status: "verified" });
                      setPreviewPayment(null);
                    }}
                    disabled={updateMutation.isPending}
                    data-testid="button-preview-verify"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Verificar
                  </Button>
                  <Button
                    className="flex-1 gap-2 text-destructive hover:bg-accent border border-destructive/30"
                    variant="ghost"
                    onClick={() => {
                      updateMutation.mutate({ id: previewPayment!.id, status: "rejected" });
                      setPreviewPayment(null);
                    }}
                    disabled={updateMutation.isPending}
                    data-testid="button-preview-reject"
                  >
                    <XCircle className="h-4 w-4" />
                    Rechazar
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

    </div>
  );
}
