import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/useAppStore";
import { Link, useLocation } from "@tanstack/react-router";
import {
  BrainIcon,
  CalendarClockIcon,
  ChevronDown,
  ChevronLeft,
  HomeIcon,
  LayoutDashboardIcon,
  LogOut,
  Menu,
  MessageSquareIcon,
  NotebookPenIcon,
  PuzzleIcon,
  SwordsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

const NAV_LINKS = [
  { label: "Home", to: "/home", icon: HomeIcon },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboardIcon },
  { label: "Notes", to: "/notes", icon: NotebookPenIcon },
  { label: "Chat", to: "/chat", icon: MessageSquareIcon },
  { label: "Quiz", to: "/quiz", icon: PuzzleIcon },
  { label: "Study Materials", to: "/study", icon: BrainIcon },
  { label: "Planner", to: "/planner", icon: CalendarClockIcon },
  { label: "Challenge", to: "/challenge", icon: SwordsIcon },
] satisfies Array<{ label: string; to: string; icon: LucideIcon }>;

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const {
    currentLanguage,
    languages,
    setCurrentLanguage,
    currentUser,
    logout,
  } = useAppStore();

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#0a0a0a]">
      {/* Ambient blobs */}
      <div className="blob-teal fixed top-[-200px] left-[-100px] w-[600px] h-[600px] z-0" />
      <div className="blob-purple fixed bottom-[-100px] right-[-100px] w-[700px] h-[700px] z-0" />

      <aside
        className={`fixed z-40 left-4 top-4 bottom-4 hidden lg:flex rounded-3xl border border-white/10 bg-slate-950/40 backdrop-blur-xl transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
        data-ocid="nav.panel"
      >
        <nav className="flex h-full w-full flex-col px-3 py-3">
          <Link
            to="/home"
            className="flex items-center gap-2 px-2 py-2 mb-2"
            data-ocid="nav.link"
          >
            <div
              className={`w-8 h-8 rounded-lg bg-gradient-to-br from-[oklch(0.78_0.16_196)] to-[oklch(0.60_0.20_264)] flex items-center justify-center transition-all duration-300 ${
                collapsed ? "" : "shadow-[0_0_20px_rgba(6,182,212,0.35)]"
              }`}
            >
              <span className="text-white font-bold text-sm">A</span>
            </div>
            {!collapsed && <span className="font-semibold text-foreground text-base tracking-tight">Arcadia</span>}
          </Link>

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="mb-3 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 h-9 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
            data-ocid="nav.collapse.button"
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <div className="space-y-1 flex-1">
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === link.to;
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`group relative flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-foreground bg-white/12 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/8"
                  }`}
                  data-ocid={`nav.${link.label.toLowerCase().replace(/\s+/g, "-")}.link`}
                  title={collapsed ? link.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{link.label}</span>}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md border border-white/10 bg-slate-950/95 px-2 py-1 text-xs text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      {link.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`w-full flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-2 px-2 py-2 rounded-xl border border-white/10 bg-white/5 text-sm font-medium hover:bg-white/10 transition-all`}
                data-ocid="nav.language.select"
                title={collapsed ? currentLanguage?.name : undefined}
              >
                <span>{currentLanguage?.flag}</span>
                {!collapsed && (
                  <>
                    <span className="text-foreground truncate">{currentLanguage?.name}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
                  </>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="glass-card border-white/10 bg-[#0B1020]/90"
                align="end"
              >
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.id}
                    onClick={() => setCurrentLanguage(lang)}
                    className="cursor-pointer hover:bg-white/10"
                  >
                    <span className="mr-2">{lang.flag}</span>
                    {lang.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`w-full flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-2 px-2 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all`}
                  data-ocid="nav.avatar.button"
                  title={collapsed ? (currentUser?.name ?? "Profile") : undefined}
                >
                  <Avatar className="w-8 h-8 border border-white/20 bg-white/5 backdrop-blur-xl">
                    <AvatarFallback className="bg-gradient-to-br from-[oklch(0.78_0.16_196)] to-[oklch(0.60_0.20_264)] text-white text-xs font-bold">
                      {currentUser?.name?.charAt(0) ?? "A"}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <span className="text-sm text-foreground truncate">
                      {currentUser?.name ?? "Profile"}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="glass-card border-white/10 bg-[#0B1020]/90"
                align="end"
              >
                <DropdownMenuItem
                  className="text-muted-foreground text-xs"
                  disabled
                >
                  {currentUser?.email ?? "Not signed in"}
                </DropdownMenuItem>
                <div className="px-2 py-1.5" data-ocid="nav.logout.button">
                  <button
                    type="button"
                    onClick={logout}
                    className="uiverse-logout-btn"
                    aria-label="Sign out"
                  >
                    <span className="uiverse-logout-sign">
                      <LogOut className="h-[14px] w-[14px] text-white" />
                    </span>
                    <span className="uiverse-logout-text">Sign out</span>
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </aside>

      <aside className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 lg:hidden" data-ocid="nav.mobile.panel">
        <nav className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-2 py-2 flex items-center gap-1 max-w-[94vw] overflow-x-auto">
          {NAV_LINKS.slice(0, 6).map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "text-foreground bg-white/12"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/8"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main
        className={`relative z-10 px-4 pt-8 pb-20 lg:pt-6 lg:pr-8 lg:pb-6 transition-all duration-300 ${
          collapsed ? "lg:pl-28" : "lg:pl-72"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
