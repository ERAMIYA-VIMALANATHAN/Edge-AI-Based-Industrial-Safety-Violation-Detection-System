import React from "react";
import { Link, useLocation } from "wouter";
import { 
  Activity, 
  AlertTriangle, 
  Camera, 
  LayoutDashboard, 
  Map, 
  Settings, 
  ShieldAlert, 
  Users, 
  LogOut,
  Menu
} from "lucide-react";
import { useAuth } from "../hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const logoutMutation = useLogout();
  const [collapsed, setCollapsed] = React.useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/workers", label: "Workers", icon: Users },
    { href: "/cameras", label: "Cameras", icon: Camera },
    { href: "/zones", label: "Safety Zones", icon: Map },
    { href: "/alerts", label: "Alerts", icon: AlertTriangle },
    { href: "/warning-logs", label: "Warning Logs", icon: ShieldAlert },
    { href: "/reports", label: "Reports", icon: Activity },
    { href: "/sensors", label: "Sensors", icon: Activity },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
      }
    });
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <div 
        className={`flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800 shrink-0">
          {!collapsed && (
            <span className="font-bold text-sm tracking-wide text-amber-500 uppercase truncate">
              MetalWorks OS
            </span>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)} 
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors mx-auto"
          >
            <Menu size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2 custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div 
                  className={`flex items-center px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    isActive 
                      ? "bg-amber-500/10 text-amber-500" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={18} className="shrink-0" />
                  {!collapsed && <span className="ml-3 text-sm font-medium truncate">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="flex flex-col items-center justify-center">
             {!collapsed && (
               <div className="w-full mb-3 px-2">
                 <div className="text-xs font-semibold text-slate-200 truncate">{user?.name || user?.username}</div>
                 <div className="text-[10px] text-slate-500 uppercase tracking-wider">{user?.role}</div>
               </div>
             )}
             <button 
                onClick={handleLogout}
                className={`flex items-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-md w-full transition-colors ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? "Logout" : undefined}
              >
                <LogOut size={18} />
                {!collapsed && <span className="ml-2 text-sm font-medium">System Logout</span>}
             </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#0A0F1C] relative custom-scrollbar">
        {/* Subtle grid pattern overlay for industrial feel */}
        <div className="absolute inset-0 pointer-events-none opacity-5" 
          style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        ></div>
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
