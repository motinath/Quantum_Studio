import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  loginUser,
  registerUser,
  getCurrentUser,
  loginWithGoogle,
  initiateGithubLogin,
  verifyOTP,
} from "@/lib/api/backend";
import { toast } from "sonner";

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

export const DEMO_ACCOUNTS = [
  {
    role: "admin" as UserRole,
    name: "Admin User",
    email: "admin@silicofeller.com",
    organization: "Silicofeller Labs",
  },
  {
    role: "org_manager" as UserRole,
    name: "Organization Manager",
    email: "manager@quantumlabs.com",
    organization: "Quantum Labs",
  },
  {
    role: "engineer" as UserRole,
    name: "Quantum Engineer",
    email: "engineer@quantumlabs.com",
    organization: "Quantum Labs",
  },
];

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
  signInAs: (role: UserRole) => void;
  signUp: (
    name: string,
    email: string,
    password: string,
    organization: string,
    role?: UserRole,
  ) => Promise<{ ok: boolean; error?: string }>;
  confirmVerification: (email: string, otp: string) => Promise<{ ok: boolean; error?: string }>;
  signInWithGoogle: (idToken: string) => Promise<{ ok: boolean; error?: string }>;
  signInWithGitHub: () => void;
  completeGithubLogin: (token: string, user: User) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "qs_token";
