import React, { createContext, useContext, useState, useEffect } from "react";
import { loginUser, registerUser } from "@/lib/api/backend";

export type UserRole = "admin" | "org_manager" | "engineer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  initials: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  org_manager: "Organization Manager",
  engineer: "Quantum Engineer",
};

export type Role = UserRole;

export function canAccess(role: UserRole, resource: string): boolean {
  if (role === "admin") return true;
  if (resource === "admin") return false;
  if (resource === "team" || resource === "billing") {
    return role === "org_manager";
  }
  return true;
}

interface AuthContextType {
  user: User | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signInAs: (role: UserRole) => void;
  signUp: (name: string, email: string, password: string, org: string, role?: UserRole) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "silicofeller.auth.user";

function _makeInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Rehydrate from localStorage on mount — but validate the stored JWT is still present
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const token = localStorage.getItem("qs_token");
      if (stored && token) {
        // Both user profile and JWT present — restore session
        setUser(JSON.parse(stored));
      } else {
        // No valid session — clear stale profile if JWT is gone
        if (stored && !token) {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    } catch {
      // Corrupted storage — clear everything
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem("qs_token");
    } finally {
      setHydrated(true);
    }
  }, []);

  // ── signIn: calls the real backend /api/auth/token ──────────────────────
  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!email || !email.includes("@")) {
      return { ok: false, error: "Invalid email" };
    }
    if (!password) {
      return { ok: false, error: "Password is required" };
    }

    try {
      const data = await loginUser(email, password);
      // loginUser stores qs_token in localStorage automatically
      const serverUser = (data as { user?: Record<string, string> }).user;
      if (serverUser) {
        const newUser: User = {
          id: serverUser.id ?? `u_${Date.now()}`,
          name: serverUser.name ?? email.split("@")[0],
          email: serverUser.email ?? email,
          role: (serverUser.role as UserRole) ?? "engineer",
          organization: serverUser.organization ?? "Independent",
          initials: serverUser.initials ?? _makeInitials(serverUser.name ?? email),
        };
        setUser(newUser);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
        return { ok: true };
      }
      return { ok: false, error: "Invalid server response" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      // Surface friendly messages for common HTTP errors
      if (msg.includes("401")) return { ok: false, error: "Incorrect email or password" };
      if (msg.includes("422")) return { ok: false, error: "Invalid credentials format" };
      return { ok: false, error: msg };
    }
  };

  // Quick demo login (bypasses real auth — development convenience only)
  const signInAs = (role: UserRole) => {
    if (!import.meta.env.DEV) {
      throw new Error("Demo login is only available in development mode");
    }
    const newUser: User = {
      id: `u_${role}`,
      name: `${role} User`,
      email: `${role}@demo.local`,
      role,
      organization: "Demo Organization",
      initials: _makeInitials(`${role} User`),
    };
    setUser(newUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
  };

  // ── signUp: calls the real backend /api/auth/register ───────────────────
  const signUp = async (
    name: string,
    email: string,
    password: string,
    org: string,
    role: UserRole = "engineer",
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const data = await registerUser(name, email, password, org);
      // registerUser stores qs_token in localStorage automatically
      const serverUser = (data as { user?: Record<string, string> }).user;
      if (serverUser) {
        const newUser: User = {
          id: serverUser.id ?? `u_${Date.now()}`,
          name: serverUser.name ?? name,
          email: serverUser.email ?? email,
          role: (serverUser.role as UserRole) ?? role,
          organization: serverUser.organization ?? (org || "Independent"),
          initials: serverUser.initials ?? _makeInitials(name),
        };
        setUser(newUser);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
        return { ok: true };
      }
      return { ok: false, error: "Invalid server response" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      if (msg.includes("400")) return { ok: false, error: "Email already registered" };
      return { ok: false, error: msg };
    }
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem("qs_token");
  };

  return (
    <AuthContext.Provider value={{ user, hydrated, signIn, signInAs, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
