import { useQuery } from "@tanstack/react-query";
import { PaymentWithDetails, Currency } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "wouter";
import { CheckCircle, XCircle, Clock, FileText, Image as ImageIcon, Plus } from "lucide-react";

const statusLabels = {
  pending: { label: "Pendiente", variant: "secondary" as const, icon: Clock },
  verified: { label: "Verificado", variant: "default" as const, icon: CheckCircle },
  rejected: { label: "Rechazado", variant: "destructive" as const, icon: XCircle },
};

const currencyColors: Record<string, { header: string; cell: string; text: string }> = {
  PEN: {
    header: "bg-green-300 dark:bg-green-800 border-green-400 dark:border-green-700 text-green-900 dark:text-green-100",
    cell: "bg-green-100 dark:bg-green-950 border-green-200 dark:border-green-900",
    text: "text-green-800 dark:text-green-200",
  },
  MXN: {
    header: "bg-pink-300 dark:bg-pink-800 border-pink-400 dark:border-pink-700 text-pink-900 dark:text-pink-100",
    cell: "bg-pink-100 dark:bg-pink-950 border-pink-200 dark:border-pink-900",
    text: "text-pink-800 dark:text-pink-200",
  },
  USD: {
    header: "bg-blue-300 dark:bg-blue-800 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100",
    cell: "bg-blue-100 dark:bg-blue-950 border-blue-200 dark:border-blue-900",
    text: "text-blue-800 dark:text-blue-200",
  },
  EUR: {
    header: "bg-indigo-300 dark:bg-indigo-800 border-indigo-400 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100",
    cell: "bg-indigo-100 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-900",
    text: "text-indigo-800 dark:text-indigo-200",
  },
  COP: {
    header: "bg-amber-300 dark:bg-amber-800 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-100",
    cell: "bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-900",
    text: "text-amber-800 dark:text-amber-200",
  },
};

const defaultCurrencyColor = {
  header: "bg-gray-300 dark:bg-gray-700 border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100",
  cell: "bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800",
  text: "text-gray-800 dark:text-gray-200",
};

export default function TutorPaymentsPage() {
  const { user } = useAuth();
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: payments, isLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/tutor/payments"],
  });

  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const activeCurrencies = currencies ?? [];

  const totalVerified = payments
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

  const getCurrencyColor = (code: string) => {
    return currencyColors[code] ?? defaultCurrencyColor;
  };

  const getPaymentAmountForCurrency = (payment: PaymentWithDetails, currencyCode: string) => {
    if (payment.currency?.code === currencyCode) {
      return Number(payment.amount);
    }
    return null;
  };

  const getTotalForCurrency = (currencyCode: string) => {
    return payments
      ?.filter(p => p.currency?.code === currencyCode)
      .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  };

  const getTotalInPEN = () => {
    return payments?.reduce((sum, p) => 
      sum + (Number(p.amount) * Number(p.currency?.exchangeRate ?? 1)), 0
    ) ?? 0;
  };

  const baseColWidth = activeCurrencies.length > 0 
    ? `50px 100px 130px repeat(${activeCurrencies.length}, 90px) 80px 100px 70px`
    : "50px 100px 130px 90px 80px 100px 70px";

  return (
    <div className="space-y-6 relative pb-20">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis Pagos</h1>
        <p className="text-muted-foreground">
          Tu comisión: <span className="font-medium">{user?.commissionPercent}%</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {payments?.filter((p) => p.status === "pending").length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verificados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {payments?.filter((p) => p.status === "verified").length ?? 0}
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

      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos</CardTitle>
          <CardDescription>Hoja de cálculo con todos tus pagos registrados</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : payments?.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay pagos</h3>
              <p className="text-muted-foreground text-sm">Registra tu primer pago</p>
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
                    const colors = getCurrencyColor(currency.code);
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
                
                {payments?.map((payment, index) => (
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
                      {payment.createdAt && format(new Date(payment.createdAt), "dd/MM/yy", { locale: es })}
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-2 text-center border-r border-purple-100 dark:border-purple-900 font-mono text-xs font-medium">
                      {payment.clientNumber}
                    </div>
                    
                    {activeCurrencies.map((currency) => {
                      const amount = getPaymentAmountForCurrency(payment, currency.code);
                      const colors = getCurrencyColor(currency.code);
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
                    <div className="bg-amber-50 dark:bg-amber-950 p-2 text-center border-r border-amber-100 dark:border-amber-900 flex items-center justify-center">
                      {getStatusBadge(payment.status)}
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
                    const colors = getCurrencyColor(currency.code);
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
      </Card>

      <Link href="/tutor/new-payment">
        <Button
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          data-testid="button-add-payment"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </Link>

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
