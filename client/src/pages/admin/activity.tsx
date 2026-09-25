import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Percent, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ActivityLogEntry = {
  id: string;
  type: string;
  description: string;
  tutorId: string | null;
  performedBy: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  tutor?: { id: string; name: string; email: string };
  performer?: { id: string; name: string; email: string };
};

export default function ActivityPage() {
  const { data: log, isLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/admin/activity-log"],
  });

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: es });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  const entries = log ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          <Activity className="h-5 w-5" />
          Registro de Actividad
        </h1>
        <p className="text-muted-foreground">Historial de cambios de comisión de tutores</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Cambios de Comisión
          </CardTitle>
          <CardDescription>
            {entries.length} {entries.length === 1 ? "registro" : "registros"} en total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p>No hay registros de actividad aún</p>
              <p className="text-sm">Los cambios de comisión aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  data-testid={`row-activity-${entry.id}`}
                >
                  <div className="p-2 rounded-full shrink-0 border border-primary/30">
                    <Percent className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" data-testid={`text-tutor-name-${entry.id}`}>
                        {entry.tutor?.name ?? "Tutor eliminado"}
                      </span>
                      <Badge variant="outline" className="text-xs">cambio de comisión</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <span className="font-mono px-2 py-1 rounded-sm text-destructive font-bold border border-border">
                        {entry.oldValue}%
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono px-2 py-1 rounded-sm text-success font-bold border border-border">
                        {entry.newValue}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Aplicado por <span className="font-medium text-foreground">{entry.performer?.name ?? "Administrador"}</span>
                      {" · "}
                      <span data-testid={`text-date-${entry.id}`}>{formatDate(entry.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
