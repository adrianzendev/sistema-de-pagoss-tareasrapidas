import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus, Search, Loader2, Phone, Trash2, Pencil, Users,
  ChevronDown, ChevronUp, CheckCircle, XCircle, Clock,
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

const clientSchema = z.object({
  phoneNumber: z.string().min(1, "Número requerido"),
  name: z.string().optional(),
});

type ClientForm = z.infer<typeof clientSchema>;

type ClientPaymentSummary = {
  id: string;
  amount: string;
  currencyCode: string;
  status: string;
  tutorName: string;
  createdAt: string | null;
  notes: string | null;
};

type ClientWithStats = {
  client: Client;
  stats: {
    total: number;
    verified: number;
    rejected: number;
    pending: number;
    tutors: { id: string; name: string }[];
    firstActivity: string | null;
    lastActivity: string | null;
    payments: ClientPaymentSummary[];
  };
};

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  verified: { label: "Verificado", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  rejected: { label: "Rechazado", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
};

export default function ClientsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: clientStats, isLoading } = useQuery<ClientWithStats[]>({
    queryKey: ["/api/admin/clients-stats"],
  });

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: { phoneNumber: "", name: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: ClientForm) => apiRequest("POST", "/api/admin/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients-stats"] });
      setIsOpen(false);
      form.reset();
      toast({ title: "Cliente agregado", description: "El cliente ha sido registrado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClientForm }) =>
      apiRequest("PATCH", `/api/admin/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients-stats"] });
      setEditingClient(null);
      form.reset();
      toast({ title: "Cliente actualizado", description: "Los datos han sido actualizados" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients-stats"] });
      setDeleteId(null);
      toast({ title: "Cliente eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    form.setValue("phoneNumber", client.phoneNumber);
    form.setValue("name", client.name || "");
  };

  const handleSubmit = (data: ClientForm) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingClient(null);
    form.reset();
  };

  const filtered = clientStats?.filter(({ client }) => {
    const q = search.toLowerCase();
    return (
      client.phoneNumber.toLowerCase().includes(q) ||
      (client.name && client.name.toLowerCase().includes(q))
    );
  });

  const totalVerified = clientStats?.reduce((s, c) => s + c.stats.verified, 0) ?? 0;
  const totalRejected = clientStats?.reduce((s, c) => s + c.stats.rejected, 0) ?? 0;
  const totalRequests = clientStats?.reduce((s, c) => s + c.stats.total, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Base de datos de alumnos — historial completo por cliente</p>
        </div>

        <Dialog open={isOpen || !!editingClient} onOpenChange={(open) => !open && handleClose()}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-client" onClick={() => setIsOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {editingClient ? "Editar Cliente" : "Nuevo Cliente"}
              </DialogTitle>
              <DialogDescription>
                {editingClient ? "Modifica los datos del cliente" : "Registra un nuevo cliente manualmente"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp / Teléfono</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} placeholder="Ej: +51 935 436 864" className="pl-10" data-testid="input-client-phone" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nombre del alumno" data-testid="input-client-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-client">
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                    ) : editingClient ? "Actualizar" : "Agregar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total clientes</p>
            <p className="text-2xl font-bold">{clientStats?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">{totalRequests} solicitudes totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Verificados</p>
            <p className="text-2xl font-bold text-green-600">{totalVerified}</p>
            <p className="text-xs text-muted-foreground">pagos aceptados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Rechazados</p>
            <p className="text-2xl font-bold text-red-500">{totalRejected}</p>
            <p className="text-xs text-muted-foreground">pagos rechazados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <CardTitle>Historial de Clientes</CardTitle>
              <CardDescription>{filtered?.length ?? 0} clientes</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-clients"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay clientes</h3>
              <p className="text-muted-foreground text-sm">
                {search ? "No se encontraron clientes con ese criterio" : "Los clientes aparecen automáticamente cuando los tutores registran pagos"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered?.map(({ client, stats }) => {
                const isExpanded = expandedId === client.id;
                return (
                  <div key={client.id} data-testid={`row-client-${client.id}`}>
                    <div className="flex items-center gap-3 px-6 py-4 hover:bg-muted/30 transition-colors">
                      <button
                        className="flex-1 flex items-center gap-4 text-left"
                        onClick={() => setExpandedId(isExpanded ? null : client.id)}
                        data-testid={`button-expand-client-${client.id}`}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-sm">{client.phoneNumber}</span>
                            {client.name && (
                              <span className="text-muted-foreground text-sm">· {client.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {stats.tutors.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {stats.tutors.map(t => t.name).join(", ")}
                              </span>
                            )}
                            {stats.lastActivity && (
                              <span className="text-xs text-muted-foreground">
                                Último: {format(new Date(stats.lastActivity), "dd/MM/yyyy", { locale: es })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs" data-testid={`badge-total-${client.id}`}>
                            {stats.total} {stats.total === 1 ? "solicitud" : "solicitudes"}
                          </Badge>
                          {stats.verified > 0 && (
                            <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" data-testid={`badge-verified-${client.id}`}>
                              ✓ {stats.verified}
                            </Badge>
                          )}
                          {stats.rejected > 0 && (
                            <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0" data-testid={`badge-rejected-${client.id}`}>
                              ✗ {stats.rejected}
                            </Badge>
                          )}
                          {stats.pending > 0 && (
                            <Badge className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0" data-testid={`badge-pending-${client.id}`}>
                              ⏳ {stats.pending}
                            </Badge>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(client)}
                          data-testid={`button-edit-client-${client.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteId(client.id)}
                          data-testid={`button-delete-client-${client.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-4 bg-muted/20">
                        <p className="text-xs font-medium text-muted-foreground mb-3 pt-2">Historial de solicitudes</p>
                        {stats.payments.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Sin pagos registrados aún</p>
                        ) : (
                          <div className="rounded-md border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/40">
                                  <TableHead className="text-xs py-2">Fecha</TableHead>
                                  <TableHead className="text-xs py-2">Tutor</TableHead>
                                  <TableHead className="text-xs py-2 text-right">Monto</TableHead>
                                  <TableHead className="text-xs py-2">Estado</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {[...stats.payments]
                                  .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                                  .map((payment) => {
                                    const sc = statusConfig[payment.status] ?? statusConfig.pending;
                                    const Icon = sc.icon;
                                    return (
                                      <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                                        <TableCell className="text-xs py-2 text-muted-foreground">
                                          {payment.createdAt
                                            ? format(new Date(payment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })
                                            : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs py-2 font-medium">{payment.tutorName}</TableCell>
                                        <TableCell className="text-xs py-2 text-right font-mono">
                                          {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })} {payment.currencyCode}
                                        </TableCell>
                                        <TableCell className="text-xs py-2">
                                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.className}`}>
                                            <Icon className="h-3 w-3" />
                                            {sc.label}
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              El cliente será eliminado de la base de datos. Los pagos ya registrados no se verán afectados.
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
