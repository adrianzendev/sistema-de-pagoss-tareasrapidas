import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

import LoginPage from "@/pages/login";
import AdminDashboard from "@/pages/admin/dashboard";
import TutorsPage from "@/pages/admin/tutors";
import AdminPaymentsPage from "@/pages/admin/payments";
import CurrenciesPage from "@/pages/admin/currencies";
import BlacklistPage from "@/pages/admin/blacklist";
import WeeksPage from "@/pages/admin/weeks";
import TutorPaymentsPage from "@/pages/tutor/payments";
import NewPaymentPage from "@/pages/tutor/new-payment";
import TutorSettlementPage from "@/pages/tutor/settlement";
import NotFound from "@/pages/not-found";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="space-y-4 w-64">
        <Skeleton className="h-16 w-16 mx-auto rounded-xl" />
        <Skeleton className="h-4 w-32 mx-auto" />
        <Skeleton className="h-3 w-48 mx-auto" />
      </div>
    </div>
  );
}

function AdminRoutes() {
  return (
    <Switch>
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/weeks" component={WeeksPage} />
      <Route path="/admin/tutors" component={TutorsPage} />
      <Route path="/admin/payments" component={AdminPaymentsPage} />
      <Route path="/admin/currencies" component={CurrenciesPage} />
      <Route path="/admin/blacklist" component={BlacklistPage} />
      <Route>
        <Redirect to="/admin" />
      </Route>
    </Switch>
  );
}

function TutorRoutes() {
  return (
    <Switch>
      <Route path="/tutor" component={TutorPaymentsPage} />
      <Route path="/tutor/settlement" component={TutorSettlementPage} />
      <Route path="/tutor/new-payment" component={NewPaymentPage} />
      <Route>
        <Redirect to="/tutor" />
      </Route>
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {isAdmin ? <AdminRoutes /> : <TutorRoutes />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
