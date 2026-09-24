import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, User } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

type LoginForm = z.infer<typeof loginSchema>;

type DevUser = { id: string; username: string; name: string; role: string };

const ROLE_LABEL: Record<string, string> = { admin: "Admin", tutor: "Tutor", verifier: "Verificador" };

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  const { data: devUsers } = useQuery<DevUser[]>({
    queryKey: ["/api/dev/users"],
    retry: false,
    staleTime: Infinity,
  });

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.username, data.password);
      toast({
        title: "Bienvenido",
        description: "Has iniciado sesión correctamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Credenciales inválidas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.png" alt="TR Pagos" className="h-16 w-16 rounded-xl object-contain mb-4" />
          <h1 className="text-2xl font-bold">TR Pagos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sistema de Gestión de Tutores y Pagos
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario o Correo</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            placeholder="Usuario o correo electrónico"
                            className="pl-10"
                            data-testid="input-username"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="Ingresa tu contraseña"
                            className="pl-10"
                            data-testid="input-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    "Iniciar Sesión"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Contacta al administrador si no tienes credenciales
        </p>

        {devUsers && devUsers.length > 0 && (
          <Card className="mt-4 border-dashed border-warning/50">
            <CardHeader className="py-3">
              <CardTitle className="text-sm text-warning">
                Accesos Rápidos (Solo Desarrollo)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 flex flex-wrap gap-2">
              {devUsers.map(u => (
                <Button
                  key={u.id}
                  variant="outline"
                  size="sm"
                  disabled={quickLoading === u.id}
                  onClick={async () => {
                    setQuickLoading(u.id);
                    try {
                      await login(u.username, "123456");
                    } catch {
                      toast({ title: "Error", description: "No se pudo iniciar sesión", variant: "destructive" });
                    } finally {
                      setQuickLoading(null);
                    }
                  }}
                  data-testid={`button-quick-${u.username}`}
                >
                  {quickLoading === u.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  <span className="font-medium">{u.name}</span>
                  <span className="ml-1 text-xs text-muted-foreground">({ROLE_LABEL[u.role] ?? u.role})</span>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
