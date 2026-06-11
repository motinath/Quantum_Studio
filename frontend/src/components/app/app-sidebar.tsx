import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sparkles,
  Users,
  CreditCard,
  Settings,
  ShieldCheck,
  FolderKanban,
  Network,
  PenSquare,
  LayoutTemplate,
  Library,
  PlayCircle,
  Atom,
  Shield,
  CheckCircle2,
  BarChart3,
  GitBranch,
  FileText,
  Plug,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { LogoMark, SilicofellerLogo } from "@/components/silicofeller-logo";
import { useAuth } from "@/lib/auth/auth-context";
import { useProject } from "@/lib/project-context";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const NAV: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Design",
    items: [
      { title: "Projects", url: "/projects", icon: FolderKanban },
      { title: "ChatBot", url: "/designer", icon: Sparkles },
      { title: "Architecture Explorer", url: "/architecture-explorer", icon: Network },
      { title: "Schematic Editor", url: "/schematic-editor", icon: PenSquare },
      { title: "Layout Viewer", url: "/layout-viewer", icon: LayoutTemplate },
      { title: "Component Library", url: "/component-library", icon: Library },
    ],
  },
  {
    label: "Simulation & Analysis",
    items: [
      { title: "Verification", url: "/verification", icon: CheckCircle2, badge: "12" },
      { title: "Simulations", url: "/simulations", icon: PlayCircle },
      { title: "Physics Analysis", url: "/physics-analysis", icon: Atom },
      { title: "Fault Tolerance Studio", url: "/fault-tolerance", icon: Shield, badge: "NEW" },

    ],
  },
  {
    label: "Data & Management",
    items: [
      { title: "Results", url: "/results", icon: BarChart3 },
      { title: "Version Control", url: "/version-control", icon: GitBranch },
      { title: "Reports", url: "/reports", icon: FileText },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Users & Teams", url: "/team", icon: Users },
      { title: "Integrations", url: "/integrations", icon: Plug },
      { title: "Billing", url: "/billing", icon: CreditCard },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();
  const { activeProject } = useProject();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar w-[240px] transition-all duration-200 text-sidebar-foreground"
    >
      <SidebarHeader className="border-b border-sidebar-border px-4 h-16 flex items-center justify-start bg-transparent">
        <Link to="/" aria-label="Silicofeller" className="flex items-center gap-2.5 min-w-0">
          {collapsed ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 shadow-sm shrink-0">
              <LogoMark className="[&_img]:!h-5 [&_img]:brightness-0 [&_img]:invert" />
            </span>
          ) : (
            <SilicofellerLogo
              className="brightness-0 invert scale-[1.2] "
              iconClassName="h-16"
            />
          )}
        </Link>
      </SidebarHeader>

      {/* Active project badge */}
      {activeProject && !collapsed && (
        <Link
          to="/projects"
          className="flex items-center gap-2 px-4 py-2 border-b border-sidebar-border bg-white/5 hover:bg-white/10 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          <span className="text-[10px] font-bold text-sidebar-foreground/60 truncate flex-1">
            {activeProject.name.slice(0, 22)}
          </span>
          <span className="text-[9px] text-sidebar-foreground/30 font-bold">ACTIVE</span>
        </Link>
      )}

      <SidebarContent className="py-3 flex-1 overflow-y-auto">
        {NAV.map((group, gi) => (
          <SidebarGroup key={gi} className="px-0 py-1.5">
            {group.label && !collapsed && (
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/45 px-5 mb-1.5">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const isActive = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={`h-9 rounded-lg transition-colors ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground font-semibold shadow-sm shadow-sidebar-primary/20"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 w-full">
                          <item.icon
                            className={`h-4 w-4 shrink-0 ${isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50"}`}
                          />
                          {!collapsed && (
                            <>
                              <span className="text-[13px] leading-none flex-1 truncate">
                                {item.title}
                              </span>
                              {item.badge && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive
                                    ? "bg-white/20 text-white"
                                    : "bg-accent/20 text-violet-300"
                                    }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {user?.role === "admin" && (
          <SidebarGroup className="px-0 py-1.5">
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5 px-2">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/admin"}
                    tooltip="Admin"
                    className={`h-9 rounded-lg ${pathname === "/admin"
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                  >
                    <Link to="/admin" className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-[13px]">Admin Console</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
