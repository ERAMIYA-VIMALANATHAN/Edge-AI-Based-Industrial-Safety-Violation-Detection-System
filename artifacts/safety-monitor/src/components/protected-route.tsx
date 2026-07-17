import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/use-auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      setLocation("/login");
    }
  }, [token, isLoading, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-slate-100">Loading...</div>;
  }

  if (!token) {
    return null;
  }

  return <>{children}</>;
}
