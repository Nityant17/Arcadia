import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  BookOpen,
  Calendar,
  Flame,
  Loader2,
  RefreshCw,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface TopicMastery {
  topic: string;
  progress: number;
  level: string;
}

interface Stats {
  totalDocs: number;
  quizzesTaken: number;
  averageScore: number;
  studyStreak: number;
}

interface ActivityPoint {
  date: string;
  count: number;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function activityColor(value: number) {
  if (value >= 6) return "bg-arcadia-teal";
  if (value >= 3) return "bg-arcadia-teal/85";
  if (value >= 1) return "bg-arcadia-teal/65";
  return "bg-white/10";
}

function progressColor(value: number) {
  if (value >= 70) return "[&>div]:bg-arcadia-teal";
  if (value >= 40) return "[&>div]:bg-[oklch(0.82_0.16_84)]";
  return "[&>div]:bg-destructive";
}

export default function DashboardPage() {
  const { currentLanguage } = useAppStore();

  const [stats, setStats] = useState<Stats | null>(null);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [masteryLoading, setMasteryLoading] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [activityHeatmap, setActivityHeatmap] = useState<ActivityPoint[]>([]);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [weakTopics, setWeakTopics] = useState<Array<{ topic: string; weakness: number }>>([]);

  const loadDashboard = useCallback(async () => {
    setStatsLoading(true);
    setMasteryLoading(true);

    try {
      const [dashboardRes, plannerRes] = await Promise.all([
        apiClient.getDashboardStats(),
        apiClient.getPlannerTasks(),
      ]);
      const payload = dashboardRes.data;

      setStats({
        totalDocs: payload.stats.total_documents,
        quizzesTaken: payload.stats.total_quizzes_taken,
        averageScore: payload.stats.average_score,
        studyStreak: payload.stats.study_streak,
      });

      setMastery(
        payload.mastery.map((item) => ({
          topic: item.topic,
          progress: Math.round(item.mastery_score * 100),
          level: `Tier ${item.tier_unlocked}`,
        })),
      );

      const pendingCount = plannerRes.data.tasks.filter((task) => task.status === "pending").length;
      setPendingTasks(pendingCount);

      const todayKey = toLocalDateKey(new Date());
      const heatmapMap = new Map(
        plannerRes.data.activity_heatmap.map((point) => [point.date, point.count]),
      );
      const hasEngagement =
        (payload.stats.total_documents || 0) > 0 ||
        (payload.stats.total_quizzes_taken || 0) > 0 ||
        pendingCount > 0;
      if (hasEngagement && !heatmapMap.has(todayKey)) {
        heatmapMap.set(todayKey, 1);
      }
      setActivityHeatmap(
        Array.from(heatmapMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count })),
      );

      setWeakTopics(
        plannerRes.data.weak_topics
          .sort((a, b) => b.weakness_score - a.weakness_score)
          .slice(0, 4)
          .map((topic) => ({
            topic: topic.topic,
            weakness: Math.round(topic.weakness_score * 100),
          })),
      );
    } catch {
      toast.error("Failed to load dashboard statistics");
      setStats(null);
      setMastery([]);
      setActivityHeatmap([]);
      setPendingTasks(0);
      setWeakTopics([]);
    } finally {
      setStatsLoading(false);
      setMasteryLoading(false);
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleReset() {
    setResetLoading(true);
    try {
      await apiClient.resetDashboard();
      toast.success("Progress reset successfully");
      await loadDashboard();
    } catch {
      toast.error("Failed to reset dashboard progress");
    } finally {
      setResetLoading(false);
    }
  }

  const statCards = [
    {
      label: "Total Documents",
      value: stats?.totalDocs ?? 0,
      icon: <BookOpen className="w-5 h-5" />,
      color: "text-arcadia-teal",
    },
    {
      label: "Quizzes Taken",
      value: stats?.quizzesTaken ?? 0,
      icon: <Flame className="w-5 h-5" />,
      color: "text-arcadia-magenta",
    },
    {
      label: "Average Score",
      value: stats ? `${Math.round(stats.averageScore * 100)}%` : "0%",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-arcadia-purple",
    },
    {
      label: "Pending Sessions",
      value: pendingTasks,
      icon: <Calendar className="w-5 h-5" />,
      color: "text-arcadia-blue",
    },
  ];

  const heatmapGrid = useMemo(() => {
    const today = new Date();
    const mondayThisWeek = new Date(today);
    mondayThisWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    mondayThisWeek.setHours(0, 0, 0, 0);

    const sundayThisWeek = new Date(mondayThisWeek);
    sundayThisWeek.setDate(mondayThisWeek.getDate() + 6);

    const firstDay = new Date(sundayThisWeek);
    firstDay.setDate(sundayThisWeek.getDate() - 167);

    const dateMap = new Map(activityHeatmap.map((point) => [point.date, point.count]));
    const cells: Array<{ key: string; date: string; count: number }> = [];

    for (let offset = 0; offset < 168; offset += 1) {
      const day = new Date(firstDay);
      day.setDate(firstDay.getDate() + offset);
      const key = toLocalDateKey(day);
      cells.push({ key, date: key, count: dateMap.get(key) || 0 });
    }

    return cells;
  }, [activityHeatmap]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
      data-ocid="dashboard.page"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {currentLanguage?.flag} {currentLanguage?.name} · Learning analytics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="glass-card rounded-2xl p-5 flex items-center gap-4"
          >
            <div
              className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 ${card.color}`}
            >
              {card.icon}
            </div>
            <div>
              {statsLoading ? (
                <Skeleton className="h-6 w-16 mb-1 bg-white/10" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
              )}
              <div className="text-xs text-muted-foreground">{card.label}</div>
            </div>
            {!statsLoading && (
              <button
                type="button"
                onClick={loadDashboard}
                className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-foreground">Topic Mastery</h2>
          <button
            type="button"
            onClick={loadDashboard}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {masteryLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-8 w-full bg-white/10 rounded-xl" />
            ))}
          </div>
        ) : mastery.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No mastery data yet. Take a quiz to build progress.
          </div>
        ) : (
          <div className="space-y-4">
            {mastery.map((item) => (
              <div key={item.topic} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground font-medium">{item.topic}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                      {item.level}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-arcadia-teal">{item.progress}%</span>
                </div>
                <Progress
                  value={item.progress}
                  className={`h-2 bg-white/10 ${progressColor(item.progress)}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <Badge className="bg-white/5 text-arcadia-teal border-white/10 w-fit">
              <Calendar className="w-4 h-4" />
              <span className="ml-1.5">Activity Heatmap</span>
            </Badge>
            <span className="text-xs text-muted-foreground">Last 24 weeks</span>
          </div>
          {analyticsLoading ? (
            <Skeleton className="h-24 w-full bg-white/10 rounded-xl" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-start justify-center gap-2 overflow-x-auto pb-1">
                <div className="grid grid-rows-7 gap-1 pt-0.5 text-[10px] text-muted-foreground">
                  <span className="h-[18px]">M</span>
                  <span className="h-[18px]" />
                  <span className="h-[18px]">W</span>
                  <span className="h-[18px]" />
                  <span className="h-[18px]">F</span>
                  <span className="h-[18px]" />
                  <span className="h-[18px]">S</span>
                </div>

                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: "repeat(24, max-content)" }}
                >
                  {Array.from({ length: 24 }, (_, weekIndex) => (
                    <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1">
                      {Array.from({ length: 7 }, (_, dayIndex) => {
                        const cell = heatmapGrid[weekIndex * 7 + dayIndex];
                        if (!cell) return <div key={`empty-${weekIndex}-${dayIndex}`} className="w-[18px] h-[18px]" />;

                        return (
                          <div
                            key={cell.key}
                            title={`${cell.date}: ${cell.count} activities`}
                            className={`w-[18px] h-[18px] rounded-[4px] ${cell.count > 0 ? "border border-arcadia-teal/35 shadow-sm shadow-arcadia-teal/20" : "border border-white/5"} ${activityColor(cell.count)}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground pr-1">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-white/5 border border-white/5" />
                <div className="w-3 h-3 rounded-sm bg-arcadia-teal/30 border border-white/5" />
                <div className="w-3 h-3 rounded-sm bg-arcadia-teal/60 border border-white/5" />
                <div className="w-3 h-3 rounded-sm bg-arcadia-teal/90 border border-white/5" />
                <span>More</span>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-3">Weak Areas</h2>
          {analyticsLoading ? (
            <Skeleton className="h-20 w-full bg-white/10 rounded-xl" />
          ) : weakTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No weak-topic data yet. Complete more quizzes for targeted guidance.</p>
          ) : (
            <div className="space-y-2">
              {weakTopics.map((topic) => (
                <div key={topic.topic} className="bg-white/5 rounded-lg px-3 py-2">
                  <div className="text-sm text-foreground truncate">{topic.topic}</div>
                  <div className="text-xs text-muted-foreground">Weakness: {topic.weakness}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <h2 className="font-semibold text-foreground mb-1">Reset Progress</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This clears quiz attempts, mastery, and chat history.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2" disabled={resetLoading}>
              {resetLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Reset Progress
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass border-white/15 bg-[#0B1020]/95">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Are you sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This action permanently deletes your progress data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReset}
                className="bg-destructive hover:bg-destructive/90"
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  );
}
