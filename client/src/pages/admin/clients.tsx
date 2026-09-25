import { Fragment, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  verified: { label: "Verificado", className: "text-success border-success/40", icon: CheckCircle },
  rejected: { label: "Rechazado", className: "text-destructive border-destructive/40", icon: XCircle },
  pending: { label: "Pendiente", className: "text-warning border-warning/40", icon: Clock },
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Total clientes</p>
            <p className="text-2xl font-bold">{clientStats?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">{totalRequests} solicitudes totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Verificados</p>
            <p className="text-2xl font-bold text-success">{totalVerified}</p>
            <p className="text-xs text-muted-foreground">pagos aceptados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Rechazados</p>
            <p className="text-2xl font-bold text-destructive">{totalRejected}</p>
            <p className="text-xs text-muted-foreground">pagos rechazados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-border">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay clientes</h3>
              <p className="text-muted-foreground text-sm">
                {search ? "No se encontraron clientes con ese criterio" : "Los clientes aparecen automáticamente cuando los tutores registran pagos"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente / teléfono</TableHead>
                  <TableHead>Tutores y fecha</TableHead>
                  <TableHead>Solicitudes</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filtered?.map(({ client, stats }) => {
                const isExpanded = expandedId === client.id;
                return (
                  <Fragment key={client.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : client.id)}
                      data-testid={`row-client-${client.id}`}
                    >
                      <TableCell>
                        <div className="font-mono font-medium text-foreground">{client.phoneNumber}</div>
                        {client.name && <div className="text-xs text-muted-foreground">{client.name}</div>}
                      </TableCell>
                      <TableCell>
                        <div>{stats.tutors.length > 0 ? stats.tutors.map(t => t.name).join(", ") : "—"}</div>
                        {stats.lastActivity && (
                          <div className="text-xs text-muted-foreground">
                            Último: {format(new Date(stats.lastActivity), "dd/MM/yyyy", { locale: es })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-muted-foreground" data-testid={`badge-total-${client.id}`}>{stats.total}</span>
                          {stats.verified > 0 && <span className="text-success" data-testid={`badge-verified-${client.id}`}>✓ {stats.verified}</span>}
                          {stats.rejected > 0 && <span className="text-destructive" data-testid={`badge-rejected-${client.id}`}>✗ {stats.rejected}</span>}
                          {stats.pending > 0 && <span className="text-warning" data-testid={`badge-pending-${client.id}`}>⏳ {stats.pending}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(client)} data-testid={`button-edit-client-${client.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(client.id)} data-testid={`button-delete-client-${client.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(isExpanded ? null : client.id)} data-testid={`button-expand-client-${client.id}`} aria-label={isExpanded ? "Ocultar historial" : "Ver historial"}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={4} className="py-2">
                          <p className="text-xs font-medium text-muted-foreground mb-3 pt-2">Historial de solicitudes</p>
                          {stats.payments.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">Sin pagos registrados aún</p>
                          ) : (
                            <div className="rounded-md border overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Tutor</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead>Estado</TableHead>
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
                                          <TableCell className="text-xs text-muted-foreground">
                                            {payment.createdAt
                                              ? format(new Date(payment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })
                                              : "—"}
                                          </TableCell>
                                          <TableCell>{payment.tutorName}</TableCell>
                                          <TableCell className="text-right font-semibold tabular-nums">
                                            {Number(payment.amount).toLocaleString("es-PE", { minimumFractionDigits: 2 })} {payment.currencyCode}
                                          </TableCell>
                                          <TableCell>
                                            <Badge className={`gap-1 text-xs px-2 py-1 ${sc.className}`}>
                                              <Icon className="h-3 w-3" />
                                              {sc.label}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              </TableBody>
            </Table>
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
              className="border border-destructive bg-background text-destructive hover:bg-accent"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
