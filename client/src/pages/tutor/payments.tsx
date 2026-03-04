import { useQuery, useMutation } from "@tanstack/react-query";
import { PaymentWithDetails, Currency, Week } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, XCircle, Clock, FileText, Image as ImageIcon, Plus, ChevronLeft, ChevronRight, Calendar, Phone, DollarSign, RotateCcw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; variant: "secondary" | "default" | "destructive" | "outline"; icon: typeof Clock; className: string }> = {
  pending: { label: "Pendiente", variant: "secondary", icon: Clock, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  verified: { label: "Verificado", variant: "default", icon: CheckCircle, className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  rejected: { label: "Rechazado", variant: "destructive", icon: XCircle, className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  refunded: { label: "Reembolsado", variant: "outline", icon: RotateCcw, className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
};

export default function TutorPaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [tabScrollPos, setTabScrollPos] = useState<number | null>(null);

  const { data: payments, isLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/tutor/payments"],
  });

  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const { data: weeks } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const generateWeekMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/weeks/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Nueva semana creada" });
    },
    onError: () => {
      toast({ title: "Error al crear semana", variant: "destructive" });
    },
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
  const maxVisibleTabs = 6;

  const defaultScrollPos = useMemo(() => {
    if (!currentWeek) return 0;
    const idx = sortedWeeks.findIndex(w => w.id === currentWeek.id);
    return Math.max(0, Math.min(idx, sortedWeeks.length - maxVisibleTabs));
  }, [sortedWeeks, currentWeek]);

  const effectiveScrollPos = tabScrollPos ?? defaultScrollPos;
  const visibleWeeks = sortedWeeks.slice(effectiveScrollPos, effectiveScrollPos + maxVisibleTabs);

  return (
    <div className="space-y-4 relative pb-24">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Historial de Pagos</CardTitle>
          <CardDescription>
            {selectedWeek ? `Semana S${selectedWeek.weekNumber}` : "Todos los pagos registrados"}
          </CardDescription>
        </CardHeader>

        <div className="border-t bg-muted/30 p-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => setTabScrollPos(Math.max(0, effectiveScrollPos - 1))}
              disabled={effectiveScrollPos === 0}
              data-testid="button-scroll-tabs-left"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 overflow-hidden flex-1">
              {visibleWeeks.map((week) => {
                const isCurrent = currentWeek?.id === week.id;
                const isPast = isWeekPast(week);
                return (
                  <button
                    key={week.id}
                    onClick={() => setSelectedWeekId(week.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      activeWeekId === week.id
                        ? isCurrent
                          ? "bg-green-600 text-white"
                          : "bg-primary text-primary-foreground"
                        : isPast
                          ? "bg-muted/30 text-muted-foreground/60 hover:bg-muted/50"
                          : isCurrent
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                    data-testid={`tab-week-${week.weekNumber}`}
                  >
                    S{week.weekNumber}
                    {isCurrent && <span className="ml-1 text-[9px]">●</span>}
                  </button>
                );
              })}

              <button
                onClick={() => generateWeekMutation.mutate()}
                disabled={generateWeekMutation.isPending}
                className="px-2 py-1.5 text-xs font-medium rounded-md bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                data-testid="button-add-week"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => setTabScrollPos(Math.min(sortedWeeks.length - maxVisibleTabs, effectiveScrollPos + 1))}
              disabled={effectiveScrollPos >= sortedWeeks.length - maxVisibleTabs}
              data-testid="button-scroll-tabs-right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 py-2 border-t bg-muted/30 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Total: <strong className="text-foreground">{filteredPayments?.length ?? 0}</strong></span>
          <span>Pendientes: <strong className="text-yellow-600">{filteredPayments?.filter((p) => p.status === "pending").length ?? 0}</strong></span>
          <span>Verificados: <strong className="text-green-600">{filteredPayments?.filter((p) => p.status === "verified").length ?? 0}</strong></span>
        </div>
      </Card>

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
                    {paymentWeek && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5" data-testid={`badge-week-${payment.id}`}>
                        S{paymentWeek.weekNumber}
                      </Badge>
                    )}
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
                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-foreground font-semibold">
                      {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })} {payment.currency?.code}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {payment.proofImage ? (
                      <button
                        onClick={() => setPreviewImage(payment.proofImage!)}
                        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        data-testid={`button-proof-${payment.id}`}
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        Ver prueba
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Sin prueba
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprobante de Pago</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative aspect-video">
              <img
                src={previewImage}
                alt="Comprobante"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
