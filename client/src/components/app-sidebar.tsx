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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NewPaymentModal } from "@/components/new-payment-modal";
import { VerifiedPaymentModal } from "@/components/verified-payment-modal";
import { ThemeToggle } from "@/components/theme-toggle";
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
  Activity,
  CheckCircle,
} from "lucide-react";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Pagos", url: "/admin/payments", icon: CreditCard },
  { title: "Semanas", url: "/admin/weeks", icon: Calendar },
  { title: "Tutores", url: "/admin/tutors", icon: Users },
  { title: "Verificadores", url: "/admin/verifiers", icon: ShieldCheck },
  { title: "Divisas", url: "/admin/currencies", icon: Coins },
  { title: "Clientes", url: "/admin/clients", icon: Phone },
  { title: "Lista Negra", url: "/admin/blacklist", icon: AlertTriangle },
  { title: "Actividad", url: "/admin/activity", icon: Activity },
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
  const [isVerifiedPaymentOpen, setIsVerifiedPaymentOpen] = useState(false);

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
        <SidebarHeader className="p-4 pb-3">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="TR Pagos" className="h-10 w-10 rounded-md object-contain" />
            <div className="flex flex-col">
              <span className="font-semibold text-sm">TR Pagos</span>
              <span className="text-xs text-muted-foreground">
                {isAdmin ? "Administrador" : isVerifier ? "Verificador" : "Tutor"}
              </span>
            </div>
          </div>
          {isTutor && (
            <div className="mt-3 flex flex-col gap-1.5">
              <button
                onClick={() => {
                  if (!hasOpenWeek) {
                    toast({ title: "Semana cerrada", description: "No hay una semana abierta para registrar pagos.", variant: "destructive" });
                    return;
                  }
                  setIsNewPaymentOpen(true);
                }}
                data-testid="nav-nuevo-pago-top"
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${hasOpenWeek
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground opacity-60 cursor-default"
                  }`}
              >
                {hasOpenWeek ? <PlusCircle className="h-4 w-4 shrink-0" /> : <Lock className="h-4 w-4 shrink-0" />}
                <span className="flex-1 text-left">Nuevo Pago</span>
                {hasOpenWeek && currentWeek && (
                  <span className="text-[10px] font-mono opacity-80">S{currentWeek.weekNumber}</span>
                )}
              </button>

              {(user as any)?.autoVerificaPagos && (
                <button
                  onClick={() => {
                    if (!hasOpenWeek) {
                      toast({ title: "Semana cerrada", description: "No hay una semana abierta para registrar pagos.", variant: "destructive" });
                      return;
                    }
                    setIsVerifiedPaymentOpen(true);
                  }}
                  data-testid="nav-pago-verificado-top"
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${hasOpenWeek
                      ? "bg-success/15 text-success hover:bg-success/25"
                      : "bg-muted text-muted-foreground opacity-60 cursor-default"
                    }`}
                >
                  {hasOpenWeek ? <CheckCircle className="h-4 w-4 shrink-0" /> : <Lock className="h-4 w-4 shrink-0" />}
                  <span className="flex-1 text-left">Pago Cobrado</span>
                  {hasOpenWeek && currentWeek && (
                    <span className="text-[10px] font-mono opacity-80">S{currentWeek.weekNumber}</span>
                  )}
                </button>
              )}
            </div>
          )}
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
          <div className="flex items-center gap-2 mb-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="h-9 w-9 flex-shrink-0" />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="flex-shrink-0"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <NewPaymentModal open={isNewPaymentOpen} onOpenChange={setIsNewPaymentOpen} />
      <VerifiedPaymentModal open={isVerifiedPaymentOpen} onOpenChange={setIsVerifiedPaymentOpen} />
    </>
  );
}
