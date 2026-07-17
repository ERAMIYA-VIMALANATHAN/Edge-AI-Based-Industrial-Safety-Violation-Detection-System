import React, { createContext, useContext, useEffect, useState } from "react";
import { User, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("auth_token"));
  const [, setLocation] = useLocation();

  const { data: user, isLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false
    }
  });

  useEffect(() => {
    if (isError && token) {
      setToken(null);
      localStorage.removeItem("auth_token");
      setLocation("/login");
    }
  }, [isError, token, setLocation]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ token, user: user || null, isLoading: isLoading && !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
