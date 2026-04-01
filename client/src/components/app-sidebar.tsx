import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NewPaymentModal } from "@/components/new-payment-modal";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Coins,
  LogOut,
  PlusCircle,
  FileText,
  AlertTriangle,
  Calendar,
  Calculator,
  ShieldCheck,
  Phone,
  Lock,
} from "lucide-react";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Semanas", url: "/admin/weeks", icon: Calendar },
  { title: "Tutores", url: "/admin/tutors", icon: Users },
  { title: "Verificadores", url: "/admin/verifiers", icon: ShieldCheck },
  { title: "Pagos", url: "/admin/payments", icon: CreditCard },
  { title: "Divisas", url: "/admin/currencies", icon: Coins },
  { title: "Clientes", url: "/admin/clients", icon: Phone },
  { title: "Lista Negra", url: "/admin/blacklist", icon: AlertTriangle },
];

const tutorItems = [
  { title: "Mis Pagos", url: "/tutor", icon: FileText },
  { title: "Liquidación", url: "/tutor/settlement", icon: Calculator },
];

const verifierItems = [
  { title: "Verificar Pagos", url: "/verifier", icon: ShieldCheck },
];

type Stats = {
  pendingPayments: number;
};

type CurrentWeek = {
  id: string;
  weekNumber: number;
  status: string;
  startDate: string;
  endDate: string;
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isTutor = user?.role === "tutor";
  const isVerifier = user?.role === "verifier";
  const items = isAdmin ? adminItems : isVerifier ? verifierItems : tutorItems;

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdmin,
  });

  const { data: currentWeek } = useQuery<CurrentWeek | null>({
    queryKey: ["/api/weeks/current"],
    enabled: isTutor,
  });

  const hasOpenWeek = isTutor && !!currentWeek && currentWeek.status === "open";

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="TR Pagos" className="h-10 w-10 rounded-md object-contain" />
            <div className="flex flex-col">
              <span className="font-semibold text-sm">TR Pagos</span>
              <span className="text-xs text-muted-foreground">
                {isAdmin ? "Administrador" : isVerifier ? "Verificador" : "Tutor"}
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{isAdmin ? "Administración" : isVerifier ? "Verificación" : "Menú Principal"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const isActive = location === item.url;
                  const showBadge = item.title === "Pagos" && stats && stats.pendingPayments > 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.title}</span>
                          {showBadge && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs" data-testid="badge-pending-payments">
                              {stats.pendingPayments}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}

                {isTutor && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => {
                        if (!hasOpenWeek) {
                          toast({ title: "Semana cerrada", description: "No hay una semana abierta para registrar pagos.", variant: "destructive" });
                          return;
                        }
                        setIsNewPaymentOpen(true);
                      }}
                      data-testid="nav-nuevo-pago"
                      className={!hasOpenWeek && currentWeek !== undefined ? "opacity-60" : ""}
                    >
                      {hasOpenWeek ? <PlusCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      <span className="flex-1">Nuevo Pago</span>
                      {hasOpenWeek && currentWeek && (
                        <span className="text-[10px] text-muted-foreground font-mono">S{currentWeek.weekNumber}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {user ? getInitials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-medium text-sm truncate">{user?.name}</span>
              <span className="text-xs text-muted-foreground truncate">
                {user?.email}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </SidebarFooter>
      </Sidebar>

      <NewPaymentModal open={isNewPaymentOpen} onOpenChange={setIsNewPaymentOpen} />
    </>
  );
}
