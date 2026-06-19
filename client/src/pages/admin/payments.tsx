import { useState, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentWithDetails, Week } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Image as ImageIcon,
  FileSpreadsheet,
  Calendar,
  RotateCcw,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusLabels = {
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
  tutorTotals: { name: string; totals: { code: string; total: number }[] }[];
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
      const date = new Date(p.createdAt);
      return isWithinInterval(date, { start, end });
    });
    if (weekPayments.length === 0) continue;
    weekPayments.forEach(p => assigned.add(p.id));

    const startLabel = format(start, "d MMM", { locale: es });
    const endLabel = format(end, "d MMM", { locale: es });

    const verifiedMap: Record<string, number> = {};
    const tutorMap: Record<string, Record<string, number>> = {};
    for (const p of weekPayments) {
      if (p.status === "verified" && p.currency?.code) {
        verifiedMap[p.currency.code] = (verifiedMap[p.currency.code] ?? 0) + Number(p.amount);
        const name = p.tutor?.name ?? "—";
        if (!tutorMap[name]) tutorMap[name] = {};
        tutorMap[name][p.currency.code] = (tutorMap[name][p.currency.code] ?? 0) + Number(p.amount);
      }
    }
    const verifiedTotals = Object.entries(verifiedMap).map(([code, total]) => ({ code, total }));
    const tutorTotals = Object.entries(tutorMap).map(([name, map]) => ({
      name,
      totals: Object.entries(map).map(([code, total]) => ({ code, total })),
    }));
    const pendingCount = weekPayments.filter(p => p.status === "pending").length;

    groups.push({
      weekLabel: `S${week.weekNumber}`,
      dateRange: `${startLabel} – ${endLabel}`,
      payments: weekPayments,
      verifiedTotals,
      tutorTotals,
      pendingCount,
    });
  }

  const unassigned = payments.filter(p => !assigned.has(p.id));
  if (unassigned.length > 0) {
    const verifiedMap: Record<string, number> = {};
    const tutorMap: Record<string, Record<string, number>> = {};
    for (const p of unassigned) {
      if (p.status === "verified" && p.currency?.code) {
        verifiedMap[p.currency.code] = (verifiedMap[p.currency.code] ?? 0) + Number(p.amount);
        const name = p.tutor?.name ?? "—";
        if (!tutorMap[name]) tutorMap[name] = {};
        tutorMap[name][p.currency.code] = (tutorMap[name][p.currency.code] ?? 0) + Number(p.amount);
      }
    }
    groups.push({
      weekLabel: "Sin semana",
      dateRange: "",
      payments: unassigned,
      verifiedTotals: Object.entries(verifiedMap).map(([code, total]) => ({ code, total })),
      tutorTotals: Object.entries(tutorMap).map(([name, map]) => ({
        name,
        totals: Object.entries(map).map(([code, total]) => ({ code, total })),
      })),
      pendingCount: unassigned.filter(p => p.status === "pending").length,
    });
  }

  return groups;
}

