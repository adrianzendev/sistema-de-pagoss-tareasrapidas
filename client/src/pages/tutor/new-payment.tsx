import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Currency } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, DollarSign, User, Image as ImageIcon } from "lucide-react";

const paymentSchema = z.object({
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Monto debe ser mayor a 0"),
  currencyId: z.string().min(1, "Selecciona una divisa"),
  clientNumber: z.string().min(1, "Número de cliente requerido"),
});

type PaymentForm = z.infer<typeof paymentSchema>;

export default function NewPaymentPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: "",
      currencyId: "",
      clientNumber: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      const res = await fetch("/api/tutor/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          proofImage,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al crear pago");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/payments"] });
      toast({ title: "Pago registrado", description: "Tu pago ha sido enviado para verificación" });
      setLocation("/tutor");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "La imagen debe ser menor a 5MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo procesar la imagen", variant: "destructive" });
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo Pago</h1>
        <p className="text-muted-foreground">Registra un nuevo pago recibido</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información del Pago</CardTitle>
          <CardDescription>Completa los datos del pago para enviarlo a verificación</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-10"
                          data-testid="input-payment-amount"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currencyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Divisa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-currency">
                          <SelectValue placeholder="Selecciona una divisa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies?.map((currency) => (
                          <SelectItem key={currency.id} value={currency.id}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Cliente</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          placeholder="Ej: CLI-001"
                          className="pl-10"
                          data-testid="input-client-number"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Comprobante (opcional)</FormLabel>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-proof-image"
                />

                {proofImage ? (
                  <div className="relative">
                    <img
                      src={proofImage}
                      alt="Comprobante"
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => setProofImage(null)}
                      data-testid="button-remove-image"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    disabled={isUploading}
                    data-testid="button-upload-image"
                  >
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-sm">Subir comprobante de pago</span>
                        <span className="text-xs">PNG, JPG hasta 5MB</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLocation("/tutor")}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-payment"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Registrar Pago"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
