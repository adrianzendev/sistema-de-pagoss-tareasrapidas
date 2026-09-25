import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User } from "@shared/schema";
import { requestNotificationPermission, subscribeToPush, isPushSupported, unsubscribeFromPush } from "./pushNotifications";
import { queryClient } from "./queryClient";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  devLogin: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    checkAuth();

    const handleSessionExpired = () => {
      clearSession();
    };
    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, [clearSession]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setupPushNotifications();
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (username: string, password: string) => startSession("/api/auth/login", { username, password });

  // Solo desarrollo: el servidor expone /api/dev/login únicamente fuera de producción
  const devLogin = (userId: string) => startSession("/api/dev/login", { userId });

  const startSession = async (url: string, payload: object) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch {}
    if (!res.ok) {
      throw new Error(body?.message || text || "Error al iniciar sesión");
    }
    setUser(body);
    setupPushNotifications();
  };

  const setupPushNotifications = async () => {
    if (isPushSupported()) {
      const permission = await requestNotificationPermission();
      if (permission === "granted") {
        await subscribeToPush();
      }
    }
  };

  const logout = async () => {
    await unsubscribeFromPush();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    queryClient.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, devLogin, logout }}>
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
