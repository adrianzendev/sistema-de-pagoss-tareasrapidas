import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, FileText, Image as ImageIcon, CheckCircle, XCircle, Clock, RotateCcw, AlertTriangle, ArrowLeftRight, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaidToggleButton } from "@/components/paid-toggle-button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PaymentWithDetails, Week } from "@shared/schema";
import { todayPeru } from "@/lib/utils";
import { WeekSelector } from "@/components/week-selector";

type WeekPaidMatrix = {
  weekPaidMap: Record<string, string[]>;
};

type TutorSettlement = {
  week: Week;
  tutorId: string;
  tutorName: string;
  commissionPercent: number;
  grossIncome: number;
  grossRegular: number;
  grossDirect: number;
  advertisingCost: number;
  tutorAdvertisingShare: number;
  sharedAdvertisingUsd: number;
  usdRate: number;
  dailyAdvDays?: number;
  netIncome: number;
  tutorEarnings: number;
  agencyEarnings: number;
  netTransfer: number;
  currencyCommissionHalf: number;
  payments: PaymentWithDetails[];
};

const fmt = (n: number) => "PEN " + n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SettlementResponse = {
  settlements: TutorSettlement[];
  settings: { agencyPercent: number; tutorPercent: number };
  commissionPercent: number;
  tutor: { id: string; name: string; email: string; autoVerificaPagos: boolean };
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Pendiente", icon: Clock, className: "text-warning border-warning/40" },
  verified: { label: "Verificado", icon: CheckCircle, className: "text-success border-success/40" },
  autoverificado: { label: "Autoverificado", icon: CheckCircle, className: "text-primary border-primary/40" },
  rejected: { label: "Rechazado", icon: XCircle, className: "text-destructive border-destructive/40" },
  refunded: { label: "Reembolsado", icon: RotateCcw, className: "text-muted-foreground border-border" },
};

