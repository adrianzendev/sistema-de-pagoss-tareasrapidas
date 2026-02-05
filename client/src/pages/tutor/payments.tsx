import { useQuery, useMutation } from "@tanstack/react-query";
import { PaymentWithDetails, Currency, Week } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, XCircle, Clock, FileText, Image as ImageIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const statusLabels = {
  pending: { label: "Pendiente", variant: "secondary" as const, icon: Clock },
  verified: { label: "Verificado", variant: "default" as const, icon: CheckCircle },
  rejected: { label: "Rechazado", variant: "destructive" as const, icon: XCircle },
};

const colorClassMap: Record<string, { header: string; cell: string; text: string }> = {
  green: {
    header: "bg-green-300 dark:bg-green-800 border-green-400 dark:border-green-700 text-green-900 dark:text-green-100",
    cell: "bg-green-100 dark:bg-green-950 border-green-200 dark:border-green-900",
    text: "text-green-800 dark:text-green-200",
  },
  pink: {
    header: "bg-pink-300 dark:bg-pink-800 border-pink-400 dark:border-pink-700 text-pink-900 dark:text-pink-100",
    cell: "bg-pink-100 dark:bg-pink-950 border-pink-200 dark:border-pink-900",
    text: "text-pink-800 dark:text-pink-200",
  },
  blue: {
    header: "bg-blue-300 dark:bg-blue-800 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100",
    cell: "bg-blue-100 dark:bg-blue-950 border-blue-200 dark:border-blue-900",
    text: "text-blue-800 dark:text-blue-200",
  },
  indigo: {
    header: "bg-indigo-300 dark:bg-indigo-800 border-indigo-400 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100",
    cell: "bg-indigo-100 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-900",
    text: "text-indigo-800 dark:text-indigo-200",
  },
  amber: {
    header: "bg-amber-300 dark:bg-amber-800 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-100",
    cell: "bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-900",
    text: "text-amber-800 dark:text-amber-200",
  },
  rose: {
    header: "bg-rose-300 dark:bg-rose-800 border-rose-400 dark:border-rose-700 text-rose-900 dark:text-rose-100",
    cell: "bg-rose-100 dark:bg-rose-950 border-rose-200 dark:border-rose-900",
    text: "text-rose-800 dark:text-rose-200",
  },
  teal: {
    header: "bg-teal-300 dark:bg-teal-800 border-teal-400 dark:border-teal-700 text-teal-900 dark:text-teal-100",
    cell: "bg-teal-100 dark:bg-teal-950 border-teal-200 dark:border-teal-900",
    text: "text-teal-800 dark:text-teal-200",
  },
  purple: {
    header: "bg-purple-300 dark:bg-purple-800 border-purple-400 dark:border-purple-700 text-purple-900 dark:text-purple-100",
    cell: "bg-purple-100 dark:bg-purple-950 border-purple-200 dark:border-purple-900",
    text: "text-purple-800 dark:text-purple-200",
  },
  cyan: {
    header: "bg-cyan-300 dark:bg-cyan-800 border-cyan-400 dark:border-cyan-700 text-cyan-900 dark:text-cyan-100",
    cell: "bg-cyan-100 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-900",
    text: "text-cyan-800 dark:text-cyan-200",
  },
  orange: {
    header: "bg-orange-300 dark:bg-orange-800 border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-100",
    cell: "bg-orange-100 dark:bg-orange-950 border-orange-200 dark:border-orange-900",
    text: "text-orange-800 dark:text-orange-200",
  },
  red: {
    header: "bg-red-300 dark:bg-red-800 border-red-400 dark:border-red-700 text-red-900 dark:text-red-100",
    cell: "bg-red-100 dark:bg-red-950 border-red-200 dark:border-red-900",
    text: "text-red-800 dark:text-red-200",
  },
  yellow: {
    header: "bg-yellow-300 dark:bg-yellow-800 border-yellow-400 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100",
    cell: "bg-yellow-100 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-900",
    text: "text-yellow-800 dark:text-yellow-200",
  },
  lime: {
    header: "bg-lime-300 dark:bg-lime-800 border-lime-400 dark:border-lime-700 text-lime-900 dark:text-lime-100",
    cell: "bg-lime-100 dark:bg-lime-950 border-lime-200 dark:border-lime-900",
    text: "text-lime-800 dark:text-lime-200",
  },
  emerald: {
    header: "bg-emerald-300 dark:bg-emerald-800 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100",
    cell: "bg-emerald-100 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900",
    text: "text-emerald-800 dark:text-emerald-200",
  },
  sky: {
    header: "bg-sky-300 dark:bg-sky-800 border-sky-400 dark:border-sky-700 text-sky-900 dark:text-sky-100",
    cell: "bg-sky-100 dark:bg-sky-950 border-sky-200 dark:border-sky-900",
    text: "text-sky-800 dark:text-sky-200",
  },
  violet: {
    header: "bg-violet-300 dark:bg-violet-800 border-violet-400 dark:border-violet-700 text-violet-900 dark:text-violet-100",
    cell: "bg-violet-100 dark:bg-violet-950 border-violet-200 dark:border-violet-900",
    text: "text-violet-800 dark:text-violet-200",
  },
  fuchsia: {
    header: "bg-fuchsia-300 dark:bg-fuchsia-800 border-fuchsia-400 dark:border-fuchsia-700 text-fuchsia-900 dark:text-fuchsia-100",
    cell: "bg-fuchsia-100 dark:bg-fuchsia-950 border-fuchsia-200 dark:border-fuchsia-900",
    text: "text-fuchsia-800 dark:text-fuchsia-200",
  },
  slate: {
    header: "bg-slate-300 dark:bg-slate-700 border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100",
    cell: "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800",
    text: "text-slate-800 dark:text-slate-200",
  },
  gray: {
    header: "bg-gray-300 dark:bg-gray-700 border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100",
    cell: "bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800",
    text: "text-gray-800 dark:text-gray-200",
  },
};

