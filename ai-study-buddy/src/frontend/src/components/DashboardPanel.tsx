import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { UserSession } from "../lib/api";
import { resetProgress } from "../lib/api";
import { useGetStudyProgress } from "../hooks/useQueries";

type Props = {
  session: UserSession;
};

export default function DashboardPanel({ session }: Props) {
  const { data, isLoading, refetch } = useGetStudyProgress(session.token);
  const stats = data?.stats;
  const mastery = data?.mastery ?? [];

  const handleReset = async () => {
    const ok = window.confirm("Reset all progress? This removes quiz attempts, mastery history, chat history, and cached audio.");
    if (!ok) return;
    try {
      await resetProgress(session.token);
      await refetch();
      toast.success("Progress reset complete");
    } catch (error) {
      toast.error(`Reset failed: ${String(error)}`);
    }
  };

  return (
    <Card className="bento-card border-white/15 bg-white/[0.04] text-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-white">Progress Dashboard</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]" onClick={() => void refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" className="border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20" onClick={() => void handleReset()}>
              Reset Progress
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-white/60 text-sm">Loading dashboard...</div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs text-white/60">Documents</p>
                <p className="text-2xl font-semibold mt-1">{stats?.total_documents ?? 0}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs text-white/60">Quizzes</p>
                <p className="text-2xl font-semibold mt-1">{stats?.total_quizzes_taken ?? 0}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs text-white/60">Average Score</p>
                <p className="text-2xl font-semibold mt-1">{Math.round((stats?.average_score ?? 0) * 100)}%</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs text-white/60">Mastered Topics</p>
                <p className="text-2xl font-semibold mt-1">{stats?.topics_mastered ?? 0}</p>
              </div>
            </div>

            <div className="rounded-lg border border-white/12 bg-white/[0.05] p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-300" />
                Topic Mastery
              </h3>
              {mastery.length === 0 ? (
                <p className="text-sm text-white/60">No mastery data yet. Take quizzes to populate this dashboard.</p>
              ) : (
                <div className="space-y-2">
                  {mastery.slice(0, 12).map((item: { topic: string; mastery_score: number; tier_unlocked: number; total_attempts: number }, idx: number) => {
                    const percent = Math.round((item.mastery_score ?? 0) * 100);
                    return (
                      <div key={`${item.topic}-${idx}`} className="rounded-md border border-white/10 bg-white/[0.04] p-2.5">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-indigo-300" /> {item.topic}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-1.5">
                          <div className="h-2 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
                        </div>
                        <p className="text-xs text-white/60">Tier {item.tier_unlocked} unlocked • {item.total_attempts} attempts</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
