import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Lock, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewPaymentModal } from "@/components/new-payment-modal";
import { VerifiedPaymentModal } from "@/components/verified-payment-modal";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type CurrentWeek = { id: string; weekNumber: number; status: string };

// Acciones del tutor para registrar pagos en la semana vigente (sidebar y vista de pagos usan la misma).
// `disabled`: la pantalla mira otra semana (pasada); los pagos solo entran en la semana actual.
export function PaymentActions({ className, disabled = false }: { className?: string; disabled?: boolean }) {
  const { user } = useAuth();
  const [modal, setModal] = useState<"new" | "verified" | null>(null);
  const { data: week } = useQuery<CurrentWeek | null>({
    queryKey: ["/api/weeks/current"],
    enabled: user?.role === "tutor",
  });

  const isOpen = week?.status === "open" && !disabled;
  // Deshabilitado = gris neutro (secondary), no el azul primario atenuado
  const blockedClass = "text-muted-foreground";

  return (
    <>
      <div className={cn("flex flex-col gap-2", className)}>
        <Button
          onClick={() => setModal("new")}
          disabled={!isOpen}
          variant={isOpen ? "default" : "secondary"}
          title={isOpen ? undefined : disabled ? "Solo puedes enviar comprobantes en la semana actual" : "No hay una semana abierta para registrar pagos"}
          className={cn("whitespace-normal text-left", !isOpen && blockedClass)}
          data-testid="button-new-payment"
        >
          {isOpen ? <PlusCircle /> : <Lock />}
          Enviar comprobante
        </Button>
        {user?.autoVerificaPagos && (
          <Button
            variant="secondary"
            onClick={() => setModal("verified")}
            disabled={!isOpen}
            className={cn("whitespace-normal text-left", isOpen ? "border-success/40 text-success" : blockedClass)}
            data-testid="button-verified-payment"
          >
            {isOpen ? <CheckCircle /> : <Lock />}
            Agregar pago verificado
            </Button>
        )}
      </div>
      <NewPaymentModal open={modal === "new"} onOpenChange={o => setModal(o ? "new" : null)} />
      <VerifiedPaymentModal open={modal === "verified"} onOpenChange={o => setModal(o ? "verified" : null)} />
    </>
  );
}
