import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Kanban from "./pages/Kanban";
import Analytics from "./pages/Analytics";
import Monitoring from "./pages/Monitoring";
import Campaigns from "./pages/Campaigns";
import Reports from "./pages/Reports";
import Integrations from "./pages/Integrations";
import Settings from "./pages/Settings";
import Automations from "./pages/Automations";
import Scheduling from "./pages/Scheduling";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import { useAuth } from "./_core/hooks/useAuth";

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/kanban" component={Kanban} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/monitoring" component={Monitoring} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/reports" component={Reports} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/settings" component={Settings} />
      <Route path="/automations" component={Automations} />
      <Route path="/scheduling" component={Scheduling} />
      <Route path="/chat" component={Chat} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
