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
          value={`$${(stats?.totalAmount ?? 0).toLocaleString()}`}
          description="En pagos verificados"
          icon={DollarSign}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado de Pagos</CardTitle>
          <CardDescription>Distribución de pagos por estado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/40">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.pendingPayments ?? 0}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Verificados</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.verifiedPayments ?? 0}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rechazados</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.rejectedPayments ?? 0}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
