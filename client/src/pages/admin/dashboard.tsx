import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CreditCard, DollarSign, CheckCircle, Clock, XCircle } from "lucide-react";

interface DashboardStats {
  totalTutors: number;
  totalPayments: number;
  pendingPayments: number;
  verifiedPayments: number;
  rejectedPayments: number;
  totalAmount: number;
  tutorStats: Array<{
    id: string;
    name: string;
    totalPayments: number;
    verifiedAmount: number;
  }>;
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
  });

  const StatCard = ({
    title,
    value,
    description,
    icon: Icon,
    variant = "default",
  }: {
    title: string;
    value: string | number;
    description: string;
    icon: typeof Users;
    variant?: "default" | "success" | "warning" | "destructive";
  }) => {
    const iconColors = {
      default: "text-primary",
      success: "text-green-600 dark:text-green-400",
      warning: "text-yellow-600 dark:text-yellow-400",
      destructive: "text-red-600 dark:text-red-400",
    };

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${iconColors[variant]}`} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general del sistema de gestión de tutores
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Tutores"
          value={stats?.totalTutors ?? 0}
          description="Tutores registrados"
          icon={Users}
        />
        <StatCard
          title="Total Pagos"
          value={stats?.totalPayments ?? 0}
          description="Pagos registrados"
          icon={CreditCard}
        />
        <StatCard
          title="Monto Total"
          value={`S/ ${(stats?.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          description="En pagos verificados (PEN)"
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>Ingresos por Tutor</CardTitle>
            <CardDescription>Monto total verificado por cada tutor (en Soles - PEN)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {stats?.tutorStats?.map((tutor) => (
                  <div key={tutor.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">{tutor.name}</div>
                      <div className="font-mono font-bold">
                        S/ {tutor.verifiedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ 
                          width: `${Math.min(100, (tutor.verifiedAmount / (stats.totalAmount || 1)) * 100)}%` 
                        }} 
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {tutor.totalPayments} pagos verificados
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {((tutor.verifiedAmount / (stats.totalAmount || 1)) * 100).toFixed(1)}% del total
                      </p>
                    </div>
                  </div>
                ))}
                {(!stats?.tutorStats || stats.tutorStats.length === 0) && (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-muted-foreground">No hay datos de tutores con pagos verificados</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Pagos</CardTitle>
            <CardDescription>Distribución general</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pendientes</p>
                <p className="text-lg font-bold">{stats?.pendingPayments ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Verificados</p>
                <p className="text-lg font-bold">{stats?.verifiedPayments ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Rechazados</p>
                <p className="text-lg font-bold">{stats?.rejectedPayments ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
