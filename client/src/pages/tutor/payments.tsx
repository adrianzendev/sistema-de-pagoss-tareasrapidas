import { useQuery } from "@tanstack/react-query";
import { PaymentWithDetails } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, XCircle, Clock, FileText, Image as ImageIcon } from "lucide-react";

const statusLabels = {
  pending: { label: "Pendiente", variant: "secondary" as const, icon: Clock },
  verified: { label: "Verificado", variant: "default" as const, icon: CheckCircle },
  rejected: { label: "Rechazado", variant: "destructive" as const, icon: XCircle },
};

export default function TutorPaymentsPage() {
  const { user } = useAuth();
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: payments, isLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/tutor/payments"],
  });

  const totalVerified = payments
    ?.filter((p) => p.status === "verified")
    .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const getStatusBadge = (status: string) => {
    const statusInfo = statusLabels[status as keyof typeof statusLabels];
    if (!statusInfo) return <Badge variant="outline">{status}</Badge>;
    const StatusIcon = statusInfo.icon;
    return (
      <Badge variant={statusInfo.variant} className="gap-1">
        <StatusIcon className="h-3 w-3" />
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Verificado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalVerified.toLocaleString()}</div>
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
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[50px_120px_150px_120px_80px_100px_100px_100px] border-b-2 border-gray-400 dark:border-gray-600 font-bold text-xs uppercase">
                  <div className="bg-gray-300 dark:bg-gray-700 p-3 text-center border-r border-gray-400 dark:border-gray-600">#</div>
                  <div className="bg-blue-200 dark:bg-blue-900 p-3 text-center border-r border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100">FECHA</div>
                  <div className="bg-purple-200 dark:bg-purple-900 p-3 text-center border-r border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100">CLIENTE</div>
                  <div className="bg-green-300 dark:bg-green-800 p-3 text-center border-r border-green-400 dark:border-green-700 text-green-900 dark:text-green-100">MONTO</div>
                  <div className="bg-cyan-200 dark:bg-cyan-900 p-3 text-center border-r border-cyan-300 dark:border-cyan-700 text-cyan-900 dark:text-cyan-100">MONEDA</div>
                  <div className="bg-amber-200 dark:bg-amber-900 p-3 text-center border-r border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100">ESTADO</div>
                  <div className="bg-pink-200 dark:bg-pink-900 p-3 text-center border-r border-pink-300 dark:border-pink-700 text-pink-900 dark:text-pink-100">EN PEN</div>
                  <div className="bg-slate-300 dark:bg-slate-700 p-3 text-center text-slate-900 dark:text-slate-100">COMPROBANTE</div>
                </div>
                
                {payments?.map((payment, index) => (
                  <div 
                    key={payment.id}
                    className="grid grid-cols-[50px_120px_150px_120px_80px_100px_100px_100px] border-b border-gray-200 dark:border-gray-700 text-sm"
                    data-testid={`payment-row-${payment.id}`}
                  >
                    <div className="bg-gray-200 dark:bg-gray-800 p-3 text-center border-r border-gray-300 dark:border-gray-600 font-medium text-gray-600 dark:text-gray-400">
                      {index + 1}
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 text-center border-r border-blue-100 dark:border-blue-900 text-xs">
                      {payment.createdAt && format(new Date(payment.createdAt), "dd MMM yyyy", { locale: es })}
                      <br />
                      <span className="text-muted-foreground text-[10px]">
                        {payment.createdAt && format(new Date(payment.createdAt), "HH:mm", { locale: es })}
                      </span>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-3 text-center border-r border-purple-100 dark:border-purple-900 font-mono font-medium">
                      {payment.clientNumber}
                    </div>
                    <div className="bg-green-100 dark:bg-green-950 p-3 text-right border-r border-green-200 dark:border-green-900 font-bold text-green-800 dark:text-green-200">
                      {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="bg-cyan-50 dark:bg-cyan-950 p-3 text-center border-r border-cyan-100 dark:border-cyan-900 font-medium">
                      {payment.currency?.code ?? "PEN"}
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950 p-3 text-center border-r border-amber-100 dark:border-amber-900 flex items-center justify-center">
                      {getStatusBadge(payment.status)}
                    </div>
                    <div className="bg-pink-50 dark:bg-pink-950 p-3 text-right border-r border-pink-100 dark:border-pink-900 font-medium text-pink-800 dark:text-pink-200">
                      S/ {(Number(payment.amount) * Number(payment.currency?.exchangeRate ?? 1)).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-900 p-3 flex items-center justify-center">
                      {payment.proofImage ? (
                        <button
                          onClick={() => setPreviewImage(payment.proofImage!)}
                          className="w-10 h-10 rounded-md overflow-hidden border bg-white dark:bg-gray-800 hover:opacity-80 transition-opacity flex items-center justify-center"
                          data-testid={`button-proof-${payment.id}`}
                        >
                          <img
                            src={payment.proofImage}
                            alt="Comprobante"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="w-10 h-10 rounded-md border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-[50px_120px_150px_120px_80px_100px_100px_100px] border-t-2 border-gray-500 dark:border-gray-400 font-bold text-sm bg-gray-100 dark:bg-gray-800">
                  <div className="bg-gray-300 dark:bg-gray-700 p-3 text-center border-r border-gray-400 dark:border-gray-600"></div>
                  <div className="bg-gray-200 dark:bg-gray-800 p-3 border-r border-gray-300 dark:border-gray-700 col-span-2 text-right pr-4">
                    TOTAL ({payments?.length} pagos):
                  </div>
                  <div className="bg-green-200 dark:bg-green-900 p-3 text-right border-r border-green-300 dark:border-green-800 text-green-800 dark:text-green-200">
                    {payments?.reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="bg-cyan-100 dark:bg-cyan-950 p-3 border-r border-cyan-200 dark:border-cyan-900"></div>
                  <div className="bg-amber-100 dark:bg-amber-950 p-3 border-r border-amber-200 dark:border-amber-900"></div>
                  <div className="bg-pink-200 dark:bg-pink-900 p-3 text-right border-r border-pink-300 dark:border-pink-800 text-pink-800 dark:text-pink-200">
                    S/ {payments?.reduce((sum, p) => sum + (Number(p.amount) * Number(p.currency?.exchangeRate ?? 1)), 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="bg-slate-200 dark:bg-slate-800 p-3"></div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
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
