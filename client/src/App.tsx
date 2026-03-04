import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Plus, LogOut } from "lucide-react";
import { NewPaymentModal } from "@/components/new-payment-modal";

import LoginPage from "@/pages/login";
import AdminDashboard from "@/pages/admin/dashboard";
import TutorsPage from "@/pages/admin/tutors";
import AdminPaymentsPage from "@/pages/admin/payments";
import CurrenciesPage from "@/pages/admin/currencies";
import BlacklistPage from "@/pages/admin/blacklist";
import WeeksPage from "@/pages/admin/weeks";
import VerifiersPage from "@/pages/admin/verifiers";
import ClientsPage from "@/pages/admin/clients";
import TutorPaymentsPage from "@/pages/tutor/payments";
import TutorSettlementPage from "@/pages/tutor/settlement";
import VerifierPaymentsPage from "@/pages/verifier/payments";
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
      <Route path="/admin/verifiers" component={VerifiersPage} />
      <Route path="/admin/blacklist" component={BlacklistPage} />
      <Route path="/admin/clients" component={ClientsPage} />
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
      <Route>
        <Redirect to="/tutor" />
      </Route>
    </Switch>
  );
}

function VerifierRoutes() {
  return (
    <Switch>
      <Route path="/verifier" component={VerifierPaymentsPage} />
      <Route>
        <Redirect to="/verifier" />
      </Route>
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const isTutor = user?.role === "tutor";
  const isVerifier = user?.role === "verifier";
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const getRoutes = () => {
    if (isAdmin) return <AdminRoutes />;
    if (isVerifier) return <VerifierRoutes />;
    return <TutorRoutes />;
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <main className="flex-1 overflow-auto p-4 sm:p-6 pb-16">
            {getRoutes()}
          </main>
          <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-between gap-2 px-4 py-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              {isTutor && (
                <Button
                  size="icon"
                  onClick={() => setIsNewPaymentOpen(true)}
                  data-testid="button-add-payment"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              )}
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                data-testid="button-logout-bottom"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </nav>
        </div>
      </div>
      {isTutor && <NewPaymentModal open={isNewPaymentOpen} onOpenChange={setIsNewPaymentOpen} />}
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
