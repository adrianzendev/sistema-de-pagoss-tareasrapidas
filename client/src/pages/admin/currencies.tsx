import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Currency } from "@shared/schema";
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
import { Plus, Loader2, DollarSign, Edit, Trash2 } from "lucide-react";

const colorOptions = [
  { value: "green", label: "Verde", preview: "bg-green-500" },
  { value: "pink", label: "Rosa", preview: "bg-pink-500" },
  { value: "blue", label: "Azul", preview: "bg-blue-500" },
  { value: "indigo", label: "Índigo", preview: "bg-indigo-500" },
  { value: "amber", label: "Ámbar", preview: "bg-amber-500" },
  { value: "rose", label: "Rosado", preview: "bg-rose-500" },
  { value: "teal", label: "Turquesa", preview: "bg-teal-500" },
  { value: "purple", label: "Púrpura", preview: "bg-purple-500" },
  { value: "cyan", label: "Cian", preview: "bg-cyan-500" },
  { value: "orange", label: "Naranja", preview: "bg-orange-500" },
  { value: "red", label: "Rojo", preview: "bg-red-500" },
  { value: "yellow", label: "Amarillo", preview: "bg-yellow-500" },
  { value: "lime", label: "Lima", preview: "bg-lime-500" },
  { value: "emerald", label: "Esmeralda", preview: "bg-emerald-500" },
  { value: "sky", label: "Cielo", preview: "bg-sky-500" },
  { value: "violet", label: "Violeta", preview: "bg-violet-500" },
  { value: "fuchsia", label: "Fucsia", preview: "bg-fuchsia-500" },
  { value: "slate", label: "Gris", preview: "bg-slate-500" },
];

const currencySchema = z.object({
  code: z.string().min(1, "Código requerido").max(10, "Código muy largo"),
  name: z.string().min(2, "Nombre muy corto"),
  exchangeRate: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Tasa debe ser mayor a 0"),
  color: z.string().min(1, "Color requerido"),
});

type CurrencyForm = z.infer<typeof currencySchema>;

const getColorPreview = (color: string) => {
  const colorMap: Record<string, string> = {
    green: "bg-green-500",
    pink: "bg-pink-500",
    blue: "bg-blue-500",
    indigo: "bg-indigo-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    teal: "bg-teal-500",
    purple: "bg-purple-500",
    cyan: "bg-cyan-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    lime: "bg-lime-500",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
    fuchsia: "bg-fuchsia-500",
    slate: "bg-slate-500",
    gray: "bg-gray-500",
  };
  return colorMap[color] ?? "bg-gray-500";
};

export default function CurrenciesPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: currencies, isLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const form = useForm<CurrencyForm>({
    resolver: zodResolver(currencySchema),
    defaultValues: {
      code: "",
      name: "",
      exchangeRate: "1",
      color: "gray",
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
      color: currency.color ?? "gray",
    });
  };

  const handleSubmit = (data: CurrencyForm) => {
    if (editingCurrency) {
      updateMutation.mutate({ id: editingCurrency.id, data });
    } else {
      createMutation.mutate(data);
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
                <DollarSign className="h-5 w-5" />
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
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color de Columna</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-currency-color">
                            <SelectValue placeholder="Selecciona un color" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {colorOptions.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded ${color.preview}`} />
                                <span>{color.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Este color se usará para la columna en la tabla de pagos
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
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <DollarSign className="h-8 w-8 text-muted-foreground" />
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
                    <TableHead className="text-right">Tipo de Cambio</TableHead>
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
                      <TableCell className="text-right font-mono">
                        {Number(currency.exchangeRate).toFixed(4)}
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
