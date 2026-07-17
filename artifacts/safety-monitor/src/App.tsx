import React from "react";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./components/protected-route";
import { Layout } from "./components/layout";

// Pages
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Workers from "./pages/workers";
import Cameras from "./pages/cameras";
import Zones from "./pages/zones";
import Alerts from "./pages/alerts";
import WarningLogs from "./pages/warning-logs";
import Reports from "./pages/reports";
import Sensors from "./pages/sensors";
import Settings from "./pages/settings";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <ProtectedRoute>
      <Layout>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/workers" component={Workers} />
          <Route path="/cameras" component={Cameras} />
          <Route path="/zones" component={Zones} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/warning-logs" component={WarningLogs} />
          <Route path="/reports" component={Reports} />
          <Route path="/sensors" component={Sensors} />
          <Route path="/settings" component={Settings} />
          
          {/* Catch-all for protected routes */}
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </ProtectedRoute>
  );
}

function App() {
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Switch>
              <Route path="/" component={() => <Login />} />
              <Route path="/login" component={Login} />
              
              {/* All other routes are protected and wrapped in Layout */}
              <Route path="/:rest*" component={ProtectedRoutes} />
            </Switch>
          </AuthProvider>
        </WouterRouter>
        <Toaster theme="dark" position="top-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
