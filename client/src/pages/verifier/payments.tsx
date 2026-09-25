import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentWithDetails, Week } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
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
import { CheckCircle, XCircle, Image as ImageIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { todayPeru } from "@/lib/utils";
import { WeekSelector } from "@/components/week-selector";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:  { label: "Pendiente",   className: "text-warning border-warning/40" },
  verified: { label: "Verificado",  className: "text-success border-success/40" },
  rejected: { label: "Rechazado",   className: "text-destructive border-destructive/40" },
  refunded: { label: "Reembolsado", className: "text-muted-foreground border-border" },
};

export default function VerifierPaymentsPage() {
  const { toast } = useToast();
  const [previewPayment, setPreviewPayment] = useState<PaymentWithDetails | null>(null);
  const [actionPayment, setActionPayment] = useState<PaymentWithDetails | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  const { data: weeks } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const sortedWeeks = [...(weeks ?? [])].sort((a, b) => a.weekNumber - b.weekNumber);
  const today = todayPeru();
  const currentWeek = sortedWeeks.find(w => w.startDate <= today && w.endDate >= today);
  const activeWeekId = selectedWeekId ?? currentWeek?.id ?? sortedWeeks[sortedWeeks.length - 1]?.id ?? null;

  const { data: payments, isLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/verifier/payments", "week", activeWeekId],
    queryFn: async () => {
      if (!activeWeekId) return [];
      const res = await fetch(`/api/verifier/payments?weekId=${activeWeekId}`);
      if (!res.ok) throw new Error("Error al cargar pagos");
      return res.json();
    },
    enabled: !!activeWeekId,
    staleTime: Infinity,
    gcTime: Infinity,
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

  // Pendientes primero (prioridad operativa), luego verificados/rechazados
  const sortedPayments = [
    ...(payments?.filter(p => p.status === "pending") ?? []),
    ...(payments?.filter(p => p.status !== "pending") ?? []),
  ];

  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Verificación de Pagos</h1>
          <p className="text-muted-foreground">Gestiona y aprueba los comprobantes de pago recibidos</p>
        </div>
        <WeekSelector
          weeks={sortedWeeks}
          value={activeWeekId}
          onValueChange={setSelectedWeekId}
          currentWeekId={currentWeek?.id}
        />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-0 divide-y divide-border px-4 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-8 rounded-sm" />
                  <Skeleton className="h-7 w-20 rounded-sm" />
                </div>
              ))}
            </div>
          ) : sortedPayments.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm px-4 pb-4">
              No hay pagos en esta semana
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-muted/40">
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Img</TableHead>
                    <TableHead>Tutor</TableHead>
                    <TableHead className="w-32">Fecha</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPayments.map((payment) => {
                    const status = statusConfig[payment.status] ?? statusConfig.pending;
                    return (
                      <TableRow key={payment.id} data-testid={`card-payment-${payment.id}`} className="hover:bg-muted/40">
                        <TableCell>
                          <Badge className={`text-xs px-2 py-1 ${status.className}`} data-testid={`badge-status-${payment.id}`}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm tabular-nums text-foreground">
                          {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })} {payment.currency?.code}
                        </TableCell>
                        <TableCell className="text-center">
                          {payment.proofImage ? (
                            <button
                              onClick={() => setPreviewPayment(payment)}
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
                        <TableCell>{payment.tutor?.name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div>{format(new Date(payment.createdAt), "dd/MM/yyyy", { locale: es })}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(payment.createdAt), "HH:mm", { locale: es })}</div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{payment.clientNumber}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.status === "pending" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm" variant="ghost" className="h-8 w-8 p-0"
                                onClick={() => setActionPayment(payment)}
                                data-testid={`button-status-${payment.id}`}
                              >
                                <CheckCircle className="h-4 w-4 text-success" />
                              </Button>
                              <Button
                                size="sm" variant="ghost" className="h-8 w-8 p-0"
                                onClick={() => updateMutation.mutate({ id: payment.id, status: "rejected" })}
                                disabled={updateMutation.isPending}
                                data-testid={`button-reject-${payment.id}`}
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
                  <span className="text-sm font-medium">{actionPayment.tutor?.name}</span>
                  <span className="font-mono font-bold">
                    {Number(actionPayment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })} {actionPayment.currency?.code}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Cliente: {actionPayment.clientNumber}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="gap-2 text-success hover:bg-accent border border-success/30"
                  variant="ghost"
                  onClick={() => updateMutation.mutate({ id: actionPayment.id, status: "verified" })}
                  disabled={updateMutation.isPending}
                  data-testid="button-confirm-verify"
                >
                  <CheckCircle className="h-4 w-4" />
                  Verificar
                </Button>
                <Button
                  className="gap-2 text-destructive hover:bg-accent border border-destructive/30"
                  variant="ghost"
                  onClick={() => updateMutation.mutate({ id: actionPayment.id, status: "rejected" })}
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
        const paymentsWithImage = sortedPayments.filter(p => p.proofImage);
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
                  <Button variant="ghost" size="icon" onClick={() => navigate(-1)} disabled={!hasPrev} data-testid="button-prev-payment">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigate(1)} disabled={!hasNext} data-testid="button-next-payment">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setPreviewPayment(null)} data-testid="button-close-preview">
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
