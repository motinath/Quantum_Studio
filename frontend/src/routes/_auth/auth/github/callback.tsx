import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth, UserRole } from "@/lib/auth/auth-context";

const githubCallbackSearchSchema = z.object({
  token: z.string().optional(),
  user: z.string().optional(),
  error: z.string().optional(),
});

type GitHubSuccessSearch = z.infer<typeof githubCallbackSearchSchema>;

export const Route = createFileRoute("/_auth/auth/github/callback")({
  head: () => ({ meta: [{ title: "GitHub Sign In — Silicofeller" }] }),
  validateSearch: (search) => githubCallbackSearchSchema.parse(search),
  component: GitHubSuccessPage,
});

function GitHubSuccessPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_auth/auth/github/callback" }) as GitHubSuccessSearch;
  const [error, setError] = useState<string | null>(null);
  const { completeGithubLogin } = useAuth();

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
        const backendUrl = (import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000").replace(
          /\/$/,
          "",
        );
        const userResponse = await fetch(`${backendUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${search.token}` },
        });

        if (!userResponse.ok) {
          throw new Error("Failed to retrieve user profile from backend.");
        }

        const userData = await userResponse.json();

        // Complete the login in the Auth context to trigger React state updates
        completeGithubLogin(search.token, {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role as UserRole,
          organization: userData.organization,
          initials: userData.initials || "?",
        });

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
  }, [search, navigate, completeGithubLogin]);

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
