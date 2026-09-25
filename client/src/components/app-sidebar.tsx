import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Coins,
  LogOut,
  FileText,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  Phone,
  Activity,
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
];

const verifierItems = [
  { title: "Verificar Pagos", url: "/verifier", icon: ShieldCheck },
];

type Stats = {
  pendingPayments: number;
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "admin";
  const isVerifier = user?.role === "verifier";
  const items = isAdmin ? adminItems : isVerifier ? verifierItems : tutorItems;
  // Activo = la URL más larga que coincide, así /admin/tutors/:id/detail marca "Tutores" y no "Dashboard"
  const activeUrl = items
    .map(i => i.url)
    .filter(u => location === u || location.startsWith(u + "/"))
    .sort((a, b) => b.length - a.length)[0];

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
    <>
      <Sidebar className="border-r border-sidebar-border">
        <SidebarHeader className="p-4 border-b border-sidebar-border">
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
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const isActive = item.url === activeUrl;
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
                            <Badge variant="destructive" className="h-5 min-w-5 px-2 text-xs" data-testid="badge-pending-payments">
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
          <div className="flex items-center gap-3 mb-3 rounded-md border border-sidebar-border bg-background p-2" data-testid="sidebar-user-card">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-primary text-sm">
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
          <div className="flex items-center gap-2">
            <SidebarTrigger variant="outline" data-testid="button-sidebar-toggle" className="h-10 w-10 flex-shrink-0" />
            <ThemeToggle />
            <Button
              variant="outline"
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

    </>
  );
}
