import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Currency } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Loader2, ShieldCheck, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const createVerifierSchema = z.object({
  name: z.string().min(2, "Nombre muy corto"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const editVerifierSchema = z.object({
  name: z.string().min(2, "Nombre muy corto"),
  email: z.string().email("Email inválido"),
  password: z.string().optional().refine(val => !val || val.length >= 6, "Mínimo 6 caracteres"),
});

type CreateVerifierForm = z.infer<typeof createVerifierSchema>;
type EditVerifierForm = z.infer<typeof editVerifierSchema>;

export default function VerifiersPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingVerifier, setEditingVerifier] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCurrencyIds, setSelectedCurrencyIds] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: verifiers, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/verifiers"],
  });

  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const getCurrenciesForVerifier = (verifierId: string) => {
    return currencies?.filter(c => c.verifierId === verifierId) ?? [];
  };

  const createForm = useForm<CreateVerifierForm>({
    resolver: zodResolver(createVerifierSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const editForm = useForm<EditVerifierForm>({
    resolver: zodResolver(editVerifierSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const updateCurrencyLinks = async (verifierId: string, currencyIds: string[]) => {
    const allCurrencies = currencies ?? [];
    for (const c of allCurrencies) {
      const shouldLink = currencyIds.includes(c.id);
      const isLinked = c.verifierId === verifierId;
      if (shouldLink && !isLinked) {
        await apiRequest("PATCH", `/api/admin/currencies/${c.id}`, { verifierId });
      } else if (!shouldLink && isLinked) {
        await apiRequest("PATCH", `/api/admin/currencies/${c.id}`, { verifierId: null });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateVerifierForm) => {
      const res = await apiRequest("POST", "/api/admin/verifiers", data);
      const verifier = await res.json();
      if (selectedCurrencyIds.length > 0) {
        await updateCurrencyLinks(verifier.id, selectedCurrencyIds);
      }
      return verifier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifiers"] });
      setIsOpen(false);
      createForm.reset();
      setSelectedCurrencyIds([]);
      toast({ title: "Verificador creado", description: "El verificador ha sido creado correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditVerifierForm }) => {
      const body: any = { name: data.name, email: data.email };
      if (data.password) body.password = data.password;
      await apiRequest("PATCH", `/api/admin/verifiers/${id}`, body);
      await updateCurrencyLinks(id, selectedCurrencyIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifiers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      setEditingVerifier(null);
      editForm.reset();
      setSelectedCurrencyIds([]);
      toast({ title: "Verificador actualizado", description: "Los datos han sido actualizados" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/verifiers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifiers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      setDeleteId(null);
      toast({ title: "Verificador eliminado", description: "El verificador ha sido eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setSelectedCurrencyIds([]);
    createForm.reset();
    setIsOpen(true);
  };

  const openEdit = (verifier: User) => {
    setEditingVerifier(verifier);
    editForm.reset({
      name: verifier.name,
      email: verifier.email,
      password: "",
    });
    setSelectedCurrencyIds(getCurrenciesForVerifier(verifier.id).map(c => c.id));
  };

  const toggleCurrency = (currencyId: string) => {
    setSelectedCurrencyIds(prev =>
      prev.includes(currencyId)
        ? prev.filter(id => id !== currencyId)
        : [...prev, currencyId]
    );
  };

  const handleCreate = (data: CreateVerifierForm) => {
    createMutation.mutate(data);
  };

  const handleEdit = (data: EditVerifierForm) => {
    if (editingVerifier) {
      updateMutation.mutate({ id: editingVerifier.id, data });
    }
  };

  const currencyCheckboxes = (editingId?: string) => (
    <div className="space-y-2">
      <FormLabel>Divisas Asignadas</FormLabel>
      <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
        {currencies && currencies.length > 0 ? (
          currencies.map(c => {
            const isOtherVerifier = c.verifierId && c.verifierId !== editingId;
            const otherVerifierName = isOtherVerifier
              ? verifiers?.find(v => v.id === c.verifierId)?.name
              : null;
            return (
              <div key={c.id} className="flex items-center gap-2">
                <Checkbox
                  id={`currency-${c.id}`}
                  checked={selectedCurrencyIds.includes(c.id)}
                  onCheckedChange={() => toggleCurrency(c.id)}
                  disabled={!!isOtherVerifier}
                  data-testid={`checkbox-currency-${c.id}`}
                />
                <label htmlFor={`currency-${c.id}`} className="text-sm flex items-center gap-2 cursor-pointer">
                  <span className="font-mono font-medium">{c.code}</span>
                  <span className="text-muted-foreground">- {c.name}</span>
                  {isOtherVerifier && (
                    <span className="text-xs text-muted-foreground">(asignada a {otherVerifierName})</span>
                  )}
                </label>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground">No hay divisas creadas</p>
        )}
      </div>
      <FormDescription className="text-xs">
        Selecciona las divisas que este verificador podrá verificar
      </FormDescription>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verificadores</h1>
          <p className="text-muted-foreground">Gestiona las personas que verifican pagos por divisa</p>
        </div>

        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsOpen(false);
              createForm.reset();
              setSelectedCurrencyIds([]);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-new-verifier">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Verificador
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Nuevo Verificador
              </DialogTitle>
              <DialogDescription>
                Crea una cuenta para un nuevo verificador de pagos
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Juan Pérez" data-testid="input-verifier-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="juan@email.com" data-testid="input-verifier-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="••••••" data-testid="input-verifier-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {currencyCheckboxes()}
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsOpen(false); createForm.reset(); setSelectedCurrencyIds([]); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-verifier">
                    {createMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</>
                    ) : "Crear Verificador"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!editingVerifier}
          onOpenChange={(open) => {
            if (!open) {
              setEditingVerifier(null);
              editForm.reset();
              setSelectedCurrencyIds([]);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Editar Verificador
              </DialogTitle>
              <DialogDescription>
                Modifica los datos del verificador
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Juan Pérez" data-testid="input-edit-verifier-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="juan@email.com" data-testid="input-edit-verifier-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Contraseña</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="••••••" data-testid="input-edit-verifier-password" />
                      </FormControl>
                      <FormDescription className="text-xs">Dejar vacío para mantener la contraseña actual</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {currencyCheckboxes(editingVerifier?.id)}
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setEditingVerifier(null); editForm.reset(); setSelectedCurrencyIds([]); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-verifier">
                    {updateMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                    ) : "Actualizar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Verificadores</CardTitle>
          <CardDescription>
            {verifiers?.length ?? 0} verificadores registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : verifiers?.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ShieldCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay verificadores</h3>
              <p className="text-muted-foreground text-sm">Crea el primer verificador para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Divisas Asignadas</TableHead>
                    <TableHead>Registrado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifiers?.map((verifier) => (
                    <TableRow key={verifier.id} data-testid={`row-verifier-${verifier.id}`}>
                      <TableCell className="font-medium">{verifier.name}</TableCell>
                      <TableCell className="text-muted-foreground">{verifier.email}</TableCell>
                      <TableCell className="font-mono text-sm">{verifier.username}</TableCell>
                      <TableCell>
                        {getCurrenciesForVerifier(verifier.id).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {getCurrenciesForVerifier(verifier.id).map(c => (
                              <Badge key={c.id} variant="outline" className="text-xs">
                                {c.code}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin divisas</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" data-testid={`text-created-verifier-${verifier.id}`}>
                        {verifier.createdAt ? format(new Date(verifier.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(verifier)}
                            data-testid={`button-edit-verifier-${verifier.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(verifier.id)}
                            data-testid={`button-delete-verifier-${verifier.id}`}
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
            <AlertDialogTitle>¿Eliminar verificador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las divisas vinculadas quedarán sin verificador asignado.
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
