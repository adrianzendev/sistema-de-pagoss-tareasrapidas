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
import { CheckCircle, XCircle, Clock, Image as ImageIcon, FileText } from "lucide-react";

const statusLabels = {
  pending: { label: "No Verificado", variant: "secondary" as const, icon: Clock, bg: "bg-yellow-50 dark:bg-yellow-950/20" },
  verified: { label: "Verificado", variant: "default" as const, icon: CheckCircle, bg: "bg-green-50 dark:bg-green-950/20" },
  rejected: { label: "Rechazado", variant: "destructive" as const, icon: XCircle, bg: "bg-red-50 dark:bg-red-950/20" },
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
          <CardDescription>Todos tus pagos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
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
            <div className="space-y-3">
              {payments?.map((payment) => {
                const status = statusLabels[payment.status];
                const StatusIcon = status.icon;
                return (
                  <div
                    key={payment.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border ${status.bg}`}
                    data-testid={`payment-card-${payment.id}`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-semibold">
                          {payment.currency?.code} {Number(payment.amount).toLocaleString()}
                        </span>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>Cliente: <span className="font-medium">{payment.clientNumber}</span></span>
                        <span>
                          {payment.createdAt && format(new Date(payment.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>

                    {payment.proofImage && (
                      <button
                        onClick={() => setPreviewImage(payment.proofImage!)}
                        className="w-16 h-16 rounded-md overflow-hidden border bg-muted flex-shrink-0 hover:opacity-80 transition-opacity"
                        data-testid={`button-proof-${payment.id}`}
                      >
                        <img
                          src={payment.proofImage}
                          alt="Comprobante"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    )}
                  </div>
                );
              })}
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
