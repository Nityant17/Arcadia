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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import {
  BookOpen,
  Flame,
  Loader2,
  RefreshCw,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface TopicMastery {
  topic: string;
  progress: number;
  level: string;
}

interface Stats {
  totalDocs: number;
  quizzesTaken: number;
  topicsMastered: number;
}

const MOCK_MASTERY: TopicMastery[] = [
  { topic: "Verb Conjugation", progress: 82, level: "Tier 2" },
  { topic: "Kanji N4", progress: 67, level: "Tier 1" },
  { topic: "Reading Comprehension", progress: 55, level: "Tier 1" },
  { topic: "Listening", progress: 43, level: "Tier 1" },
  { topic: "Grammar Patterns", progress: 91, level: "Tier 3" },
  { topic: "Vocabulary", progress: 34, level: "Tier 1" },
];

const MOCK_STATS: Stats = { totalDocs: 47, quizzesTaken: 14, topicsMastered: 8 };

function progressColor(v: number) {
  if (v >= 70) return "[&>div]:bg-arcadia-teal";
  if (v >= 40) return "[&>div]:bg-[oklch(0.82_0.16_84)]";
  return "[&>div]:bg-destructive";
}

export default function DashboardPage() {
  const { currentLanguage } = useAppStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [masteryLoading, setMasteryLoading] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setStatsLoading(true);
    setMasteryLoading(true);
    try {
      const response = await api.dashboard.stats();
      const data = response.data;

      const backendStats = data?.stats;
      setStats(
        backendStats
          ? {
              totalDocs: backendStats.total_documents ?? 0,
              quizzesTaken: backendStats.total_quizzes_taken ?? 0,
              topicsMastered: backendStats.topics_mastered ?? 0,
            }
          : MOCK_STATS,
      );

      const backendMastery = Array.isArray(data?.mastery) ? data.mastery : [];
      const mappedMastery: TopicMastery[] = backendMastery.map((item: any) => ({
        topic: item.topic,
        progress: Math.round((item.mastery_score ?? 0) * 100),
        level: `Tier ${item.tier_unlocked ?? 1}`,
      }));

      setMastery(mappedMastery.length > 0 ? mappedMastery : MOCK_MASTERY);
    } catch {
      setStats(MOCK_STATS);
      setMastery(MOCK_MASTERY);
      toast.error("Failed to load dashboard analytics");
    } finally {
      setStatsLoading(false);
      setMasteryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleReset() {
    setResetLoading(true);
    try {
      await api.dashboard.reset();
      toast.success("Progress reset successfully");
      await loadDashboard();
    } catch {
      toast.error("Could not reset progress");
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
      label: "Topics Mastered",
      value: stats?.topicsMastered ?? 0,
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-arcadia-purple",
    },
  ];

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
          {currentLanguage?.flag} {currentLanguage?.name} &middot; Your learning
          analytics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="glass-card rounded-2xl p-5 flex items-center gap-4"
            data-ocid={`dashboard.stat.${card.label.toLowerCase().replace(/ /g, "_")}`}
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
                <div className="text-2xl font-bold text-foreground">
                  {card.value}
                </div>
              )}
              <div className="text-xs text-muted-foreground">{card.label}</div>
            </div>
            {!statsLoading && (
              <button
                type="button"
                onClick={loadDashboard}
                className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                data-ocid="dashboard.stats.retry"
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
            data-ocid="dashboard.mastery.refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {masteryLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full bg-white/10 rounded-xl" />
            ))}
          </div>
        ) : mastery.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No mastery data yet. Start studying!
          </div>
        ) : (
          <div className="space-y-4">
            {mastery.map((item) => (
              <div
                key={item.topic}
                className="space-y-1.5"
                data-ocid={`dashboard.mastery.${item.topic.toLowerCase().replace(/ /g, "_")}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground font-medium">
                      {item.topic}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                      {item.level}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-semibold ${item.progress >= 70 ? "text-arcadia-teal" : item.progress >= 40 ? "text-[oklch(0.82_0.16_84)]" : "text-destructive"}`}
                  >
                    {item.progress}%
                  </span>
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

      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <h2 className="font-semibold text-foreground mb-1">Reset Progress</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This will erase all topic mastery data for{" "}
          {currentLanguage?.name ?? "the current language"}.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={resetLoading}
              data-ocid="dashboard.reset.button"
            >
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
              <AlertDialogTitle className="text-foreground">
                Are you sure?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will permanently delete all topic mastery data for{" "}
                {currentLanguage?.name}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10">
                Cancel
              </AlertDialogCancel>
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