const USER_KEY = "silicofeller.auth.user";

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
        } catch (err) {
          // If the backend returned 401 Unauthorized, the token is definitely invalid or expired.
          // In that case, we MUST clear the token and log out, even if there is a cached user.
          const message = err instanceof Error ? err.message : "";
          if (message.includes("401") || message.includes("Unauthorized")) {
            console.warn("[Auth] Token invalid or expired — logging out");
            removeStorageItem(TOKEN_KEY);
            removeStorageItem(USER_KEY);
            removeStorageItem("qs.active_project_id");
            removeStorageItem("silicofeller.designer.conversations.v2");
            setUser(null);
            window.location.href = "/session-timeout";
          } else {
            // Network failure or other error: keep the cached user so they can work offline.
            // Only clear everything if there's NO cached user at all.
            if (!cached) {
              console.warn("[Auth] Token validation failed and no cached user — logging out");
              removeStorageItem(TOKEN_KEY);
              removeStorageItem(USER_KEY);
              removeStorageItem("qs.active_project_id");
              removeStorageItem("silicofeller.designer.conversations.v2");
              setUser(null);
            }
          }
        }
      } catch (e) {
        console.error("Failed to restore auth session", e);
      } finally {
        setHydrated(true);
      }
    };

    restore();
  }, []);

  // Offline fallback: match demo accounts by email (no password check — dev only)
  const _signInOffline = useCallback((email: string): { ok: boolean; error?: string } => {
    const demo = DEMO_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase(),
    );
    if (!demo) {
      return { ok: false, error: "Backend offline and no matching demo account" };
    }
    const newUser: User = {
      id: `u_${demo.role}`,
      name: demo.name,
      email: demo.email,
      role: demo.role,
      organization: demo.organization,
      initials: _makeInitials(demo.name),
    };
    setUser(newUser);
    setStorageItem(USER_KEY, JSON.stringify(newUser));
    return { ok: true };
  }, []);

  // Quick demo login (bypasses real auth — development convenience only)
  const signInAs = useCallback((role: UserRole) => {
    const demo = DEMO_ACCOUNTS.find((a) => a.role === role) ?? DEMO_ACCOUNTS[0];
    const newUser: User = {
      id: `u_${demo.role}`,
      name: demo.name,
      email: demo.email,
      role: demo.role,
      organization: demo.organization,
      initials: _makeInitials(demo.name),
    };
    setUser(newUser);
    setStorageItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      if (!email || !email.includes("@")) {
        return { ok: false, error: "Invalid email" };
      }
      if (!password) {
        return { ok: false, error: "Password is required" };
      }

      setIsLoading(true);
      try {
        const data = await loginUser(email, password);
        const serverUser = data.user;
        if (serverUser) {
          const loggedInUser: User = {
            id: serverUser.id,
            name: serverUser.name,
            email: serverUser.email,
            role: serverUser.role as UserRole,
            organization: serverUser.organization,
            initials: serverUser.initials,
          };
          removeStorageItem("qs.active_project_id");
          removeStorageItem("silicofeller.designer.conversations.v2");
          setStorageItem(TOKEN_KEY, data.access_token);
          setStorageItem(USER_KEY, JSON.stringify(loggedInUser));
          setUser(loggedInUser);
          console.log("[Auth] signIn success, token stored:", !!data.access_token);
          return { ok: true };
        }
        return { ok: false, error: "Invalid server response" };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Login failed";
        // Surface friendly messages for common HTTP errors
        if (msg.includes("401")) return { ok: false, error: "Incorrect email or password" };
        if (msg.includes("422")) return { ok: false, error: "Invalid credentials format" };
        if (msg.includes("verify your email address")) {
          return { ok: false, error: "Please verify your email address." };
        }
        // Backend offline — fall back to demo account matching
        return _signInOffline(email);
      } finally {
        setIsLoading(false);
      }
    },
    [_signInOffline],
  );

  const signUp = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      organization: string,
      role: UserRole = "engineer",
    ): Promise<{ ok: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        await registerUser(name, email, password, organization);
        console.log("[Auth] signUp register success, email OTP sent");
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

  const confirmVerification = useCallback(
    async (email: string, otp: string): Promise<{ ok: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const data = await verifyOTP(email, otp);
        const registeredUser: User = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role as UserRole,
          organization: data.user.organization,
          initials: data.user.initials,
        };
        removeStorageItem("qs.active_project_id");
        removeStorageItem("silicofeller.designer.conversations.v2");
        setStorageItem(TOKEN_KEY, data.access_token);
        setStorageItem(USER_KEY, JSON.stringify(registeredUser));
        setUser(registeredUser);
        console.log("[Auth] verification success, token stored:", !!data.access_token);
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
        console.error("[Auth] verification failed:", message);
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
    removeStorageItem("qs.active_project_id");
    removeStorageItem("silicofeller.designer.conversations.v2");
    console.log("[Auth] signed out, tokens and user states cleared");
  }, []);

  const signInWithGoogle = useCallback(
    async (idToken: string): Promise<{ ok: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const data = await loginWithGoogle(idToken);
        const loggedInUser: User = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role as UserRole,
          organization: data.user.organization,
          initials: data.user.initials,
        };
        removeStorageItem("qs.active_project_id");
        removeStorageItem("silicofeller.designer.conversations.v2");
        setStorageItem(TOKEN_KEY, data.access_token);
        setStorageItem(USER_KEY, JSON.stringify(loggedInUser));
        setUser(loggedInUser);
        console.log("[Auth] Google signIn success, token stored:", !!data.access_token);
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Google login failed";
        console.error("[Auth] Google signIn failed:", message);
        return { ok: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signInWithGitHub = useCallback(() => {
    initiateGithubLogin();
  }, []);

  const completeGithubLogin = useCallback((token: string, loggedInUser: User) => {
    removeStorageItem("qs.active_project_id");
    removeStorageItem("silicofeller.designer.conversations.v2");
    setStorageItem(TOKEN_KEY, token);
    setStorageItem(USER_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    console.log("[Auth] GitHub login completed, state updated");
  }, []);

  // Idle timeout of 10 minutes
  useEffect(() => {
    if (!user) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        signOut();
        window.location.href = "/session-timeout";
      }, 600000); // 10 minutes (600000 ms)
    };
    // Events to monitor for activity
    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart", "click"];

    // Set up listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Initial start
    resetTimer();

    // Clean up
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, signOut]);

  return (
    <AuthContext.Provider
      value={{
        user,
        hydrated,
        isLoading,
        signIn,
        signInAs,
        signUp,
        confirmVerification,
        signOut,
        signInWithGoogle,
        signInWithGitHub,
        completeGithubLogin,
      }}
    >
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
