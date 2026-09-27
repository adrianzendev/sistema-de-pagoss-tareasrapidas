import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Botón Pagado/Por pagar + modal de confirmación para marcar/desmarcar el pago
// de un tutor en una semana. Usado en el dashboard (matriz) y en el perfil del tutor.
export function PaidToggleButton({
  tutorId,
  tutorName,
  weekId,
  weekNumber,
  isPaid,
}: {
  tutorId: string;
  tutorName: string;
  weekId: string;
  weekNumber: number;
  isPaid: boolean;
}) {
  const [confirmAction, setConfirmAction] = useState<"pay" | "unpay" | null>(null);

  const markPaidMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/weeks/${weekId}/tutor-paid/${tutorId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] }),
  });

  const unmarkPaidMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/weeks/${weekId}/tutor-paid/${tutorId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] }),
  });

  const isMutating = markPaidMutation.isPending || unmarkPaidMutation.isPending;

  return (
    <>
      {isPaid ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1 border-success/40 text-success"
          disabled={isMutating}
          onClick={() => setConfirmAction("unpay")}
          data-testid={`btn-paid-${tutorId}-${weekNumber}`}
        >
          Pagado
          <ChevronDown className="w-3 h-3" />
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1"
          disabled={isMutating}
          onClick={() => setConfirmAction("pay")}
          data-testid={`btn-paid-${tutorId}-${weekNumber}`}
        >
          Por pagar
          <ChevronDown className="w-3 h-3" />
        </Button>
      )}

      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction === "pay" ? "Marcar semana como pagada" : "Desmarcar pago"}</DialogTitle>
            <DialogDescription>
              {confirmAction === "pay"
                ? `¿Confirmas que ya se le pagó a ${tutorName} la semana S${weekNumber}?`
                : `¿Confirmas que quieres desmarcar el pago de ${tutorName} en la semana S${weekNumber}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (confirmAction === "pay") markPaidMutation.mutate();
                else unmarkPaidMutation.mutate();
                setConfirmAction(null);
              }}
            >Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
