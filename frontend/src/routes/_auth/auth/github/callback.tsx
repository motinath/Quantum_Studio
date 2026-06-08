import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GitHubSuccessSearch {
  token?: string;
  user?: string;
  error?: string;
}

export const Route = createFileRoute("/_auth/auth/github/callback")({
  head: () => ({ meta: [{ title: "GitHub Sign In — Silicofeller" }] }),
  component: GitHubSuccessPage,
});

function GitHubSuccessPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_auth/auth/github/callback" }) as GitHubSuccessSearch;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleSuccess = async () => {
      // Check for errors
      if (search.error) {
        setError(search.error);
        toast.error(`GitHub login failed: ${search.error}`);
        setTimeout(() => navigate({ to: "/sign-in" }), 2000);
        return;
      }

      // Check for token
      if (!search.token) {
        setError("No token received");
        toast.error("GitHub login failed: No token received");
        setTimeout(() => navigate({ to: "/sign-in" }), 2000);
        return;
      }

      try {
        // Store token in localStorage
        localStorage.setItem("qs_token", search.token);
        console.log("[GitHub Auth] Token stored successfully");
        
        // Fetch and cache user data
        try {
          const backendUrl = (import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000").replace(/\/$/, "");
          const userResponse = await fetch(`${backendUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${search.token}` },
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            localStorage.setItem("qs_user", JSON.stringify(userData));
            console.log("[GitHub Auth] User data cached");
          }
        } catch (e) {
          console.warn("[GitHub Auth] Failed to cache user data:", e);
          // Continue anyway - user data will be fetched on first API call
        }
        
        toast.success("Signed in with GitHub!");
        navigate({ to: "/dashboard" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to process login";
        setError(message);
        toast.error(message);
        setTimeout(() => navigate({ to: "/sign-in" }), 2000);
      }
    };

    handleSuccess();
  }, [search, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <h1 className="text-2xl font-bold text-red-400">Sign In Failed</h1>
            <p className="text-slate-400">{error}</p>
            <p className="text-sm text-slate-500">Redirecting you back...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
            <h1 className="text-2xl font-bold text-white">Completing GitHub sign in</h1>
            <p className="text-slate-400">Please wait while we process your login...</p>
          </>
        )}
      </div>
    </div>
  );
}
