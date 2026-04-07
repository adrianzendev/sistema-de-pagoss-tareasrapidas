import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User } from "@shared/schema";
import { requestNotificationPermission, subscribeToPush, isPushSupported, unsubscribeFromPush } from "./pushNotifications";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
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

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
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
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
