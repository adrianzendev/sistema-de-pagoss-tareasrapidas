import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Loader2, UserPlus, Mail, Percent, Trash2, Edit } from "lucide-react";
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

const createTutorSchema = z.object({
  name: z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(4, "Contraseña debe tener al menos 4 caracteres"),
  commissionPercent: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Comisión debe ser entre 0 y 100"),
  isActive: z.boolean().default(true),
});

const editTutorSchema = z.object({
  name: z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().optional().refine(val => !val || val.length >= 4, "Mínimo 4 caracteres"),
  commissionPercent: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Comisión debe ser entre 0 y 100"),
  isActive: z.boolean().default(true),
});

type CreateTutorForm = z.infer<typeof createTutorSchema>;
type EditTutorForm = z.infer<typeof editTutorSchema>;

export default function TutorsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTutor, setEditingTutor] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: tutors, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/tutors"],
  });

  const createForm = useForm<CreateTutorForm>({
    resolver: zodResolver(createTutorSchema),
    defaultValues: { name: "", email: "", password: "", commissionPercent: "10", isActive: true },
  });

  const editForm = useForm<EditTutorForm>({
    resolver: zodResolver(editTutorSchema),
    defaultValues: { name: "", email: "", password: "", commissionPercent: "10", isActive: true },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTutorForm) =>
      apiRequest("POST", "/api/admin/tutors", { ...data, role: "tutor" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] });
      setIsOpen(false);
      createForm.reset();
      toast({ title: "Tutor creado", description: "El tutor ha sido creado correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditTutorForm }) => {
      const body: any = {
        name: data.name,
        email: data.email,
        commissionPercent: data.commissionPercent,
        isActive: data.isActive,
      };
      if (data.password) body.password = data.password;
      await apiRequest("PATCH", `/api/admin/tutors/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] });
      setEditingTutor(null);
      editForm.reset();
      toast({ title: "Tutor actualizado", description: "Los datos han sido actualizados" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/tutors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] });
      setDeleteId(null);
      toast({ title: "Tutor eliminado", description: "El tutor ha sido eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEdit = (tutor: User) => {
    setEditingTutor(tutor);
    editForm.reset({
      name: tutor.name,
      email: tutor.email,
      password: "",
      commissionPercent: tutor.commissionPercent,
      isActive: tutor.isActive !== false,
    });
  };

  const filteredTutors = tutors?.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tutores</h1>
          <p className="text-muted-foreground">Gestiona los perfiles de tutores</p>
        </div>

        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setIsOpen(false); createForm.reset(); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsOpen(true)} data-testid="button-new-tutor">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tutor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Crear Tutor
              </DialogTitle>
              <DialogDescription>Ingresa los datos del nuevo tutor</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Juan Pérez" data-testid="input-tutor-name" />
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
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} type="email" placeholder="juan@ejemplo.com" className="pl-10" data-testid="input-tutor-email" />
                        </div>
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
                        <Input {...field} type="password" placeholder="••••••" data-testid="input-tutor-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="commissionPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comisión (%)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} type="number" step="0.01" min="0" max="100" placeholder="10" className="pl-10" data-testid="input-tutor-commission" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel className="text-sm font-medium">Colaborador activo</FormLabel>
                        <FormDescription className="text-xs">
                          Si está activo se le carga publicidad. Inactivo = sin cargo.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-tutor-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsOpen(false); createForm.reset(); }}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-tutor">
                    {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</> : "Crear Tutor"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!editingTutor}
          onOpenChange={(open) => { if (!open) { setEditingTutor(null); editForm.reset(); } }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Editar Tutor
              </DialogTitle>
              <DialogDescription>Modifica los datos del tutor</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit((data) => editingTutor && updateMutation.mutate({ id: editingTutor.id, data }))} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Juan Pérez" data-testid="input-edit-tutor-name" />
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
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} type="email" placeholder="juan@ejemplo.com" className="pl-10" data-testid="input-edit-tutor-email" />
                        </div>
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
                        <Input {...field} type="password" placeholder="••••••" data-testid="input-edit-tutor-password" />
                      </FormControl>
                      <FormDescription className="text-xs">Dejar vacío para mantener la contraseña actual</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="commissionPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comisión (%)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} type="number" step="0.01" min="0" max="100" placeholder="10" className="pl-10" data-testid="input-edit-tutor-commission" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel className="text-sm font-medium">Colaborador activo</FormLabel>
                        <FormDescription className="text-xs">
                          Si está activo se le carga publicidad. Inactivo = sin cargo.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-edit-tutor-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setEditingTutor(null); editForm.reset(); }}>Cancelar</Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-tutor">
                    {updateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : "Actualizar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <CardTitle>Lista de Tutores</CardTitle>
              <CardDescription>{tutors?.length ?? 0} tutores registrados</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tutor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-tutors"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filteredTutors?.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <UserPlus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No hay tutores</h3>
              <p className="text-muted-foreground text-sm">
                {search ? "No se encontraron tutores con ese criterio" : "Crea el primer tutor para comenzar"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                    <TableHead>Registrado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTutors?.map((tutor) => (
                    <TableRow key={tutor.id} data-testid={`row-tutor-${tutor.id}`}>
                      <TableCell className="font-medium">{tutor.name}</TableCell>
                      <TableCell>{tutor.email}</TableCell>
                      <TableCell>
                        {tutor.isActive !== false ? (
                          <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0" data-testid={`status-tutor-${tutor.id}`}>Activo</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid={`status-tutor-${tutor.id}`}>Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{tutor.commissionPercent}%</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" data-testid={`text-created-tutor-${tutor.id}`}>
                        {tutor.createdAt ? format(new Date(tutor.createdAt), "dd/MM/yyyy HH:mm", { locale: es }) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(tutor)}
                            data-testid={`button-edit-tutor-${tutor.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(tutor.id)}
                            data-testid={`button-delete-tutor-${tutor.id}`}
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
            <AlertDialogTitle>¿Eliminar tutor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El tutor y todos sus datos serán eliminados.
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
