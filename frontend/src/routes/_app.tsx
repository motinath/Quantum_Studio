import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { ClaudeAssistant } from "@/components/app/claude-assistant";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  Settings as SettingsIcon,
  User as UserIcon,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { DesignProvider } from "@/lib/design-context";
import { ProjectProvider } from "@/lib/project-context";
import { useEffect } from "react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { user, hydrated, signOut } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (hydrated && !user) navigate({ to: "/sign-in", replace: true });
  }, [hydrated, user, navigate]);

  if (!hydrated || !user) return null;

  // Resolve clean dynamic page title
  const TITLES: Record<string, string> = {
    "/dashboard": "Workspace",
    "/projects": "Projects",
    "/designer": "ChatBot",
    "/architecture-explorer": "Architecture Explorer",
    "/schematic-editor": "Schematic Editor",
    "/layout-viewer": "Layout Viewer",
    "/quantum-editor": "Quantum Editor",
    "/component-library": "Component Library",
    "/simulations": "Simulations",
    "/physics-analysis": "Physics Analysis",
    "/verification": "Verification",
    "/results": "Results",
    "/version-control": "Version Control",
    "/reports": "Reports",
    "/team": "Users & Teams",
    "/integrations": "Integrations",
    "/billing": "Billing & Usage",
    "/settings": "Settings",
    "/profile": "User Profile",
    "/about": "About Platform",
    "/admin": "Admin Console",
  };
  const getPageTitle = () => TITLES[pathname] || "Workspace";

  return (
    <DesignProvider>
      <ProjectProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-[#FCFCFD] text-slate-800 font-sans">
          <AppSidebar />
          <SidebarInset className="flex flex-1 flex-col overflow-hidden">
            {/* Slim, sticky glassmorphic Top Navigation Bar */}
            <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-slate-200/50 bg-white/70 px-4 backdrop-blur-md shadow-[0_1px_2px_0_rgba(0,0,0,0.01)] select-none">
              {/* Left Group */}
              <div className="flex items-center gap-3">
                <SidebarTrigger className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center" />
                <span className="h-4 w-px bg-slate-200" />
                <h1 className="text-sm font-black text-slate-900 tracking-tight font-display">
                  {getPageTitle()}
                </h1>
              </div>

              {/* Center Group: Project / Organization Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-100 bg-slate-50/50 text-[10px] font-extrabold text-slate-500 shadow-inner">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                <span>Project: {user.organization}</span>
              </div>

              {/* Right Group: Profile Dropdown */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white p-0.5 pr-2.5 text-[11px] font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-accent/20 focus:outline-none cursor-pointer">
                    <Avatar className="h-6 w-6 border border-slate-100">
                      <AvatarFallback className="bg-accent text-[9px] font-black text-white shadow-sm shadow-accent/20">
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline-block truncate max-w-[100px]">
                      {user.name}
                    </span>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    className="w-52 mt-1 rounded-2xl border-slate-200 shadow-xl p-1 bg-white"
                  >
                    <DropdownMenuLabel className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 leading-tight">
                          {user.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
                          {user.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-100" />

                    <DropdownMenuItem
                      asChild
                      className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer focus:bg-slate-50"
                    >
                      <Link to="/profile">
                        <UserIcon className="mr-2 h-3.5 w-3.5 text-slate-400" /> User Profile
                      </Link>
                    </DropdownMenuItem>
                    {(user.role === "admin" || user.role === "org_manager") && (
                      <DropdownMenuItem
                        asChild
                        className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer focus:bg-slate-50"
                      >
                        <Link to="/billing">
                          <CreditCard className="mr-2 h-3.5 w-3.5 text-slate-400" /> Billing
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      asChild
                      className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer focus:bg-slate-50"
                    >
                      <Link to="/settings">
                        <SettingsIcon className="mr-2 h-3.5 w-3.5 text-slate-400" /> Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-100" />

                    <DropdownMenuItem
                      className="rounded-xl px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer focus:bg-rose-50"
                      onClick={() => {
                        signOut();
                        navigate({ to: "/" });
                      }}
                    >
                      <LogOut className="mr-2 h-3.5 w-3.5 text-rose-400" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <main className="flex-1 overflow-hidden relative">
              <Outlet />
            </main>
          </SidebarInset>
          {/* Claude AI Assistant — available on all authenticated pages */}
          <ClaudeAssistant />
        </div>
      </SidebarProvider>
      </ProjectProvider>
    </DesignProvider>
  );
}