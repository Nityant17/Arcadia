import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import LandingPage from "./components/LandingPage";
import type { UserSession } from "./lib/api";

const queryClient = new QueryClient();

function AppContent() {
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("arcadia_session");
    if (!raw) return;
    try {
      setSession(JSON.parse(raw));
    } catch {
      localStorage.removeItem("arcadia_session");
    }
  }, []);

  const onAuthSuccess = (next: UserSession) => {
    setSession(next);
    localStorage.setItem("arcadia_session", JSON.stringify(next));
  };

  const onLogout = () => {
    setSession(null);
    localStorage.removeItem("arcadia_session");
  };

  const isAuthenticated = !!session?.token;

  return (
    <AnimatePresence mode="wait">
      {isAuthenticated ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <Dashboard session={session!} onLogout={onLogout} />
        </motion.div>
      ) : (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <LandingPage onAuthSuccess={onAuthSuccess} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
