import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Clock3, Flame, Layers, MessageSquare, Sparkles, Swords } from "lucide-react";
import { toast } from "sonner";
import type { ArcadiaDocument, UserSession } from "../lib/api";
import { resetProgress } from "../lib/api";
import { useGetPlanTasks, useGetStudyProgress } from "../hooks/useQueries";

type FeatureKey = "notes" | "chat" | "quiz" | "study" | "planner" | "challenge";

type Props = {
  session: UserSession;
  documents: ArcadiaDocument[];
  onSelectDocument: (id: string) => void;
  onOpenFeature: (feature: FeatureKey) => void;
};

export default function HomePanel({ session, documents, onSelectDocument, onOpenFeature }: Props) {
  const queryClient = useQueryClient();
  const { data: stats } = useGetStudyProgress(session.token);
  const { data: plan } = useGetPlanTasks(session.token, session.user_id);
  const pendingTasks = ((plan?.tasks ?? []) as Array<{
    id: string;
    subject: string;
    task_type: string;
    focus_topic?: string;
    estimated_minutes: number;
    status: string;
    start_time?: string;
    end_time?: string;
    due_date?: string;
  }>)
    .filter((task) => task.status !== "completed")
    .slice(0, 5);

  const formatTaskType = (taskType: string) => {
    if (taskType === "study_block") return "Study Block";
    if (taskType === "quiz_revision") return "Quiz Revision";
    if (taskType === "weakness_booster") return "Weakness Booster";
    if (taskType === "spaced_repetition") return "Spaced Repetition";
    return taskType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDateTime = (iso: string | undefined) => {
    if (!iso) return "--";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleResetProgress = async () => {
    const ok = window.confirm("Reset all progress? This removes quiz attempts, mastery history, chat history, and cached audio.");
    if (!ok) return;
    try {
      await resetProgress(session.token);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["studyProgress"] }),
        queryClient.invalidateQueries({ queryKey: ["planTasks"] }),
        queryClient.invalidateQueries({ queryKey: ["messages"] }),
      ]);
      toast.success("Progress reset complete");
    } catch (error) {
      toast.error(`Reset failed: ${String(error)}`);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <Card className="bento-card border-white/15 bg-white/[0.04] text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-xl">Welcome back, {session.name.split(" ")[0] || "Learner"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-indigo-300/30 bg-gradient-to-r from-indigo-500/20 to-cyan-500/15 p-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/80">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-300" />
              Arcadia Workspace
            </div>
            <p className="text-2xl md:text-[2rem] font-bold tracking-tight mt-3">Arcadia</p>
            <p className="text-lg font-semibold mt-1">Study from your own notes with AI-native workflows.</p>
            <p className="text-sm text-white/70 mt-1">Chat, quiz, planner, whiteboard hints, and challenge rooms from one workspace.</p>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-2">
            <Button variant="outline" className="justify-start border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={() => onOpenFeature("notes")}>
              <BookOpen className="w-4 h-4 mr-2" />
              Notes
            </Button>
            <Button className="justify-start bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-0" onClick={() => onOpenFeature("chat")}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
            <Button variant="outline" className="justify-start border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={() => onOpenFeature("quiz")}>
              <Sparkles className="w-4 h-4 mr-2" />
              Quiz
            </Button>
            <Button variant="outline" className="justify-start border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={() => onOpenFeature("study")}>
              <Layers className="w-4 h-4 mr-2" />
              Study
            </Button>
            <Button variant="outline" className="justify-start border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={() => onOpenFeature("planner")}>
              <CalendarDays className="w-4 h-4 mr-2" />
              Planner
            </Button>
            <Button variant="outline" className="justify-start border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={() => onOpenFeature("challenge")}>
              <Swords className="w-4 h-4 mr-2" />
              Challenge
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <Card className="bento-card border-white/15 bg-white/[0.04] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/90 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-300" />
              Recent Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.length === 0 ? (
              <p className="text-sm text-white/60">No notes uploaded yet. Open Notes to upload your first document.</p>
            ) : (
              documents.slice(0, 6).map((doc) => (
                <button
                  type="button"
                  key={doc.id}
                  onClick={() => {
                    onSelectDocument(doc.id);
                    onOpenFeature("chat");
                  }}
                  className="w-full text-left rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2.5 hover:bg-white/[0.1] transition"
                >
                  <p className="text-sm font-medium truncate">{doc.original_name}</p>
                  <p className="text-xs text-white/60 truncate">{doc.subject} • {doc.topic || "Untagged"} • {doc.chunk_count} chunks</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bento-card border-white/15 bg-white/[0.04] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white/90">Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs text-white/60">Docs</p>
                <p className="text-xl font-semibold mt-1">{stats?.total_documents ?? documents.length}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs text-white/60">Quizzes</p>
                <p className="text-xl font-semibold mt-1">{stats?.total_quizzes_taken ?? 0}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs text-white/60">Avg Score</p>
                <p className="text-xl font-semibold mt-1">{Math.round(((stats?.average_score ?? 0) as number) * 100)}%</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs text-white/60">Mastered</p>
                <p className="text-xl font-semibold mt-1">{stats?.topics_mastered ?? 0}</p>
              </div>
              <div className="col-span-2">
                <Button
                  variant="outline"
                  className="w-full border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                  onClick={() => void handleResetProgress()}
                >
                  Reset Progress
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bento-card border-white/15 bg-white/[0.04] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white/90 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                Next Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-white/60">No pending tasks. Open Planner to generate a timetable.</p>
              ) : (
                pendingTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
                    <p className="text-sm font-medium">{task.subject}</p>
                    <p className="text-xs text-white/70">{formatTaskType(task.task_type)}{task.focus_topic ? ` • ${task.focus_topic}` : ""}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDateTime(task.start_time ?? task.due_date)}</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />{task.estimated_minutes} min</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
