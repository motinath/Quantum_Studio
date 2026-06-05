import React, { createContext, useContext, useState, useEffect } from "react";

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
  signIn: (email: string, password?: string) => { ok: boolean; error?: string };
  signInAs: (role: UserRole) => void;
  signUp: (name: string, email: string, org: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "silicofeller.auth.user";

const DEFAULT_USER: User = {
  id: "u_1",
  name: "Harshith Gude",
  email: "harshith@silicofeller.com",
  role: "org_manager",
  organization: "Gourmet Bistro Chain",
  initials: "HG",
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        // Default session for seamless UX
        setUser(DEFAULT_USER);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
      }
    } catch (e) {
      console.error("Failed to read auth from localStorage", e);
    } finally {
      setHydrated(true);
    }
  }, []);

  const signIn = (email: string, password?: string) => {
    if (!email || !email.includes("@")) {
      return { ok: false, error: "Invalid email" };
    }
    const demo = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase());
    const role = demo?.role ?? "engineer";
    const org = demo?.organization ?? "Silicofeller Labs";
    const name =
      demo?.name ?? email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1);
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const newUser: User = {
      id: `u_${Date.now()}`,
      name,
      email,
      role,
      organization: org,
      initials,
    };
    setUser(newUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
    return { ok: true };
  };

  const signInAs = (role: UserRole) => {
    const demo = DEMO_ACCOUNTS.find((a) => a.role === role) || DEMO_ACCOUNTS[0];
    const initials = demo.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const newUser: User = {
      id: `u_${demo.role}`,
      name: demo.name,
      email: demo.email,
      role: demo.role,
      organization: demo.organization,
      initials,
    };
    setUser(newUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
  };

  const signUp = async (name: string, email: string, org: string, role: UserRole = "engineer") => {
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const newUser: User = {
      id: `u_${Date.now()}`,
      name,
      email,
      role,
      organization: org || "Independent",
      initials: initials || "U",
    };
    setUser(newUser);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
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
