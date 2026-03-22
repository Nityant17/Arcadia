import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/useAppStore";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

const NAV_LINKS = [
  { label: "Home", to: "/home" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Notes", to: "/notes" },
  { label: "Chat", to: "/chat" },
  { label: "Quiz", to: "/quiz" },
  { label: "Study", to: "/study" },
  { label: "Planner", to: "/planner" },
  { label: "Challenge", to: "/challenge" },
];

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const {
    currentLanguage,
    languages,
    setCurrentLanguage,
    currentUser,
    logout,
  } = useAppStore();

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="blob-teal fixed top-[-200px] left-[-100px] w-[600px] h-[600px] z-0" />
      <div className="blob-purple fixed bottom-[-100px] right-[-100px] w-[700px] h-[700px] z-0" />

      {/* Top Nav */}
      <header className="sticky top-0 z-50 px-6 pt-4 pb-2">
        <nav
          className="glass-nav rounded-2xl max-w-[1200px] mx-auto px-6 py-3 flex items-center gap-4"
          data-ocid="nav.panel"
        >
          {/* Logo */}
          <Link
            to="/home"
            className="flex items-center gap-2 shrink-0"
            data-ocid="nav.link"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[oklch(0.78_0.16_196)] to-[oklch(0.60_0.20_264)] flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-foreground text-lg tracking-tight">
              Arcadia
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex-1 flex items-center justify-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-foreground bg-white/10 border-b-2 border-[oklch(0.78_0.16_196)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  data-ocid={`nav.${link.label.toLowerCase()}.link`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-card text-sm font-medium hover:bg-white/10 transition-all"
                data-ocid="nav.language.select"
              >
                <span>{currentLanguage?.flag}</span>
                <span className="text-foreground">{currentLanguage?.name}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
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

            {/* Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="focus:outline-none"
                  data-ocid="nav.avatar.button"
                >
                  <Avatar className="w-8 h-8 border border-white/20">
                    <AvatarFallback className="bg-gradient-to-br from-[oklch(0.78_0.16_196)] to-[oklch(0.60_0.20_264)] text-white text-xs font-bold">
                      {currentUser?.name?.charAt(0) ?? "A"}
                    </AvatarFallback>
                  </Avatar>
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
                  {currentUser?.email ?? "alex@arcadia.app"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive hover:bg-white/10"
                  data-ocid="nav.logout.button"
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-6 py-6 max-w-[1200px] mx-auto">
        {children}
      </main>
    </div>
  );
}