export default function AdminTutorViewPage() {
  const { username } = useParams<{ username: string }>();
  const { toast } = useToast();
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [movePayment, setMovePayment] = useState<{ id: string; weekId: string } | null>(null);

  const { data: settlementData, isLoading: settlementLoading } = useQuery<SettlementResponse>({
    queryKey: [`/api/admin/tutors/${username}/settlement`],
  });

  const { data: allWeeks } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const { data: matrixData } = useQuery<WeekPaidMatrix>({
    queryKey: ["/api/admin/settlements/matrix"],
  });

  const today = todayPeru();
  const sortedWeeks = [...(allWeeks ?? [])].sort((a, b) => a.weekNumber - b.weekNumber);
  const currentWeek = sortedWeeks.find(w => w.startDate <= today && w.endDate >= today);
  const activeWeekId = selectedWeekId ?? currentWeek?.id ?? sortedWeeks[sortedWeeks.length - 1]?.id ?? null;

  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: [`/api/admin/tutors/${username}/payments`, activeWeekId],
    queryFn: async () => {
      if (!activeWeekId) return [];
      const res = await fetch(`/api/admin/tutors/${username}/payments?weekId=${activeWeekId}`);
      if (!res.ok) throw new Error("Error al cargar pagos");
      return res.json();
    },
    enabled: !!activeWeekId,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const invalidatePaymentQueries = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/admin/tutors/${username}/payments`] });
    queryClient.invalidateQueries({ queryKey: [`/api/admin/tutors/${username}/settlement`] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ paymentId, status }: { paymentId: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/payments/${paymentId}`, { status }),
    onSuccess: () => { invalidatePaymentQueries(); toast({ title: "Pago actualizado" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ paymentId, weekId }: { paymentId: string; weekId: string }) =>
      apiRequest("PATCH", `/api/admin/payments/${paymentId}/move`, { weekId }),
    onSuccess: () => { invalidatePaymentQueries(); setMovePayment(null); toast({ title: "Pago movido" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (paymentId: string) => apiRequest("DELETE", `/api/admin/payments/${paymentId}`),
    onSuccess: () => { invalidatePaymentQueries(); setDeleteId(null); toast({ title: "Pago eliminado" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const tutor = settlementData?.tutor;
  const commissionPercent = settlementData?.commissionPercent ?? 0;
  const selectedWeek = sortedWeeks.find(w => w.id === activeWeekId);
  const selectedSettlement = settlementData?.settlements.find(s => s.week.id === activeWeekId);

  if (settlementLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/tutors">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Tutores
          </button>
        </Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tutor?.name ?? "Tutor"}</h1>
          <p className="text-sm text-muted-foreground">{tutor?.email}</p>
        </div>
        <span className="text-sm text-muted-foreground">
          Vista admin · comisión {commissionPercent}%
        </span>
      </div>

      <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Historial de Pagos</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {selectedWeek
                      ? `${payments?.length ?? 0} pago${payments?.length !== 1 ? "s" : ""} en S${selectedWeek.weekNumber}`
                      : "Selecciona una semana"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedWeek && tutor && (
                    <PaidToggleButton
                      tutorId={tutor.id}
                      tutorName={tutor.name}
                      weekId={selectedWeek.id}
                      weekNumber={selectedWeek.weekNumber}
                      isPaid={matrixData?.weekPaidMap[selectedWeek.id]?.includes(tutor.id) ?? false}
                    />
                  )}
                  <WeekSelector
                    weeks={sortedWeeks}
                    value={activeWeekId ?? null}
                    onValueChange={(val) => setSelectedWeekId(val)}
                    currentWeekId={currentWeek?.id}
                  />
                </div>
              </div>
            </CardHeader>
            <div className="px-4 py-2 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Total: <strong className="text-foreground">{payments?.length ?? 0}</strong></span>
              <span>Pendientes: <strong className="text-warning">{payments?.filter(p => p.status === "pending").length ?? 0}</strong></span>
              <span>Verificados: <strong className="text-success">{payments?.filter(p => p.status === "verified").length ?? 0}</strong></span>
              <span>Autoverificados: <strong className="text-primary">{payments?.filter(p => p.status === "autoverificado").length ?? 0}</strong></span>
            </div>
          </Card>

          {paymentsLoading ? (
            <Card>
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
            </Card>
          ) : !payments?.length ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-border">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay pagos</h3>
              <p className="text-muted-foreground text-sm">No hay pagos en esta semana</p>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-muted/40">
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-center">Img</TableHead>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Fecha y hora</TableHead>
                      <TableHead>Verificado por</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment, index) => {
                      const status = statusConfig[payment.status] ?? statusConfig.pending;
                      const StatusIcon = status.icon;
                      return (
                        <TableRow key={payment.id} className="hover:bg-muted/40">
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
                            <span className="text-xs text-muted-foreground ml-1">{payment.currency?.code ?? ""}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {payment.proofImage ? (
                              <button
                                onClick={() => setPreviewImage(payment.proofImage!)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-sm overflow-hidden border hover:opacity-80 transition-opacity mx-auto"
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
                          <TableCell className="text-xs text-muted-foreground">
                            {payment.verifier?.name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {payment.status === "pending" && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                                    onClick={() => updateStatusMutation.mutate({ paymentId: payment.id, status: "verified" })}
                                    disabled={updateStatusMutation.isPending}
                                    data-testid={`button-verify-${payment.id}`}>
                                    <CheckCircle className="h-4 w-4 text-success" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                                    onClick={() => updateStatusMutation.mutate({ paymentId: payment.id, status: "rejected" })}
                                    disabled={updateStatusMutation.isPending}
                                    data-testid={`button-reject-${payment.id}`}>
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                              {(payment.status === "verified" || payment.status === "autoverificado") && (
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                                  onClick={() => updateStatusMutation.mutate({ paymentId: payment.id, status: "refunded" })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-refund-${payment.id}`}>
                                  <RotateCcw className="h-4 w-4 text-warning" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                                onClick={() => setMovePayment({ id: payment.id, weekId: "" })}
                                title="Mover a otra semana"
                                data-testid={`button-move-${payment.id}`}>
                                <ArrowLeftRight className="h-4 w-4 text-primary" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                                onClick={() => setDeleteId(payment.id)}
                                data-testid={`button-delete-${payment.id}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {selectedSettlement && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total bruto semanal</span>
                  <span className="text-sm font-semibold">{fmt(selectedSettlement.grossIncome)}</span>
                </div>
                {tutor?.autoVerificaPagos && (
                  <div className="text-xs space-y-1 pl-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Recaudado en cuentas bancarias de la agencia</span>
                      <span className="text-muted-foreground">{fmt(selectedSettlement.grossRegular)}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Recaudado por {tutor?.name ?? "Tutor"}</span>
                      <span className="text-muted-foreground">{fmt(selectedSettlement.grossDirect)}</span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-border rounded-lg p-4 space-y-2">
                    <div className="text-xs uppercase text-muted-foreground">
                      Agencia ({100 - selectedSettlement.commissionPercent}%)
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Bruto</span>
                      <span>{fmt(selectedSettlement.grossIncome * (100 - selectedSettlement.commissionPercent) / 100)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Publicidad</span>
                      <span>−{fmt(selectedSettlement.tutorAdvertisingShare)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm font-semibold pt-2 border-t border-border">
                      <span>Agencia</span>
                      <span>{fmt(selectedSettlement.agencyEarnings)}</span>
                    </div>
                  </div>
                  <div className="border border-border rounded-lg p-4 space-y-2">
                    <div className="text-xs uppercase text-muted-foreground">
                      Tutor ({selectedSettlement.commissionPercent}%)
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Bruto</span>
                      <span>{fmt(selectedSettlement.netIncome)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">
                        Publicidad{(selectedSettlement.dailyAdvDays ?? 0) > 0 ? ` (${selectedSettlement.dailyAdvDays} días)` : ""}
                      </span>
                      <span>−{fmt(selectedSettlement.tutorAdvertisingShare)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm font-semibold pt-2 border-t border-border">
                      <span>Tutor</span>
                      <span>{fmt(selectedSettlement.tutorEarnings)}</span>
                    </div>
                  </div>
                </div>
                {selectedSettlement.netTransfer < 0 && (() => {
                  const commission = selectedSettlement.commissionPercent / 100;
                  const porComision = selectedSettlement.grossDirect * (1 - commission);
                  const porPublicidad = selectedSettlement.tutorAdvertisingShare - selectedSettlement.grossRegular * commission;
                  const porComisionDivisa = selectedSettlement.currencyCommissionHalf;
                  if (porComision <= 0 || porPublicidad <= 0) return null;
                  return (
                    <div className="text-xs text-muted-foreground pl-2 space-y-1 pt-2 border-t border-border">
                      <div className="flex items-baseline justify-between">
                        <span>Por comisión (sobre lo cobrado directo)</span>
                        <span>{fmt(porComision)}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span>Por publicidad</span>
                        <span>{fmt(porPublicidad)}</span>
                      </div>
                      {porComisionDivisa > 0 && (
                        <div className="flex items-baseline justify-between">
                          <span>Por comisión de divisa</span>
                          <span>{fmt(porComisionDivisa)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className={`flex items-baseline justify-between text-sm font-semibold pt-2 border-t border-border ${selectedSettlement.netTransfer < 0 ? "text-destructive" : "text-foreground"}`}>
                  <span className="flex items-center gap-1">
                    {selectedSettlement.netTransfer < 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                    {selectedSettlement.netTransfer < 0
                      ? `${tutor?.name ?? "Tutor"} → Agencia`
                      : `Agencia → ${tutor?.name ?? "Tutor"}`}
                  </span>
                  <span>{fmt(Math.abs(selectedSettlement.netTransfer))}</span>
                </div>
                {selectedSettlement.tutorEarnings < 0 && (
                  <p className="text-xs text-destructive/80">
                    La comisión semanal fue inferior al gasto publicitario; el tutor debe reembolsar la diferencia a la agencia por el saldo pendiente del anuncio.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

      {/* Image preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Comprobante de Pago</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="overflow-y-auto flex-1">
              <img src={previewImage} alt="Comprobante" className="w-full rounded-lg" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!movePayment} onOpenChange={() => setMovePayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover pago a otra semana</AlertDialogTitle>
            <AlertDialogDescription>Selecciona la semana destino.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select
              value={movePayment?.weekId ?? ""}
              onValueChange={(v) => setMovePayment(p => p ? { ...p, weekId: v } : null)}
            >
              <SelectTrigger data-testid="select-move-week">
                <SelectValue placeholder="Seleccionar semana..." />
              </SelectTrigger>
              <SelectContent>
                {sortedWeeks.map(w => (
                  <SelectItem key={w.id} value={w.id}>
                    S{w.weekNumber} — {w.startDate} al {w.endDate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => movePayment?.weekId && moveMutation.mutate({ paymentId: movePayment.id, weekId: movePayment.weekId })}
              disabled={!movePayment?.weekId || moveMutation.isPending}
            >
              Mover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pago</AlertDialogTitle>
            <AlertDialogDescription>Esta acción es permanente y no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="border border-destructive bg-background text-destructive hover:bg-accent"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
