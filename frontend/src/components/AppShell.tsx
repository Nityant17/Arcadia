import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeModeSwitch from "@/components/ui/ThemeModeSwitch";
import { useAppStore } from "@/store/useAppStore";
import { QuickToolsGrid, type QuickToolId } from "@/components/ui/QuickToolsGrid";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BrainIcon,
  CalendarClockIcon,
  ChevronDown,
  ChevronLeft,
  FileText,
  HomeIcon,
  LayoutDashboardIcon,
  LogOut,
  Menu,
  MessageSquareIcon,
  NotebookPenIcon,
  PuzzleIcon,
  Code2,
  Star,
  SwordsIcon,
  Gamepad2,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTimer } from "@/context/TimerContext";

const CORE_NAV_LINKS = [
  { label: "Home", to: "/home", icon: HomeIcon },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboardIcon },
  { label: "Notes", to: "/notes", icon: NotebookPenIcon },
  { label: "Galaxy", to: "/galaxy", icon: Sparkles },
] satisfies Array<{ label: string; to: string; icon: LucideIcon }>;

const LEARNING_NAV_LINKS = [
  { label: "Chat", to: "/chat", icon: MessageSquareIcon },
  { label: "Quiz", to: "/quiz", icon: PuzzleIcon },
  { label: "Study Materials", to: "/study", icon: BrainIcon },
  { label: "Planner", to: "/planner", icon: CalendarClockIcon },
  { label: "Challenge", to: "/challenge", icon: SwordsIcon },
  { label: "Code Lab", to: "/code", icon: Code2 },
  { label: "Game", to: "/game", icon: Gamepad2 },
] satisfies Array<{ label: string; to: string; icon: LucideIcon }>;

interface PinnedItem {
  id: string;
  label: string;
  to: string;
}

interface AppShellProps {
  children: ReactNode;
  pinnedItems?: PinnedItem[];
}

