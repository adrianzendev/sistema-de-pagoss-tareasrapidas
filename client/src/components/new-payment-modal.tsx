import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Currency, Week, Client } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, User, Image as ImageIcon, AlertTriangle, Calendar, Phone } from "lucide-react";
import { normalizePhone } from "@shared/schema";

const paymentSchema = z.object({
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Monto debe ser mayor a 0"),
  currencyId: z.string().min(1, "Selecciona una divisa"),
  clientNumber: z.string().min(1, "Número de cliente requerido"),
});

type PaymentForm = z.infer<typeof paymentSchema>;

type BlacklistCheck = {
  blacklisted: boolean;
  reason?: string;
};

interface NewPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewPaymentModal({ open, onOpenChange }: NewPaymentModalProps) {
  const { toast } = useToast();
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [blacklistWarning, setBlacklistWarning] = useState<BlacklistCheck | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const { data: weeks } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const { data: allClients } = useQuery<Client[]>({
    queryKey: ["/api/clients/search"],
    queryFn: async () => {
      const res = await fetch("/api/clients/search?q=");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const today = new Date();
  const currentOpenWeek = weeks?.find(week => {
    if (week.status !== "open") return false;
    const startDate = new Date(week.startDate + "T00:00:00");
    const endDate = new Date(week.endDate + "T23:59:59");
    return today >= startDate && today <= endDate;
  });

  const canCreatePayment = !!currentOpenWeek;

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: "",
      currencyId: "",
      clientNumber: "",
    },
  });

  const clientNumber = form.watch("clientNumber");
  const selectedCurrencyId = form.watch("currencyId");
  const selectedCurrency = currencies?.find(c => c.id === selectedCurrencyId);

  useEffect(() => {
    if (!clientNumber || clientNumber.length < 1) {
      setFilteredClients([]);
      return;
    }
    const normalized = normalizePhone(clientNumber);
    const matches = (allClients || []).filter(c =>
      c.normalizedPhone.includes(normalized) ||
      c.phoneNumber.toLowerCase().includes(clientNumber.toLowerCase()) ||
      (c.name && c.name.toLowerCase().includes(clientNumber.toLowerCase()))
    ).slice(0, 8);
    setFilteredClients(matches);
  }, [clientNumber, allClients]);

  useEffect(() => {
    const checkBlacklist = async () => {
      if (!clientNumber || clientNumber.length < 2) {
        setBlacklistWarning(null);
        return;
      }
      try {
        const res = await fetch(`/api/blacklist/check/${encodeURIComponent(clientNumber)}`);
        if (res.ok) {
          const data: BlacklistCheck = await res.json();
          setBlacklistWarning(data.blacklisted ? data : null);
        }
      } catch {
      }
    };
    const timeout = setTimeout(checkBlacklist, 500);
    return () => clearTimeout(timeout);
  }, [clientNumber]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      queryClient.invalidateQueries({ queryKey: ["/api/clients/search"] });
      toast({ title: "Pago registrado", description: "Tu pago ha sido enviado para verificación" });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    form.reset();
    setProofImage(null);
    setBlacklistWarning(null);
    setShowSuggestions(false);
    onOpenChange(false);
  };

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

  const selectClient = (client: Client) => {
    form.setValue("clientNumber", client.phoneNumber);
    setShowSuggestions(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Pago</DialogTitle>
          <DialogDescription>
            {currentOpenWeek 
              ? `Semana S${currentOpenWeek.weekNumber} - Registra un nuevo pago`
              : "Registra un nuevo pago recibido"
            }
          </DialogDescription>
        </DialogHeader>

        {!canCreatePayment && weeks !== undefined && (
          <Alert variant="destructive" data-testid="alert-no-week">
            <Calendar className="h-4 w-4" />
            <AlertTitle>No hay semana abierta</AlertTitle>
            <AlertDescription>
              No puedes registrar pagos porque no hay una semana abierta para la fecha actual.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="clientNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp / Teléfono del Cliente</FormLabel>
                  <FormControl>
                    <div className="relative" ref={suggestionsRef}>
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="Ej: +51 935 436 864"
                        className="pl-10"
                        data-testid="input-client-number"
                        autoComplete="off"
                        onFocus={() => setShowSuggestions(true)}
                        onChange={(e) => {
                          field.onChange(e);
                          setShowSuggestions(true);
                        }}
                      />
                      {showSuggestions && filteredClients.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {filteredClients.map(client => (
                            <button
                              key={client.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                              onClick={() => selectClient(client)}
                              data-testid={`suggestion-client-${client.id}`}
                            >
                              <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="font-mono">{client.phoneNumber}</span>
                              {client.name && (
                                <span className="text-muted-foreground">- {client.name}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {blacklistWarning && (
              <Alert variant="destructive" data-testid="alert-blacklist">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cliente en Lista Negra</AlertTitle>
                <AlertDescription>
                  {blacklistWarning.reason || "Este cliente ha sido reportado como problemático."}
                </AlertDescription>
              </Alert>
            )}

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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium w-9 text-center">
                        {selectedCurrency?.code || "$"}
                      </div>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-12"
                        data-testid="input-payment-amount"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Comprobante</FormLabel>
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
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setProofImage(null)}
                    data-testid="button-remove-image"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  disabled={isUploading}
                  data-testid="button-upload-image"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-xs">Subir comprobante</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createMutation.isPending || !canCreatePayment}
                data-testid="button-submit-payment"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Registrar"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
