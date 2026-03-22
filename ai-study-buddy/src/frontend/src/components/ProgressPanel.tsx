import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Calendar, Flame, TrendingUp } from "lucide-react";
import { type UserSession } from "../lib/api";
import { useGetPlanTasks, useGetStudyProgress } from "../hooks/useQueries";

type Props = {
  session: UserSession;
};

export default function ProgressPanel({ session }: Props) {
  const { data: dashboard, isLoading: dashboardLoading } = useGetStudyProgress(session.token);
  const { data: planner, isLoading: plannerLoading } = useGetPlanTasks(session.token, session.user_id);

  const stats = dashboard?.stats ?? {
    total_documents: 0,
    total_quizzes_taken: 0,
    average_score: 0,
    topics_mastered: 0,
  };
  const mastery = dashboard?.mastery ?? [];
  const tasks = planner?.tasks ?? [];
  const pending = tasks.filter((t: { status: string }) => t.status !== "completed");

  const loading = dashboardLoading || plannerLoading;

  return (
    <Card className="bento-card flex flex-col h-[calc(100vh-9.5rem)] border-white/15 bg-white/[0.04] text-white">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-300" />
          Progress & Planner
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-white/10 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-white/[0.08] rounded-lg px-3 py-2 border border-white/10">
                  <p className="text-xs text-white/60">Docs</p>
                  <p className="font-display font-bold text-lg">{stats.total_documents}</p>
                </div>
                <div className="bg-white/[0.08] rounded-lg px-3 py-2 border border-white/10">
                  <p className="text-xs text-white/60">Quizzes</p>
                  <p className="font-display font-bold text-lg">{stats.total_quizzes_taken}</p>
                </div>
                <div className="bg-white/[0.08] rounded-lg px-3 py-2 border border-white/10">
                  <p className="text-xs text-white/60">Avg Score</p>
                  <p className="font-display font-bold text-lg">{Math.round((stats.average_score ?? 0) * 100)}%</p>
                </div>
                <div className="bg-white/[0.08] rounded-lg px-3 py-2 border border-white/10">
                  <p className="text-xs text-white/60">Mastered</p>
                  <p className="font-display font-bold text-lg">{stats.topics_mastered}</p>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-semibold text-white/55 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Pending Timetable
                </h3>
                <div className="space-y-2">
                  {pending.slice(0, 6).map((t: { id: string; subject: string; task_type: string; estimated_minutes: number }) => (
                    <div key={t.id} className="bg-white/[0.08] rounded-lg px-3 py-2 border border-white/10">
                      <p className="text-sm font-medium">{t.subject}</p>
                      <p className="text-xs text-white/60">{t.task_type} · {t.estimated_minutes} min</p>
                    </div>
                  ))}
                  {pending.length === 0 && (
                    <p className="text-xs text-white/60">No pending tasks yet.</p>
                  )}
                </div>
              </div>

              <div className="mb-2">
                <h3 className="text-xs font-semibold text-white/55 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  Top Mastery Topics
                </h3>
                {mastery.length === 0 ? (
                  <p className="text-xs text-white/60">Take quizzes to build mastery signals.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {mastery.slice(0, 8).map((m: { topic: string; mastery_score: number }, i: number) => (
                      <Badge key={`${m.topic}-${i}`} variant="secondary" className="text-xs cursor-default">
                        {m.topic} · {Math.round((m.mastery_score ?? 0) * 100)}%
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-white/55">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                Keep your streak alive by completing at least one task daily.
              </div>
            </>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