const defaultCurrencyColor = colorClassMap.gray;

export default function TutorPaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [tabScrollPos, setTabScrollPos] = useState(0);

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

  const activeCurrencies = currencies ?? [];
  const sortedWeeks = [...(weeks ?? [])].sort((a, b) => b.weekNumber - a.weekNumber);

  const isPaymentInWeek = (payment: PaymentWithDetails, week: Week) => {
    if (!payment.createdAt) return false;
    const paymentDate = new Date(payment.createdAt);
    const startDate = new Date(week.startDate + "T00:00:00");
    const endDate = new Date(week.endDate + "T23:59:59");
    return paymentDate >= startDate && paymentDate <= endDate;
  };

  const filteredPayments = selectedWeekId 
    ? payments?.filter(p => {
        const week = sortedWeeks.find(w => w.id === selectedWeekId);
        return week ? isPaymentInWeek(p, week) : false;
      })
    : payments;

  const totalVerified = filteredPayments
    ?.filter((p) => p.status === "verified")
    .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const getStatusBadge = (status: string) => {
    const statusInfo = statusLabels[status as keyof typeof statusLabels];
    if (!statusInfo) return <Badge variant="outline">{status}</Badge>;
    const StatusIcon = statusInfo.icon;
    return (
      <Badge variant={statusInfo.variant} className="gap-1 text-[10px] px-1">
        <StatusIcon className="h-2.5 w-2.5" />
        {statusInfo.label}
      </Badge>
    );
  };

  const getCurrencyColor = (colorName: string) => {
    return colorClassMap[colorName] ?? defaultCurrencyColor;
  };

  const getPaymentAmountForCurrency = (payment: PaymentWithDetails, currencyCode: string) => {
    if (payment.currency?.code === currencyCode) {
      return Number(payment.amount);
    }
    return null;
  };

  const getTotalForCurrency = (currencyCode: string) => {
    return filteredPayments
      ?.filter(p => p.currency?.code === currencyCode)
      .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  };

  const getTotalInPEN = () => {
    return filteredPayments?.reduce((sum, p) => 
      sum + (Number(p.amount) * Number(p.currency?.exchangeRate ?? 1)), 0
    ) ?? 0;
  };

  const baseColWidth = activeCurrencies.length > 0 
    ? `50px 100px 130px repeat(${activeCurrencies.length}, 90px) 80px 100px 70px`
    : "50px 100px 130px 90px 80px 100px 70px";

  const selectedWeek = sortedWeeks.find(w => w.id === selectedWeekId);
  const maxVisibleTabs = 6;
  const visibleWeeks = sortedWeeks.slice(tabScrollPos, tabScrollPos + maxVisibleTabs);

  return (
    <div className="space-y-6 relative pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis Pagos</h1>
        <p className="text-muted-foreground">
          Tu comisión: <span className="font-medium">{user?.commissionPercent}%</span>
          {selectedWeek && (
            <span className="ml-2">
              | Semana S{selectedWeek.weekNumber} ({format(new Date(selectedWeek.startDate + "T00:00:00"), "dd MMM", { locale: es })} - {format(new Date(selectedWeek.endDate + "T00:00:00"), "dd MMM", { locale: es })})
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredPayments?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {filteredPayments?.filter((p) => p.status === "pending").length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verificados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredPayments?.filter((p) => p.status === "verified").length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total en PEN</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {getTotalInPEN().toLocaleString("es-PE", { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Historial de Pagos</CardTitle>
          <CardDescription>
            {selectedWeekId ? `Pagos de la semana S${selectedWeek?.weekNumber}` : "Todos los pagos registrados"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPayments?.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay pagos</h3>
              <p className="text-muted-foreground text-sm">
                {selectedWeekId ? "No hay pagos en esta semana" : "Registra tu primer pago"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: activeCurrencies.length > 3 ? `${600 + activeCurrencies.length * 90}px` : "800px" }}>
                <div 
                  className="grid border-b-2 border-gray-400 dark:border-gray-600 font-bold text-xs uppercase"
                  style={{ gridTemplateColumns: baseColWidth }}
                >
                  <div className="bg-gray-300 dark:bg-gray-700 p-2 text-center border-r border-gray-400 dark:border-gray-600">#</div>
                  <div className="bg-slate-200 dark:bg-slate-800 p-2 text-center border-r border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">FECHA</div>
                  <div className="bg-purple-200 dark:bg-purple-900 p-2 text-center border-r border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100">CLIENTE</div>
                  
                  {activeCurrencies.map((currency) => {
                    const colors = getCurrencyColor(currency.color ?? "gray");
                    return (
                      <div 
                        key={currency.id}
                        className={`${colors.header} p-2 text-center border-r`}
                      >
                        {currency.code}
                      </div>
                    );
                  })}
                  
                  <div className="bg-emerald-300 dark:bg-emerald-800 p-2 text-center border-r border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100">EN PEN</div>
                  <div className="bg-amber-200 dark:bg-amber-900 p-2 text-center border-r border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100">ESTADO</div>
                  <div className="bg-cyan-200 dark:bg-cyan-900 p-2 text-center text-cyan-900 dark:text-cyan-100">PRUEBA</div>
                </div>
                
                {filteredPayments?.map((payment, index) => (
                  <div 
                    key={payment.id}
                    className="grid border-b border-gray-200 dark:border-gray-700 text-sm"
                    style={{ gridTemplateColumns: baseColWidth }}
                    data-testid={`payment-row-${payment.id}`}
                  >
                    <div className="bg-gray-200 dark:bg-gray-800 p-2 text-center border-r border-gray-300 dark:border-gray-600 font-medium text-gray-600 dark:text-gray-400">
                      {index + 1}
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-2 text-center border-r border-slate-100 dark:border-slate-800 text-xs">
                      {payment.createdAt && (
                        <>
                          <div>{format(new Date(payment.createdAt), "dd/MM/yy", { locale: es })}</div>
                          <div className="text-[10px] text-muted-foreground">{format(new Date(payment.createdAt), "hh:mm a", { locale: es })}</div>
                        </>
                      )}
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-2 text-center border-r border-purple-100 dark:border-purple-900 font-mono text-xs font-medium">
                      {payment.clientNumber}
                    </div>
                    
                    {activeCurrencies.map((currency) => {
                      const amount = getPaymentAmountForCurrency(payment, currency.code);
                      const colors = getCurrencyColor(currency.color ?? "gray");
                      return (
                        <div 
                          key={currency.id}
                          className={`${colors.cell} p-2 text-right border-r font-medium ${colors.text}`}
                        >
                          {amount !== null ? amount.toLocaleString("es-PE", { minimumFractionDigits: 0 }) : ""}
                        </div>
                      );
                    })}
                    
                    <div className="bg-emerald-50 dark:bg-emerald-950 p-2 text-right border-r border-emerald-100 dark:border-emerald-900 font-bold text-emerald-700 dark:text-emerald-300">
                      {(Number(payment.amount) * Number(payment.currency?.exchangeRate ?? 1)).toLocaleString("es-PE", { minimumFractionDigits: 0 })}
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950 p-2 text-center border-r border-amber-100 dark:border-amber-900 flex flex-col items-center justify-center gap-0.5">
                      {getStatusBadge(payment.status)}
                      {payment.verifiedAt ? (
                        <div className="text-[9px] text-muted-foreground">{format(new Date(payment.verifiedAt), "dd/MM hh:mm a", { locale: es })}</div>
                      ) : (
                        <div className="text-[9px] text-muted-foreground">
                          {payment.createdAt && format(new Date(payment.createdAt), "dd/MM hh:mm a", { locale: es })}
                        </div>
                      )}
                    </div>
                    <div className="bg-cyan-50 dark:bg-cyan-950 p-2 flex items-center justify-center">
                      {payment.proofImage ? (
                        <button
                          onClick={() => setPreviewImage(payment.proofImage!)}
                          className="w-8 h-8 rounded overflow-hidden border bg-white dark:bg-gray-800 hover:opacity-80 transition-opacity"
                          data-testid={`button-proof-${payment.id}`}
                        >
                          <img src={payment.proofImage} alt="Prueba" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}

                <div 
                  className="grid border-t-2 border-gray-500 dark:border-gray-400 font-bold text-sm bg-gray-100 dark:bg-gray-800"
                  style={{ gridTemplateColumns: baseColWidth }}
                >
                  <div className="bg-gray-300 dark:bg-gray-700 p-2 text-center border-r border-gray-400 dark:border-gray-600"></div>
                  <div className="bg-gray-200 dark:bg-gray-800 p-2 border-r border-gray-300 dark:border-gray-700"></div>
                  <div className="bg-gray-200 dark:bg-gray-800 p-2 border-r border-gray-300 dark:border-gray-700 text-right text-xs">
                    TOTAL:
                  </div>
                  
                  {activeCurrencies.map((currency) => {
                    const total = getTotalForCurrency(currency.code);
                    const colors = getCurrencyColor(currency.color ?? "gray");
                    return (
                      <div 
                        key={currency.id}
                        className={`${colors.header} p-2 text-right border-r ${colors.text}`}
                      >
                        {total > 0 ? total.toLocaleString("es-PE", { minimumFractionDigits: 0 }) : ""}
                      </div>
                    );
                  })}
                  
                  <div className="bg-emerald-300 dark:bg-emerald-800 p-2 text-right border-r border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100">
                    {getTotalInPEN().toLocaleString("es-PE", { minimumFractionDigits: 0 })}
                  </div>
                  <div className="bg-amber-100 dark:bg-amber-950 p-2 border-r border-amber-200 dark:border-amber-900"></div>
                  <div className="bg-cyan-100 dark:bg-cyan-950 p-2"></div>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <div className="border-t bg-muted/30 p-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setTabScrollPos(Math.max(0, tabScrollPos - 1))}
              disabled={tabScrollPos === 0}
              data-testid="button-scroll-tabs-left"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 overflow-hidden">
              <button
                onClick={() => setSelectedWeekId(null)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors whitespace-nowrap ${
                  selectedWeekId === null
                    ? "bg-background border-primary text-primary"
                    : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                }`}
                data-testid="tab-all-payments"
              >
                Todas
              </button>

              {visibleWeeks.map((week) => (
                <button
                  key={week.id}
                  onClick={() => setSelectedWeekId(week.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors whitespace-nowrap ${
                    selectedWeekId === week.id
                      ? "bg-background border-primary text-primary"
                      : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                  }`}
                  data-testid={`tab-week-${week.weekNumber}`}
                >
                  S{week.weekNumber}
                </button>
              ))}

              <button
                onClick={() => generateWeekMutation.mutate()}
                disabled={generateWeekMutation.isPending}
                className="px-2 py-1.5 text-xs font-medium rounded-t border-b-2 border-transparent bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                data-testid="button-add-week"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setTabScrollPos(Math.min(sortedWeeks.length - maxVisibleTabs, tabScrollPos + 1))}
              disabled={tabScrollPos >= sortedWeeks.length - maxVisibleTabs}
              data-testid="button-scroll-tabs-right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>


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
