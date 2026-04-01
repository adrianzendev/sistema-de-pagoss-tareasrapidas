import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PaymentWithDetails } from "@shared/schema";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
  pending: { label: "Pendiente", variant: "secondary" as const, icon: Clock },
  verified: { label: "Verificado", variant: "default" as const, icon: CheckCircle },
  rejected: { label: "Rechazado", variant: "destructive" as const, icon: XCircle },
  refunded: { label: "Reembolsado", variant: "outline" as const, icon: XCircle },
};

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: payments, isLoading } = useQuery<PaymentWithDetails[]>({
    queryKey: ["/api/admin/payments", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payments?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    }
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
  );

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
          ) : filteredPayments?.length === 0 ? (
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
                  <TableRow>
                    <TableHead>Solicitud</TableHead>
                    <TableHead>Tutor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Verificación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments?.map((payment) => {
                    const status = statusLabels[payment.status];
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {payment.createdAt && (
                            <div>
                              <div>{format(new Date(payment.createdAt), "dd MMM yyyy", { locale: es })}</div>
                              <div className="text-xs">{format(new Date(payment.createdAt), "HH:mm", { locale: es })}</div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{payment.tutor?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.clientNumber}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className="text-xs text-muted-foreground mr-1">{payment.currency?.code}</span>
                          {Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {payment.proofImage ? (
                            <button
                              onClick={() => setPreviewImage(payment.proofImage!)}
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                              data-testid={`button-view-proof-${payment.id}`}
                            >
                              <ImageIcon className="h-4 w-4" />
                              Ver
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sin imagen</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {payment.verifiedAt ? (
                            <div>
                              <div>{format(new Date(payment.verifiedAt), "dd MMM yyyy", { locale: es })}</div>
                              <div className="text-xs">{format(new Date(payment.verifiedAt), "HH:mm", { locale: es })}</div>
                            </div>
                          ) : (
                            <span className="text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {payment.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateMutation.mutate({ id: payment.id, status: "verified" })}
                                  disabled={updateMutation.isPending}
                                  data-testid={`button-verify-${payment.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateMutation.mutate({ id: payment.id, status: "rejected" })}
                                  disabled={updateMutation.isPending}
                                  data-testid={`button-reject-${payment.id}`}
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            {payment.status === "verified" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateMutation.mutate({ id: payment.id, status: "refunded" })}
                                disabled={updateMutation.isPending}
                                data-testid={`button-refund-${payment.id}`}
                              >
                                <RotateCcw className="h-4 w-4 text-orange-600" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteId(payment.id)}
                              data-testid={`button-delete-payment-${payment.id}`}
                            >
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
