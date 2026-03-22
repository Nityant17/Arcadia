import BentoGrid from "@/components/BentoGrid";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { Link } from "@tanstack/react-router";
import { BookOpen, Brain, Globe, Sparkles, Star } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

const GLYPHS = [
  {
    id: "globe",
    icon: <Globe className="w-5 h-5" />,
    color: "text-arcadia-teal",
    bg: "bg-[oklch(0.78_0.16_196)]/15",
    x: "right-8",
    y: "top-6",
  },
  {
    id: "brain",
    icon: <Brain className="w-5 h-5" />,
    color: "text-arcadia-purple",
    bg: "bg-[oklch(0.60_0.20_264)]/15",
    x: "right-20",
    y: "top-16",
  },
  {
    id: "star",
    icon: <Star className="w-5 h-5" />,
    color: "text-arcadia-magenta",
    bg: "bg-[oklch(0.62_0.22_340)]/15",
    x: "right-4",
    y: "top-24",
  },
  {
    id: "sparkles",
    icon: <Sparkles className="w-5 h-5" />,
    color: "text-arcadia-blue",
    bg: "bg-[oklch(0.62_0.18_240)]/15",
    x: "right-24",
    y: "top-32",
  },
];

export default function HomePage() {
  const { currentUser, currentLanguage } = useAppStore();
  const [hasDocuments, setHasDocuments] = useState(false);
  const [avgScore, setAvgScore] = useState(0);
  const [sessionLabel, setSessionLabel] = useState("AI Session");
  const [sessionSubtitle, setSessionSubtitle] = useState("Review weak topics and continue your study flow");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [docsResponse, statsResponse] = await Promise.all([
          apiClient.listDocuments(),
          apiClient.getDashboardStats(),
        ]);
        setHasDocuments(docsResponse.data.total > 0);
        setAvgScore(Math.round((statsResponse.data.stats.average_score || 0) * 100));

        const topDoc = docsResponse.data.documents[0];
        const topSubject = (topDoc?.subject || "General").trim() || "General";
        const topic = (topDoc?.topic || "Core Concepts").trim() || "Core Concepts";
        setSessionLabel(`${topSubject} | ${Math.max(1, statsResponse.data.stats.topics_mastered)} topics`);
        setSessionSubtitle(`${topic} · Personalized AI study plan`);
      } catch {
        setHasDocuments(false);
        setAvgScore(0);
        setSessionLabel("AI Session");
        setSessionSubtitle("Review weak topics and continue your study flow");
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass rounded-3xl p-8 relative overflow-hidden"
        data-ocid="home.hero.card"
      >
        {GLYPHS.map((glyph, index) => (
          <motion.div
            key={glyph.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 + index * 0.1, duration: 0.35 }}
            className={`absolute ${glyph.x} ${glyph.y} w-10 h-10 ${glyph.bg} rounded-xl flex items-center justify-center ${glyph.color} backdrop-blur-sm border border-white/10`}
          >
            {glyph.icon}
          </motion.div>
        ))}

        <div className="max-w-[640px]">
          <Badge className="bg-[oklch(0.78_0.16_196)]/15 text-arcadia-teal border-[oklch(0.78_0.16_196)]/25 text-xs mb-4">
            ✦ Welcome back
          </Badge>
          <h1 className="text-5xl font-bold text-foreground leading-tight mb-3">
            Hello, {currentUser?.name ?? "Alex"}. ✦
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[oklch(0.78_0.16_196)] to-[oklch(0.66_0.22_304)]">
              Your AI study sprint
            </span>
            <br />
            starts now.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-[560px]">
            Learn from your uploaded notes with contextual tutoring,
            adaptive quizzes, and generated study materials.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="mt-6 flex items-center justify-between bg-white/5 rounded-2xl px-5 py-3.5 border border-white/10"
          data-ocid="home.continue_learning.card"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{currentLanguage?.flag ?? "🇯🇵"}</span>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {sessionLabel} | {avgScore}% Complete
              </div>
              <div className="text-xs text-muted-foreground">
                {hasDocuments
                  ? sessionSubtitle
                  : "Upload notes to unlock a personalized study session"}
              </div>
            </div>
          </div>
          <Button
            asChild
            className="bg-foreground text-[#0B1020] font-semibold text-sm px-6 rounded-full hover:bg-white/90 shrink-0"
            data-ocid="home.start_session.button"
          >
            <Link to={hasDocuments ? "/chat" : "/notes"}>
              <BookOpen className="w-4 h-4 mr-2" />
              Start Session
            </Link>
          </Button>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <h2 className="text-sm font-semibold text-arcadia-teal uppercase tracking-widest">
          Your Dashboard
        </h2>
        <div className="flex-1 h-px bg-white/8" />
      </motion.div>

      <BentoGrid />
      <Footer />
    </div>
  );
}
