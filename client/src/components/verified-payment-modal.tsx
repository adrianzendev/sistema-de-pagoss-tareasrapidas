import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Currency, Week } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, Image as ImageIcon, AlertTriangle, Calendar, Phone, CheckCircle } from "lucide-react";
import { useProofImageUpload } from "@/hooks/use-proof-image-upload";
import { useBlacklistCheck } from "@/hooks/use-blacklist-check";
import { useClientAutocomplete } from "@/hooks/use-client-autocomplete";

const paymentSchema = z.object({
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Monto debe ser mayor a 0"),
  currencyId: z.string().min(1, "Selecciona una divisa"),
  clientNumber: z.string().min(1, "Número de cliente requerido"),
  notes: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

interface VerifiedPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VerifiedPaymentModal({ open, onOpenChange }: VerifiedPaymentModalProps) {
  const { toast } = useToast();
  const { proofImage, setProofImage, isUploading, handleFileChange } = useProofImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const { data: weeks } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
  });

  const today = new Date();
  const currentOpenWeek = weeks?.find(week => {
    const startDate = new Date(week.startDate + "T00:00:00");
    const endDate = new Date(week.endDate + "T23:59:59");
    return today >= startDate && today <= endDate;
  });

  const canCreatePayment = !!currentOpenWeek;

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: "", currencyId: "", clientNumber: "", notes: "" },
  });

  const clientNumber = form.watch("clientNumber");
  const selectedCurrencyId = form.watch("currencyId");
  const selectedCurrency = currencies?.find(c => c.id === selectedCurrencyId);

  const blacklistWarning = useBlacklistCheck(clientNumber);
  const { filteredClients, showSuggestions, setShowSuggestions, suggestionsRef, selectClient } =
    useClientAutocomplete(clientNumber, (phoneNumber) => form.setValue("clientNumber", phoneNumber));

  const createMutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      const res = await fetch("/api/tutor/payments/verified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: data.amount,
          currencyId: data.currencyId,
          clientNumber: data.clientNumber,
          notes: data.notes || undefined,
          proofImage: proofImage || undefined,
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
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/settlement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/search"] });
      toast({ title: "Cobro registrado", description: "El pago ha sido registrado directamente como cobrado" });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    form.reset();
    setProofImage(null);
    setShowSuggestions(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Agregar Pago Verificado
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <Badge className="text-success border-success/40 text-xs">Ya cobrado</Badge>
            {currentOpenWeek
              ? `Semana S${currentOpenWeek.weekNumber} — se registrará como autoverificado`
              : "Se registrará directamente como autoverificado"
            }
          </DialogDescription>
        </DialogHeader>

        {!canCreatePayment && weeks !== undefined && (
          <Alert variant="destructive" data-testid="alert-no-week-verified">
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
                  <FormLabel>WhatsApp / Teléfono o Usuario del Cliente</FormLabel>
                  <FormControl>
                    <div className="relative" ref={suggestionsRef}>
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="Ej: +51 935 436 864 o usuario.whatsapp"
                        className="pl-10"
                        data-testid="input-verified-client-number"
                        autoComplete="off"
                        onFocus={() => setShowSuggestions(true)}
                        onChange={(e) => {
                          field.onChange(e);
                          setShowSuggestions(true);
                        }}
                      />
                      {showSuggestions && filteredClients.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md max-h-48 overflow-y-auto">
                          {filteredClients.map(client => (
                            <button
                              key={client.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                              onClick={() => selectClient(client)}
                              data-testid={`suggestion-verified-client-${client.id}`}
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
              <Alert variant="destructive" data-testid="alert-blacklist-verified">
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
                      <SelectTrigger data-testid="select-verified-currency">
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
                  <FormLabel>Monto cobrado</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium w-10 text-center">
                        {selectedCurrency?.code || "$"}
                      </div>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-12"
                        data-testid="input-verified-payment-amount"
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="text-xs">
                    Monto que ya cobraste directamente en tu cuenta.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Ej: Cobrado en CAD, transferencia USDT, etc."
                      className="resize-none h-16 text-sm"
                      data-testid="input-verified-notes"
                    />
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
                data-testid="input-verified-proof-image"
              />
              {proofImage ? (
                <div className="relative">
                  <img src={proofImage} alt="Comprobante" className="w-full h-32 object-contain rounded-lg border" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setProofImage(null)}
                    data-testid="button-verified-remove-image"
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
                  data-testid="button-verified-upload-image"
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
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 border border-success bg-background text-success hover:bg-accent"
                disabled={createMutation.isPending || !canCreatePayment}
                data-testid="button-submit-verified-payment"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Registrar Cobrado
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
