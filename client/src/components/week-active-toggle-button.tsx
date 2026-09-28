import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Botón Activo/Inactivo + modal de confirmación para marcar/desmarcar a un tutor
// como inactivo SOLO para una semana puntual (distinto del estado global del tutor).
export function WeekActiveToggleButton({
  tutorId,
  tutorName,
  weekId,
  weekNumber,
  username,
  isActive,
}: {
  tutorId: string;
  tutorName: string;
  weekId: string;
  weekNumber: number;
  username: string;
  isActive: boolean;
}) {
  const [confirmAction, setConfirmAction] = useState<"activate" | "deactivate" | null>(null);

  const toggleMutation = useMutation({
    mutationFn: (active: boolean) =>
      apiRequest("PATCH", `/api/admin/tutors/${tutorId}/week-active/${weekId}/toggle`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settlements/matrix"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tutors/${username}/settlement`] });
    },
  });

  return (
    <>
      {isActive ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1"
          disabled={toggleMutation.isPending}
          onClick={() => setConfirmAction("deactivate")}
          data-testid={`btn-week-active-${tutorId}-${weekNumber}`}
        >
          Activo
          <ChevronDown className="w-3 h-3" />
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1 border-warning/40 text-warning"
          disabled={toggleMutation.isPending}
          onClick={() => setConfirmAction("activate")}
          data-testid={`btn-week-active-${tutorId}-${weekNumber}`}
        >
          Inactivo
          <ChevronDown className="w-3 h-3" />
        </Button>
      )}

      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction === "deactivate" ? "Marcar inactivo esta semana" : "Marcar activo esta semana"}</DialogTitle>
            <DialogDescription>
              {confirmAction === "deactivate"
                ? `¿Confirmas que ${tutorName} estuvo inactivo la semana S${weekNumber}? No se le cobrará ni recibirá su parte de publicidad compartida esa semana.`
                : `¿Confirmas que ${tutorName} vuelve a estar activo la semana S${weekNumber}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                toggleMutation.mutate(confirmAction === "activate");
                setConfirmAction(null);
              }}
            >Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
