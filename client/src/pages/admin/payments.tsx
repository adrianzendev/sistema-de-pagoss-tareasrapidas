import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentWithDetails, Week } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search, CheckCircle, XCircle, Clock, Image as ImageIcon,
  FileSpreadsheet, Calendar, RotateCcw, Trash2, ArrowLeftRight, ChevronDown, ChevronRight,
  ChevronLeft, X,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { todayPeru } from "@/lib/utils";

const weekPaymentsCache = new Map<string, PaymentWithDetails[]>();

const statusLabels: Record<string, { label: string; icon: any; className: string }> = {
  pending:  { label: "Pendiente",   icon: Clock,        className: "text-foreground border-border" },
  verified: { label: "Verificado",  icon: CheckCircle,  className: "text-success border-success/40" },
  rejected: { label: "Rechazado",   icon: XCircle,      className: "text-destructive border-destructive/40" },
  refunded: { label: "Reembolsado", icon: RotateCcw,    className: "text-muted-foreground border-border" },
};

function PaymentTable({
  payments,
  search,
  setPreviewPayment,
  setDeleteId,
  setMovePayment,
  updateMutation,
}: {
  payments: PaymentWithDetails[];
  search: string;
  setPreviewPayment: (v: { payment: PaymentWithDetails; list: PaymentWithDetails[] }) => void;
  setDeleteId: (v: string) => void;
  setMovePayment: (v: { id: string; weekId: string }) => void;
  updateMutation: any;
}) {
  const [actionPayment, setActionPayment] = useState<PaymentWithDetails | null>(null);

  const filtered = search
    ? payments.filter(p =>
        p.tutor?.name.toLowerCase().includes(search.toLowerCase()) ||
        p.clientNumber.toLowerCase().includes(search.toLowerCase())
      )
    : payments;

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {search ? "Sin resultados para esa búsqueda" : "No hay pagos en esta semana"}
      </div>
    );
  }

  return (
    <>
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
            <TableHead>Verificado</TableHead>
            <TableHead>Por</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((payment) => {
            const status = statusLabels[payment.status] ?? statusLabels.pending;
            const StatusIcon = status.icon;
            return (
              <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`} className="hover:bg-muted/40">
                <TableCell>
                  {payment.status === "pending" ? (
                    <button
                      onClick={() => setActionPayment(payment)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-warning hover:bg-accent border border-warning/40 transition-colors cursor-pointer"
                      data-testid={`button-status-${payment.id}`}
                    >
                      <Clock className="h-3 w-3" />
                      Pendiente
                    </button>
                  ) : (
                    <Badge className={`gap-1 text-xs px-2 py-1 ${status.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold text-sm tabular-nums">
                    {Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">{payment.currency?.code}</span>
                </TableCell>
                <TableCell className="text-center">
                  {payment.proofImage ? (
                    <button
                      onClick={() => setPreviewPayment({ payment, list: filtered.filter(p => p.proofImage) })}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-sm overflow-hidden border hover:opacity-80 transition-opacity mx-auto"
                      data-testid={`button-view-proof-${payment.id}`}
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
                  {payment.createdAt && (
                    <>
                      <div>{format(new Date(payment.createdAt), "dd/MM/yyyy", { locale: es })}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(payment.createdAt), "HH:mm", { locale: es })}</div>
                    </>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-mono">{payment.clientNumber}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {payment.verifiedAt ? (
                    <>
                      <div>{format(new Date(payment.verifiedAt), "dd/MM/yyyy", { locale: es })}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(payment.verifiedAt), "HH:mm", { locale: es })}</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap" data-testid={`cell-verifier-${payment.id}`}>
                  {payment.verifier?.name
                    ? payment.verifier.name
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {payment.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                          onClick={() => updateMutation.mutate({ id: payment.id, status: "verified" })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-verify-${payment.id}`}>
                          <CheckCircle className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                          onClick={() => updateMutation.mutate({ id: payment.id, status: "rejected" })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-reject-${payment.id}`}>
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                    </>
                    )}
                    {payment.status === "verified" && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                        onClick={() => updateMutation.mutate({ id: payment.id, status: "refunded" })}
                        disabled={updateMutation.isPending}
                        data-testid={`button-refund-${payment.id}`}>
                        <RotateCcw className="h-4 w-4 text-warning" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                      onClick={() => setMovePayment({ id: payment.id, weekId: "" })}
                      title="Mover a otra semana"
                      data-testid={`button-move-payment-${payment.id}`}>
                      <ArrowLeftRight className="h-4 w-4 text-primary" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                      onClick={() => setDeleteId(payment.id)}
                      data-testid={`button-delete-payment-${payment.id}`}>
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
                  {Number(actionPayment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {actionPayment.currency?.code}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Cliente: {actionPayment.clientNumber}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="gap-2 text-success hover:bg-accent border border-success/30"
                variant="ghost"
                onClick={() => { updateMutation.mutate({ id: actionPayment.id, status: "verified" }); setActionPayment(null); }}
                disabled={updateMutation.isPending}
                data-testid="button-action-verify"
              >
                <CheckCircle className="h-4 w-4" /> Verificar
              </Button>
              <Button
                className="gap-2 text-destructive hover:bg-accent border border-destructive/30"
                variant="ghost"
                onClick={() => { updateMutation.mutate({ id: actionPayment.id, status: "rejected" }); setActionPayment(null); }}
                disabled={updateMutation.isPending}
                data-testid="button-action-reject"
              >
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setActionPayment(null)}>Cancelar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

function WeekSection({
  week,
  isCurrentWeek,
  search,
  setPreviewPayment,
  setDeleteId,
  setMovePayment,
  updateMutation,
}: {
  week: Week;
  isCurrentWeek: boolean;
  search: string;
  setPreviewPayment: (v: { payment: PaymentWithDetails; list: PaymentWithDetails[] }) => void;
  setDeleteId: (v: string) => void;
  setMovePayment: (v: { id: string; weekId: string }) => void;
  updateMutation: any;
}) {
  const [expanded, setExpanded] = useState(isCurrentWeek);

  const { data: payments } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/admin/payments", "week", week.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payments?weekId=${week.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar pagos");
      const data = await res.json();
      weekPaymentsCache.set(week.id, data);
      return data;
    },
    initialData: () => weekPaymentsCache.get(week.id),
    enabled: expanded,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const start = parseISO(week.startDate);
  const end = parseISO(week.endDate);
  const dateRange = `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM", { locale: es })}`;
  const pendingCount = payments?.filter(p => p.status === "pending").length ?? 0;

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
        data-testid={`week-toggle-${week.weekNumber}`}
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={`text-sm ${isCurrentWeek ? "font-semibold text-foreground" : "font-normal text-muted-foreground"}`}>
          S{week.weekNumber} ({dateRange})
        </span>
        <div className="flex-1" />
        {!expanded && (
          <span className="text-xs text-muted-foreground italic">clic para cargar</span>
        )}
        {expanded && !payments && (
          <span className="text-xs text-muted-foreground">cargando…</span>
        )}
        {expanded && payments && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{payments.length} pagos</span>
            {pendingCount > 0 && (
              <span className="text-warning font-medium">{pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}</span>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t">
          {!payments ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <PaymentTable
              payments={payments ?? []}
              search={search}
              setPreviewPayment={setPreviewPayment}
              setDeleteId={setDeleteId}
              setMovePayment={setMovePayment}
              updateMutation={updateMutation}
            />
          )}
        </div>
      )}
    </Card>
  );
}

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [previewCtx, setPreviewCtx] = useState<{ payment: PaymentWithDetails; list: PaymentWithDetails[] } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [movePayment, setMovePayment] = useState<{ id: string; weekId: string } | null>(null);
  const { toast } = useToast();

  const { data: weeks = [], isLoading: weeksLoading } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const today = todayPeru();
  const sortedWeeks = [...weeks].sort((a, b) => b.weekNumber - a.weekNumber);
  const currentWeekId = sortedWeeks.find(w => w.startDate <= today && w.endDate >= today)?.id
    ?? sortedWeeks[0]?.id;

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/payments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Pago actualizado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, weekId }: { id: string; weekId: string }) =>
      apiRequest("PATCH", `/api/admin/payments/${id}/move`, { weekId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      setMovePayment(null);
      toast({ title: "Pago movido" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteId(null);
      toast({ title: "Pago eliminado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const exportToExcel = async () => {
    try {
      const response = await fetch(`/api/admin/payments/export?period=all`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pagos_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Exportado" });
    } catch {
      toast({ title: "Error", description: "No se pudo exportar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagos</h1>
          <p className="text-muted-foreground">Verifica y gestiona los pagos de tutores</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tutor o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-8 text-sm"
              data-testid="input-search-payments"
            />
          </div>
          <Button onClick={exportToExcel} variant="outline" size="sm" data-testid="button-export-excel">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {weeksLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : sortedWeeks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            No hay semanas registradas
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedWeeks.map((week) => (
            <WeekSection
              key={week.id}
              week={week}
              isCurrentWeek={week.id === currentWeekId}
              search={search}
              setPreviewPayment={setPreviewCtx}
              setDeleteId={setDeleteId}
              setMovePayment={setMovePayment}
              updateMutation={updateMutation}
            />
          ))}
        </div>
      )}

      {(() => {
        const list = previewCtx?.list ?? [];
        const currentIdx = previewCtx ? list.findIndex(p => p.id === previewCtx.payment.id) : -1;
        const hasPrev = currentIdx > 0;
        const hasNext = currentIdx < list.length - 1;
        const navigate = (delta: number) => {
          const next = list[currentIdx + delta];
          if (next) setPreviewCtx(c => c ? { ...c, payment: next } : null);
        };
        const p = previewCtx?.payment;
        return (
          <Dialog open={!!previewCtx} onOpenChange={(open) => { if (!open) setPreviewCtx(null); }}>
            <DialogContent className="sm:max-w-lg p-0 max-h-[92vh] flex flex-col gap-0 overflow-hidden [&>button]:hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <div>
                  <p className="font-semibold text-sm">{p?.tutor?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {p && Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {p?.currency?.code}
                    {p?.clientNumber && <span className="ml-2 font-mono">{p.clientNumber}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {list.length > 1 && (
                    <span className="text-xs text-muted-foreground mr-1">{currentIdx + 1} / {list.length}</span>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => navigate(-1)} disabled={!hasPrev} data-testid="button-prev-proof">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigate(1)} disabled={!hasNext} data-testid="button-next-proof">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setPreviewCtx(null)} data-testid="button-close-proof">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-3">
                {p?.proofImage && <img src={p.proofImage} alt="Comprobante" className="w-full rounded-lg" />}
              </div>
              {p?.status === "pending" && (
                <div className="flex gap-2 p-3 border-t shrink-0">
                  <Button
                    className="flex-1 gap-2 text-success hover:bg-accent border border-success/30"
                    variant="ghost"
                    onClick={() => { updateMutation.mutate({ id: p.id, status: "verified" }); setPreviewCtx(null); }}
                    disabled={updateMutation.isPending}
                    data-testid="button-proof-verify"
                  >
                    <CheckCircle className="h-4 w-4" /> Verificar
                  </Button>
                  <Button
                    className="flex-1 gap-2 text-destructive hover:bg-accent border border-destructive/30"
                    variant="ghost"
                    onClick={() => { updateMutation.mutate({ id: p.id, status: "rejected" }); setPreviewCtx(null); }}
                    disabled={updateMutation.isPending}
                    data-testid="button-proof-reject"
                  >
                    <XCircle className="h-4 w-4" /> Rechazar
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

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
              onClick={() => movePayment?.weekId && moveMutation.mutate({ id: movePayment.id, weekId: movePayment.weekId })}
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
