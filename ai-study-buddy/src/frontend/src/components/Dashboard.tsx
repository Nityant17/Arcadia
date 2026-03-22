import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, BookOpen, Brain, CalendarDays, ChevronLeft, ChevronRight, Home, Layers, LogOut, MessageSquare, Sparkles, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ArcadiaDocument, UserSession } from "../lib/api";
import { useGetDocuments } from "../hooks/useQueries";
import ChatArea from "./ChatArea";
import ChallengePanel from "./ChallengePanel";
import DashboardPanel from "./DashboardPanel";
import HomePanel from "./HomePanel";
import PlannerPanel from "./PlannerPanel";
import QuizPanel from "./QuizPanel";
import StudyPanel from "./StudyPanel";
import SubjectTopics from "./SubjectTopics";

type Props = {
  session: UserSession;
  onLogout: () => void;
};

export default function Dashboard({ session, onLogout }: Props) {
  const queryClient = useQueryClient();
  const { data: documents = [], isLoading } = useGetDocuments(session.token);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [feature, setFeature] = useState<"home" | "dashboard" | "notes" | "chat" | "quiz" | "study" | "planner" | "challenge">("home");

  useEffect(() => {
    if (activeDocumentId && !documents.some((doc) => doc.id === activeDocumentId)) {
      setActiveDocumentId(null);
    }
  }, [documents, activeDocumentId]);

  const activeDocument: ArcadiaDocument | null =
    documents.find((d) => d.id === activeDocumentId) ?? null;
  const needsDocument = feature === "chat" || feature === "quiz" || feature === "study" || feature === "challenge";

  const navItems: Array<{
    key: "home" | "dashboard" | "notes" | "chat" | "quiz" | "study" | "planner" | "challenge";
    label: string;
    icon: ReactNode;
  }> = [
    { key: "home", label: "Home", icon: <Home className="w-4 h-4" /> },
    { key: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "notes", label: "Notes", icon: <BookOpen className="w-4 h-4" /> },
    { key: "chat", label: "Chat", icon: <MessageSquare className="w-4 h-4" /> },
    { key: "quiz", label: "Quiz", icon: <Sparkles className="w-4 h-4" /> },
    { key: "study", label: "Study", icon: <Layers className="w-4 h-4" /> },
    { key: "planner", label: "Planner", icon: <CalendarDays className="w-4 h-4" /> },
    { key: "challenge", label: "Challenge", icon: <Swords className="w-4 h-4" /> },
  ];

  const handleLogout = () => {
    queryClient.clear();
    onLogout();
  };

  return (
    <div className="min-h-screen text-white px-3 py-3 md:px-4 md:py-4">
      <div className={`mx-auto max-w-[1680px] grid gap-4 ${sidebarCollapsed ? "lg:grid-cols-[88px_minmax(0,1fr)]" : "lg:grid-cols-[236px_minmax(0,1fr)]"}`}>
        <aside className="glass-panel rounded-2xl p-3 lg:sticky lg:top-4 h-fit relative">
          <div className={`flex items-center px-2 py-2 mb-2 ${sidebarCollapsed ? "justify-center" : "gap-3 justify-between"}`}>
            <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Brain className="w-5 h-5 text-white" />
              </span>
              {!sidebarCollapsed && (
                <div>
                  <p className="font-bold text-base tracking-wide">Arcadia</p>
                  <p className="text-[11px] text-white/55">{session.name}</p>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            className="absolute top-3 right-3 text-white/70 hover:text-white"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className="space-y-1 mb-3">
            {navItems.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => setFeature(item.key)}
                className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-2"} px-3 py-2 rounded-xl border transition ${feature === item.key ? "bg-white/14 border-white/30 text-white" : "bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/[0.08]"}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={handleLogout} className={`w-full ${sidebarCollapsed ? "px-2" : "gap-1.5"} border-white/20 bg-white/5 text-white hover:bg-white/10`}>
            <LogOut className="w-3.5 h-3.5" />
            {!sidebarCollapsed && "Log out"}
          </Button>
        </aside>

        <main className="space-y-4 min-w-0">
          <div className="bento-card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/55 uppercase tracking-wide">Active Workspace</p>
              <p className="text-lg font-semibold mt-1">
                {feature.charAt(0).toUpperCase() + feature.slice(1)}
                {needsDocument && activeDocument ? ` · ${activeDocument.original_name}` : ""}
              </p>
            </div>
            <div className="text-xs text-white/55">{documents.length} notes indexed</div>
          </div>

          {feature === "home" ? (
            <HomePanel
              session={session}
              documents={documents}
              onSelectDocument={setActiveDocumentId}
              onOpenFeature={setFeature}
            />
          ) : feature === "dashboard" ? (
            <div className="w-full max-w-[1200px]">
              <DashboardPanel session={session} />
            </div>
          ) : feature === "notes" ? (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 w-full max-w-[1200px]">
              <SubjectTopics
                documents={documents}
                activeDocumentId={activeDocumentId}
                onSelectDocument={setActiveDocumentId}
                onDocumentSelected={() => setFeature("chat")}
                loading={isLoading}
                sessionToken={session.token}
              />
              <div className="space-y-4">
                <div className="bento-card p-4">
                  <p className="text-sm font-semibold text-white">Notes Insights</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2.5">
                      <p className="text-white/60 text-xs">Total notes</p>
                      <p className="text-lg font-semibold">{documents.length}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2.5">
                      <p className="text-white/60 text-xs">Selected note</p>
                      <p className="font-medium truncate">{activeDocument?.original_name ?? "None"}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-2.5">
                      <p className="text-white/60 text-xs">Total chunks</p>
                      <p className="text-lg font-semibold">{documents.reduce((sum, doc) => sum + (doc.chunk_count ?? 0), 0)}</p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-3 space-y-2">
                    <p className="text-xs text-white/60 uppercase tracking-wide">Open selected note in</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" disabled={!activeDocument} onClick={() => setFeature("chat")}>Chat</Button>
                      <Button size="sm" variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" disabled={!activeDocument} onClick={() => setFeature("quiz")}>Quiz</Button>
                      <Button size="sm" variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" disabled={!activeDocument} onClick={() => setFeature("study")}>Study</Button>
                      <Button size="sm" variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" disabled={!activeDocument} onClick={() => setFeature("challenge")}>Challenge</Button>
                    </div>
                  </div>
                </div>
                <div className="bento-card p-4">
                  <p className="text-sm font-semibold text-white">Tips</p>
                  <ul className="mt-3 text-xs text-white/65 space-y-2 list-disc pl-4">
                    <li>Keep subject names consistent for better planner grouping.</li>
                    <li>Extract topics before quiz/study for focused generation.</li>
                    <li>Delete outdated notes to reduce retrieval noise.</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[1200px]">
              {needsDocument && !activeDocument ? (
                <div className="bento-card p-6 space-y-3">
                  <p className="text-lg font-semibold">Select a note to continue</p>
                  <p className="text-sm text-white/65">Choose a note from the Notes page first, then open Chat/Quiz/Study/Challenge for that note.</p>
                  <Button className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0" onClick={() => setFeature("notes")}>Go to Notes</Button>
                </div>
              ) : (
                <>
                  {feature === "chat" && <ChatArea session={session} activeDocument={activeDocument} />}
                  {feature === "quiz" && <QuizPanel session={session} activeDocument={activeDocument} />}
                  {feature === "study" && <StudyPanel session={session} activeDocument={activeDocument} />}
                  {feature === "planner" && <PlannerPanel session={session} />}
                  {feature === "challenge" && <ChallengePanel session={session} activeDocument={activeDocument} />}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
