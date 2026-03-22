import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import AuthPage from "@/pages/AuthPage";
import ChallengePage from "@/pages/ChallengePage";
import ChatPage from "@/pages/ChatPage";
import DashboardPage from "@/pages/DashboardPage";
import HomePage from "@/pages/HomePage";
import NotesPage from "@/pages/NotesPage";
import PlannerPage from "@/pages/PlannerPage";
import QuizPage from "@/pages/QuizPage";
import StudyPage from "@/pages/StudyPage";
import { useAppStore } from "@/store/useAppStore";
import {
  Outlet,
  RouterProvider,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { useEffect } from "react";

// Helper to get authToken outside of React
function getAuthToken() {
  try {
    const stored = localStorage.getItem("arcadia-app-store");
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.authToken ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

// Root layout
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Index redirect
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});

// Auth route
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  component: AuthPage,
});

// Protected layout route
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: () => {
    const token = getAuthToken();
    if (!token) {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/home",
  component: HomePage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const notesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/notes",
  component: NotesPage,
});

const chatRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/chat",
  component: ChatPage,
});

const quizRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/quiz",
  component: QuizPage,
});

const studyRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/study",
  component: StudyPage,
});

const plannerRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/planner",
  component: PlannerPage,
});

const challengeRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/challenge",
  component: ChallengePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  protectedRoute.addChildren([
    homeRoute,
    dashboardRoute,
    notesRoute,
    chatRoute,
    quizRoute,
    studyRoute,
    plannerRoute,
    challengeRoute,
  ]),
]);

const browserHistory = createBrowserHistory();

const router = createRouter({
  routeTree,
  history: browserHistory,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  const initLanguages = useAppStore((s) => s.initLanguages);

  useEffect(() => {
    initLanguages();
  }, [initLanguages]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
