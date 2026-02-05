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
import {
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  LogOut,
  PlusCircle,
  FileText,
  AlertTriangle,
} from "lucide-react";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Tutores", url: "/admin/tutors", icon: Users },
  { title: "Pagos", url: "/admin/payments", icon: CreditCard },
  { title: "Divisas", url: "/admin/currencies", icon: DollarSign },
  { title: "Lista Negra", url: "/admin/blacklist", icon: AlertTriangle },
];

const tutorItems = [
  { title: "Mis Pagos", url: "/tutor", icon: FileText },
  { title: "Nuevo Pago", url: "/tutor/new-payment", icon: PlusCircle },
];

type Stats = {
  pendingPayments: number;
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "admin";
  const items = isAdmin ? adminItems : tutorItems;

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdmin,
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            TP
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">TutorPay</span>
            <span className="text-xs text-muted-foreground">
              {isAdmin ? "Administrador" : "Tutor"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>
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
  );
}