export default function AppShell({ children, pinnedItems = [] }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { timeLeft, isRunning, start, pause } = useTimer();
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentLanguage,
    languages,
    setCurrentLanguage,
    currentUser,
    logout,
    uiOverlayActive,
  } = useAppStore();

  useEffect(() => {
    if (currentLanguage || languages.length === 0) return;
    const fallback = languages.find((lang) => lang.id === "en") ?? languages[0];
    if (fallback) {
      setCurrentLanguage(fallback);
    }
  }, [currentLanguage, languages, setCurrentLanguage]);

  const handleQuickToolClick = (toolId: QuickToolId) => {
    if (toolId === "upload") {
      window.sessionStorage.setItem("arcadia:quicktools-upload", "1");
      void navigate({ to: "/home" });
      return;
    }
    if (toolId === "ask") {
      void navigate({ to: "/home" });
      return;
    }
    if (toolId === "quiz") {
      void navigate({ to: "/quiz" });
      return;
    }
    if (toolId === "study") {
      void navigate({ to: "/study" });
      return;
    }
    if (toolId === "planner") {
      void navigate({ to: "/planner" });
      return;
    }
    if (toolId === "challenge") {
      void navigate({ to: "/challenge" });
      return;
    }
    if (toolId === "dashboard") {
      void navigate({ to: "/dashboard" });
      return;
    }
    if (toolId === "code") {
      void navigate({ to: "/code" });
      return;
    }
    if (toolId === "notes") {
      void navigate({ to: "/notes" });
      return;
    }
  };

  function handleLogout() {
    logout();
    window.location.assign("/auth");
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-background">
      {/* Ambient blobs */}
      <div className="blob-teal fixed top-[-200px] left-[-100px] w-[600px] h-[600px] z-0" />
      <div className="blob-purple fixed bottom-[-100px] right-[-100px] w-[700px] h-[700px] z-0" />

      <aside
        className={`fixed z-40 left-4 top-4 bottom-4 hidden lg:flex rounded-3xl border border-border/70 bg-card/75 backdrop-blur-xl transition-all duration-300 ${
          collapsed ? "w-20" : "w-60"
        }`}
        data-ocid="nav.panel"
      >
        <nav className="flex h-full w-full flex-col px-3 py-3">
          <Link
            to="/home"
            className={`flex items-center py-2 mb-2 ${
              collapsed ? "justify-center px-0" : "gap-2 px-2"
            }`}
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
            className="mb-3 flex items-center justify-center rounded-xl border border-border/70 bg-muted/50 h-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            data-ocid="nav.collapse.button"
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {!collapsed && <h3 className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 mt-6">Core</h3>}
            <div className="space-y-1">
              {CORE_NAV_LINKS.map((link) => {
                const isActive = location.pathname === link.to;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`group relative flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "text-foreground bg-accent/20 border border-accent/40 shadow-[0_0_20px_rgba(6,182,212,0.18)]"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                    data-ocid={`nav.${link.label.toLowerCase().replace(/\s+/g, "-")}.link`}
                    title={collapsed ? link.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{link.label}</span>}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md border border-border/70 bg-popover/95 px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                        {link.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {!collapsed && <h3 className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 mt-6">Learning</h3>}
            <div className="space-y-1">
              {LEARNING_NAV_LINKS.map((link) => {
                const isActive = location.pathname === link.to;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`group relative flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "text-foreground bg-accent/20 border border-accent/40 shadow-[0_0_20px_rgba(6,182,212,0.18)]"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                    data-ocid={`nav.${link.label.toLowerCase().replace(/\s+/g, "-")}.link`}
                    title={collapsed ? link.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{link.label}</span>}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md border border-border/70 bg-popover/95 px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                        {link.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {!collapsed && <h3 className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 mt-6">Favourites</h3>}
            <div className="space-y-1">
              {pinnedItems.length > 0 ? (
                pinnedItems.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={`group relative flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-muted-foreground hover:bg-muted/60 hover:text-foreground`}
                    data-ocid={`nav.pinned.${item.id}.link`}
                    title={collapsed ? item.label : undefined}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md border border-border/70 bg-popover/95 px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                        {item.label}
                      </span>
                    )}
                  </Link>
                ))
              ) : (
                !collapsed && (
                  <div className="mx-4 p-3 rounded-lg border border-dashed border-border/70 text-center flex flex-col items-center justify-center gap-1 opacity-70">
                    <Star size={14} className="text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">Star a note to save it here</p>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border/70 space-y-2">
            
            {/* 🔥 TIMER (FIXED) */}
            <div
              className={`flex items-center justify-center rounded-xl border border-border/70 bg-muted/50 px-2 py-2 ${
                collapsed ? "flex-col gap-2 py-3" : "gap-2"
              }`}
            >
              <span
                className={`font-mono ${
                      collapsed
                        // Replaced rotate-270 origin-center with writing-mode and rotate-180
                        ? "text-xs [writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider"
                        : "text-sm"
                    }`}
              >
                {hours}h {minutes}m {seconds}s
              </span>

              {!collapsed && (
                <button
                  onClick={isRunning ? pause : start}
                  className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-all"
                >
                  {isRunning ? "Pause" : "Start"}
                </button>
              )}
            </div>

            <div
              className={
                collapsed
                  ? "w-full space-y-2"
                  : "w-full grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2"
              }
            >
              <div
                className="h-9 flex items-center justify-center rounded-xl border border-border/70 bg-muted/50"
                data-ocid="nav.theme.toggle"
                title="Toggle theme"
              >
                <ThemeModeSwitch size="sm" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="h-9 w-full flex items-center justify-center gap-1.5 px-2 rounded-xl border border-border/70 bg-muted/50 text-xs font-medium hover:bg-muted transition-all"
                  data-ocid="nav.language.select"
                  title={collapsed ? currentLanguage?.name : undefined}
                >
                  <span>{currentLanguage?.flag}</span>
                  {!collapsed && (
                    <>
                      <span className="text-foreground truncate text-center">{currentLanguage?.name}</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="glass-card border-border/70 bg-popover/95"
                  align="end"
                >
                  {languages.map((lang) => (
                    <DropdownMenuItem
                      key={lang.id}
                      onClick={() => setCurrentLanguage(lang)}
                      className="cursor-pointer focus:bg-muted"
                    >
                      <span className="mr-2">{lang.flag}</span>
                      {lang.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`w-full flex items-center justify-center gap-2 px-2 py-2 rounded-xl border border-border/70 bg-muted/50 hover:bg-muted transition-all`}
                  data-ocid="nav.avatar.button"
                  title={collapsed ? (currentUser?.name ?? "Profile") : undefined}
                >
                  <Avatar className="w-8 h-8 border border-border/70 bg-muted/40 backdrop-blur-xl">
                    <AvatarFallback className="bg-gradient-to-br from-[oklch(0.78_0.16_196)] to-[oklch(0.60_0.20_264)] text-white text-xs font-bold">
                      {currentUser?.name?.charAt(0) ?? "A"}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <span className="text-sm text-foreground truncate text-center">
                      {currentUser?.name ?? "Profile"}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="glass-card border-border/70 bg-popover/95"
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
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 rounded-lg hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </aside>

      <aside className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 lg:hidden" data-ocid="nav.mobile.panel">
        <nav className="rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl px-2 py-2 flex items-center gap-1 max-w-[94vw] overflow-x-auto">
          <div className="px-2">
            <ThemeModeSwitch size="sm" />
          </div>
          {[...CORE_NAV_LINKS, ...LEARNING_NAV_LINKS].slice(0, 6).map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "text-foreground bg-accent/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <QuickToolsGrid
        onToolClick={handleQuickToolClick}
        hidden={uiOverlayActive}
      />

      <main
        className={`relative z-10 px-4 pt-8 pb-20 lg:pt-6 lg:pr-8 lg:pb-6 transition-all duration-300 ${
          collapsed ? "lg:pl-28" : "lg:pl-[17rem]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
