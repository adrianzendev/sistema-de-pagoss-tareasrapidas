import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Currency, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
import { Plus, Loader2, Coins, Edit, Trash2 } from "lucide-react";

const colorOptions = [
  { value: "white", label: "Blanco", preview: "bg-white border border-border" },
  { value: "black", label: "Negro", preview: "bg-black" },
];

const currencySchema = z.object({
  code: z.string().min(1, "Código requerido").max(10, "Código muy largo"),
  name: z.string().min(2, "Nombre muy corto"),
  exchangeRate: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Tasa debe ser mayor a 0"),
  commissionPercent: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Comisión debe estar entre 0 y 100"),
  color: z.string().min(1, "Color requerido"),
  verifierId: z.string().optional(),
});

type CurrencyForm = z.infer<typeof currencySchema>;

const getColorPreview = (color: string) => {
  const colorMap: Record<string, string> = {
    white: "bg-white border border-border",
    black: "bg-black",
  };
  return colorMap[color] ?? "";
};

export default function CurrenciesPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: currencies, isLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const { data: verifiers } = useQuery<User[]>({
    queryKey: ["/api/admin/verifiers"],
  });

  const form = useForm<CurrencyForm>({
    resolver: zodResolver(currencySchema),
    defaultValues: {
      code: "",
      name: "",
      exchangeRate: "1",
      commissionPercent: "0",
      color: "white",
      verifierId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CurrencyForm) => apiRequest("POST", "/api/admin/currencies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      setIsOpen(false);
      form.reset();
      toast({ title: "Divisa creada", description: "La divisa ha sido creada correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CurrencyForm }) =>
      apiRequest("PATCH", `/api/admin/currencies/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      setEditingCurrency(null);
      form.reset();
      toast({ title: "Divisa actualizada", description: "La divisa ha sido actualizada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/currencies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      setDeleteId(null);
      toast({ title: "Divisa eliminada", description: "La divisa ha sido eliminada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEdit = (currency: Currency) => {
    setEditingCurrency(currency);
    form.reset({
      code: currency.code,
      name: currency.name,
      exchangeRate: String(currency.exchangeRate),
      commissionPercent: String(currency.commissionPercent ?? "0"),
      color: currency.color ?? "gray",
      verifierId: currency.verifierId ?? "",
    });
  };

  const handleSubmit = (data: CurrencyForm) => {
    const submitData = {
      ...data,
      verifierId: data.verifierId === "none" || data.verifierId === "" ? null : data.verifierId,
    };
    if (editingCurrency) {
      updateMutation.mutate({ id: editingCurrency.id, data: submitData as any });
    } else {
      createMutation.mutate(submitData as any);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Divisas</h1>
          <p className="text-muted-foreground">Gestiona los tipos de cambio y colores de columnas</p>
        </div>

        <Dialog
          open={isOpen || !!editingCurrency}
          onOpenChange={(open) => {
            if (!open) {
              setIsOpen(false);
              setEditingCurrency(null);
              form.reset();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setIsOpen(true)} data-testid="button-new-currency">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Divisa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                {editingCurrency ? "Editar Divisa" : "Nueva Divisa"}
              </DialogTitle>
              <DialogDescription>
                {editingCurrency ? "Modifica los datos de la divisa" : "Ingresa los datos de la nueva divisa"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="USD" className="uppercase" data-testid="input-currency-code" />
                      </FormControl>
                      <FormDescription className="text-xs">Este código aparecerá como encabezado de columna</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Dólar Estadounidense" data-testid="input-currency-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Cambio (1 Divisa = X PEN)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.0001" min="0" placeholder="1.0000" data-testid="input-currency-rate" />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Indica cuántos PEN (Soles) equivale a 1 unidad de esta divisa.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                <FormField
                  control={form.control}
                  name="commissionPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comisión %</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input {...field} type="number" step="0.01" min="0" max="100" placeholder="0" data-testid="input-currency-commission" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">%</span>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Comisión del titular de la cuenta bancaria (se descuenta del ingreso bruto).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="verifierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verificador</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-currency-verifier">
                            <SelectValue placeholder="Sin verificador asignado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin verificador</SelectItem>
                          {verifiers?.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        El verificador recibirá los pagos en esta divisa para verificar
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsOpen(false);
                      setEditingCurrency(null);
                      form.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting} data-testid="button-submit-currency">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : editingCurrency ? (
                      "Actualizar"
                    ) : (
                      "Crear Divisa"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Divisas</CardTitle>
          <CardDescription>
            {currencies?.length ?? 0} divisas configuradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : currencies?.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-border">
                <Coins className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay divisas</h3>
              <p className="text-muted-foreground text-sm">Crea la primera divisa para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Verificador</TableHead>
                    <TableHead className="text-right">Tipo de Cambio</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies?.map((currency) => (
                    <TableRow key={currency.id} data-testid={`row-currency-${currency.id}`}>
                      <TableCell>
                        <div className={`w-6 h-6 rounded ${getColorPreview(currency.color ?? "gray")}`} />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{currency.code}</TableCell>
                      <TableCell>{currency.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {currency.verifierId 
                          ? verifiers?.find(v => v.id === currency.verifierId)?.name ?? "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(currency.exchangeRate).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(currency.commissionPercent ?? 0) > 0
                          ? <span className="text-warning font-semibold">{Number(currency.commissionPercent).toFixed(2)}%</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(currency)}
                            data-testid={`button-edit-currency-${currency.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(currency.id)}
                            data-testid={`button-delete-currency-${currency.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar divisa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La divisa será eliminada del sistema.
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
