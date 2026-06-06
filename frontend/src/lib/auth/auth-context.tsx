import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginUser, registerUser, getCurrentUser } from "@/lib/api/backend";

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
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (
    name: string,
    email: string,
    password: string,
    organization: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "qs_token";
const USER_KEY = "qs_user";

/** Safe localStorage access — returns null during SSR */
function getStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe localStorage write — no-op during SSR */
function setStorageItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked
  }
}

/** Safe localStorage remove — no-op during SSR */
function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Restore session on mount (client-only)
  useEffect(() => {
    const restore = async () => {
      try {
        const token = getStorageItem(TOKEN_KEY);
        if (!token) return;

        // First, try to use cached user for instant UI (don't block on network)
        const cached = getStorageItem(USER_KEY);
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch {
            // Corrupted cache, will try backend below
          }
        }

        // Then validate token with backend in background
        try {
          const backendUser = await getCurrentUser(token);
          const restoredUser: User = {
            id: backendUser.id,
            name: backendUser.name,
            email: backendUser.email,
            role: backendUser.role as UserRole,
            organization: backendUser.organization,
            initials: backendUser.initials,
          };
          setUser(restoredUser);
          setStorageItem(USER_KEY, JSON.stringify(restoredUser));
        } catch {
          // Backend validation failed — if we already have a cached user, keep it.
          // Only clear everything if there's NO cached user at all.
          if (!cached) {
            console.warn("[Auth] Token invalid and no cached user — logging out");
            removeStorageItem(TOKEN_KEY);
            removeStorageItem(USER_KEY);
            setUser(null);
          }
          // If cached user exists, keep using it. Token stays in localStorage.
          // The next API call will reveal if the token is truly expired.
        }
      } catch (e) {
        console.error("Failed to restore auth session", e);
      } finally {
        setHydrated(true);
      }
    };

    restore();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const data = await loginUser(email, password);
        const loggedInUser: User = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role as UserRole,
          organization: data.user.organization,
          initials: data.user.initials,
        };
        // Double-ensure token is stored (loginUser already stores it, but be safe)
        setStorageItem(TOKEN_KEY, data.access_token);
        setStorageItem(USER_KEY, JSON.stringify(loggedInUser));
        setUser(loggedInUser);
        console.log("[Auth] signIn success, token stored:", !!data.access_token);
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Login failed";
        console.error("[Auth] signIn failed:", message);
        return { ok: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signUp = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      organization: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const data = await registerUser(name, email, password, organization);
        const registeredUser: User = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role as UserRole,
          organization: data.user.organization,
          initials: data.user.initials,
        };
        // Double-ensure token is stored
        setStorageItem(TOKEN_KEY, data.access_token);
        setStorageItem(USER_KEY, JSON.stringify(registeredUser));
        setUser(registeredUser);
        console.log("[Auth] signUp success, token stored:", !!data.access_token);
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Registration failed";
        console.error("[Auth] signUp failed:", message);
        return { ok: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    setUser(null);
    removeStorageItem(TOKEN_KEY);
    removeStorageItem(USER_KEY);
    console.log("[Auth] signed out, tokens cleared");
  }, []);

  return (
    <AuthContext.Provider value={{ user, hydrated, isLoading, signIn, signUp, signOut }}>
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