function WeekSeparatorRow({ group }: { group: WeekGroup }) {
  const hasVerified = group.verifiedTotals.length > 0;
  return (
    <TableRow className="hover:bg-transparent border-0" data-testid={`week-header-${group.weekLabel}`}>
      <TableCell colSpan={9} className="py-2 px-1">
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-1.5 min-w-0 pt-0.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground">{group.weekLabel}</span>
            {group.dateRange && (
              <span className="text-xs text-muted-foreground">{group.dateRange}</span>
            )}
          </div>
          <div className="flex-1 h-px bg-border mt-2.5" />
          <div className="flex flex-col items-end gap-0.5 shrink-0 text-xs text-muted-foreground">
            {group.pendingCount > 0 && (
              <span className="font-medium text-warning">
                {group.pendingCount} pendiente{group.pendingCount !== 1 ? "s" : ""}
              </span>
            )}
            {hasVerified && group.tutorTotals.map(t => (
              <span key={t.name} className="text-foreground/70">
                <span className="font-medium text-foreground/90">{t.name}:</span>{" "}
                {t.totals.map(v =>
                  `${v.code} ${v.total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
                ).join(" · ")}
              </span>
            ))}
            {!hasVerified && group.pendingCount === 0 && (
              <span className="italic">sin verificados</span>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [movePayment, setMovePayment] = useState<{ id: string; weekId: string } | null>(null);
  const { toast } = useToast();

  const { data: payments, isLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/admin/payments", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payments?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    }
  });

  const { data: weeks = [] } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/payments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Pago actualizado", description: "El estado del pago ha sido actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, weekId }: { id: string; weekId: string }) =>
      apiRequest("PATCH", `/api/admin/payments/${id}/move`, { weekId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      setMovePayment(null);
      toast({ title: "Pago movido", description: "El pago fue reasignado a la semana seleccionada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteId(null);
      toast({ title: "Pago eliminado", description: "El pago ha sido eliminado permanentemente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const exportToExcel = async () => {
    try {
      const response = await fetch(`/api/admin/payments/export?period=${period}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pagos_${period}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Exportado", description: "El archivo ha sido descargado" });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo exportar", variant: "destructive" });
    }
  };

  const filteredPayments = payments?.filter(
    (p) =>
      p.tutor?.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clientNumber.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const weekGroups = groupPaymentsByWeek(filteredPayments, weeks);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagos</h1>
          <p className="text-muted-foreground">Verifica y gestiona los pagos de tutores</p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={exportToExcel} variant="outline" size="sm" data-testid="button-export-excel">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <div className="h-8 w-[1px] bg-border mx-1" />
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border">
            <Calendar className="h-4 w-4 text-muted-foreground ml-1" />
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-7 w-[140px] border-0 bg-transparent focus:ring-0">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Este año</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <CardTitle>Lista de Pagos</CardTitle>
              <CardDescription>
                {payments?.length ?? 0} pagos en el periodo seleccionado
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tutor o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-payments"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay pagos</h3>
              <p className="text-muted-foreground text-sm">
                {search ? "No se encontraron pagos con ese criterio" : "No hay pagos registrados en este periodo"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs w-32">Fecha</TableHead>
                    <TableHead className="text-xs">Tutor</TableHead>
                    <TableHead className="text-xs">Teléfono</TableHead>
                    <TableHead className="text-right text-xs">Monto</TableHead>
                    <TableHead className="text-center text-xs">Comprobante</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">Verificado</TableHead>
                    <TableHead className="text-xs">Por</TableHead>
                    <TableHead className="text-right text-xs">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekGroups.map((group) => (
                    <Fragment key={group.weekLabel}>
                      <WeekSeparatorRow group={group} />
                      {group.payments.map((payment) => {
                        const status = statusLabels[payment.status];
                        const StatusIcon = status.icon;
                        return (
                          <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`} className="hover:bg-muted/30">
                            <TableCell className="py-3 whitespace-nowrap">
                              {payment.createdAt && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3 shrink-0" />
                                  <div>
                                    <div className="text-foreground">{format(new Date(payment.createdAt), "dd/MM/yyyy", { locale: es })}</div>
                                    <div>{format(new Date(payment.createdAt), "HH:mm", { locale: es })}</div>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-xs font-medium">{payment.tutor?.name ?? "—"}</TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-mono">{payment.clientNumber}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <span className="font-semibold text-sm tabular-nums">
                                {Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1">{payment.currency?.code}</span>
                            </TableCell>
                            <TableCell className="py-3 text-center">
                              {payment.proofImage ? (
                                <button
                                  onClick={() => setPreviewImage(payment.proofImage!)}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded overflow-hidden border bg-muted hover:opacity-80 transition-opacity mx-auto"
                                  data-testid={`button-view-proof-${payment.id}`}
                                >
                                  <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                                </button>
                              ) : (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded border bg-muted/30 mx-auto">
                                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge className={`gap-1 text-[10px] px-1.5 py-0.5 ${status.className}`}>
                                <StatusIcon className="h-2.5 w-2.5" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 whitespace-nowrap">
                              {payment.verifiedAt ? (
                                <div className="text-xs text-muted-foreground">
                                  <div className="text-foreground">{format(new Date(payment.verifiedAt), "dd/MM/yyyy", { locale: es })}</div>
                                  <div>{format(new Date(payment.verifiedAt), "HH:mm", { locale: es })}</div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-xs whitespace-nowrap" data-testid={`cell-verifier-${payment.id}`}>
                              {payment.verifier?.name
                                ? <span className="font-medium">{payment.verifier.name}</span>
                                : <span className="text-muted-foreground">—</span>
                              }
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <div className="flex justify-end gap-0.5">
                                {payment.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => updateMutation.mutate({ id: payment.id, status: "verified" })}
                                      disabled={updateMutation.isPending}
                                      data-testid={`button-verify-${payment.id}`}
                                    >
                                      <CheckCircle className="h-4 w-4 text-success" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => updateMutation.mutate({ id: payment.id, status: "rejected" })}
                                      disabled={updateMutation.isPending}
                                      data-testid={`button-reject-${payment.id}`}
                                    >
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </>
                                )}
                                {payment.status === "verified" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => updateMutation.mutate({ id: payment.id, status: "refunded" })}
                                    disabled={updateMutation.isPending}
                                    data-testid={`button-refund-${payment.id}`}
                                  >
                                    <RotateCcw className="h-4 w-4 text-warning" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setMovePayment({ id: payment.id, weekId: "" })}
                                  title="Mover a otra semana"
                                  data-testid={`button-move-payment-${payment.id}`}
                                >
                                  <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setDeleteId(payment.id)}
                                  data-testid={`button-delete-payment-${payment.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
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
          )}
        </CardContent>
      </Card>

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

      <AlertDialog open={!!movePayment} onOpenChange={() => setMovePayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover pago a otra semana</AlertDialogTitle>
            <AlertDialogDescription>
              Selecciona la semana a la que quieres reasignar este pago.
            </AlertDialogDescription>
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
                {[...weeks].sort((a, b) => b.weekNumber - a.weekNumber).map(w => (
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
              onClick={() => movePayment?.weekId && moveMutation.mutate({ id: movePayment.id, weekId: movePayment.weekId })}
              disabled={!movePayment?.weekId || moveMutation.isPending}
            >
              {moveMutation.isPending ? "Moviendo..." : "Mover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pago será eliminado permanentemente del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
