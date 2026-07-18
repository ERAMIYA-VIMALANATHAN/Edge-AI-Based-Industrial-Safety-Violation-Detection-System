import React, { useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  LayoutDashboard,
  Map,
  Settings,
  ShieldAlert,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";
import { useNotifications } from "../context/notification-context";
import { format } from "date-fns";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const logoutMutation = useLogout();
  const [collapsed, setCollapsed] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, markAllRead, dismiss, clearAll } = useNotifications();

  // Close panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navItems = [
    { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
    { href: "/workers",      label: "Workers",       icon: Users },
    { href: "/cameras",      label: "Cameras",       icon: Camera },
    { href: "/zones",        label: "Safety Zones",  icon: Map },
    { href: "/alerts",       label: "Alerts",        icon: AlertTriangle },
    { href: "/warning-logs", label: "Warning Logs",  icon: ShieldAlert },
    { href: "/reports",      label: "Reports",       icon: Activity },
    { href: "/sensors",      label: "Sensors",       icon: Activity },
    { href: "/settings",     label: "Settings",      icon: Settings },
  ];

  const handleLogout = () => {
    logoutMutation.mutate(undefined, { onSuccess: () => logout() });
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className={`flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800 shrink-0">
          {!collapsed && (
            <span className="font-bold text-xs tracking-wide text-amber-500 uppercase truncate leading-tight">
              Industry Safety<br />
              <span className="text-slate-400">Violation Detection</span>
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
          {navItems.map(item => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    isActive ? "bg-amber-500/10 text-amber-500" : "text-slate-400 hover:bg-slate-800 hover:text-white"
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center justify-end px-4 shrink-0 relative">
          <div ref={notifRef} className="relative">
            <button
              data-testid="button-notifications"
              onClick={() => { setNotifOpen(v => !v); if (!notifOpen) markAllRead(); }}
              className="relative text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition-colors"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification panel */}
            {notifOpen && (
              <div className="absolute right-0 top-9 w-96 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Violation Alerts
                  </span>
                  <div className="flex items-center gap-3">
                    {notifications.length > 0 && (
                      <button onClick={clearAll} className="text-[10px] text-slate-500 hover:text-red-400 uppercase tracking-wider transition-colors">
                        Clear All
                      </button>
                    )}
                    <button onClick={() => setNotifOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 font-mono uppercase tracking-wider">
                      No alerts — system nominal
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        data-testid={`notification-${n.id}`}
                        className={`relative px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors group ${!n.read ? "bg-red-500/5" : ""}`}
                      >
                        {!n.read && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500"></div>}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] text-red-400 font-bold uppercase font-mono">PPE VIOLATION</span>
                              <span className="text-[9px] text-slate-500 font-mono">{format(new Date(n.timestamp), "HH:mm:ss")}</span>
                            </div>
                            <p className="text-xs text-white font-semibold truncate">{n.workerName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{n.cameraName} · {n.rfidId}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {n.missingPPE.map(ppe => (
                                <span key={ppe} className="text-[9px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 font-mono uppercase">
                                  No {ppe}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => dismiss(n.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300 transition-all shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#0A0F1C] relative custom-scrollbar">
          <div
            className="absolute inset-0 pointer-events-none opacity-5"
            style={{
              backgroundImage: "linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
