import BentoGrid from "@/components/BentoGrid";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { BookOpen, Brain, Globe, Sparkles, Star } from "lucide-react";
import { motion } from "motion/react";

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

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass rounded-3xl p-8 relative overflow-hidden"
        data-ocid="home.hero.card"
      >
        {/* Floating glyphs */}
        {GLYPHS.map((g, i) => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
            className={`absolute ${g.x} ${g.y} w-10 h-10 ${g.bg} rounded-xl flex items-center justify-center ${g.color} backdrop-blur-sm border border-white/10`}
          >
            {g.icon}
          </motion.div>
        ))}

        <div className="max-w-lg">
          <Badge className="bg-[oklch(0.78_0.16_196)]/15 text-arcadia-teal border-[oklch(0.78_0.16_196)]/25 text-xs mb-4">
            &#x2726; Welcome back
          </Badge>
          <h1 className="text-4xl font-bold text-foreground leading-tight mb-3">
            Hello, {currentUser?.name ?? "Alex"}. &#x2726;
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[oklch(0.78_0.16_196)] to-[oklch(0.66_0.22_304)]">
              Your journey to fluency
            </span>{" "}
            begins now.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Continue building your language skills with AI-powered lessons,
            immersive practice, and personalized feedback.
          </p>
        </div>

        {/* Continue Learning strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-6 flex items-center justify-between bg-white/5 rounded-2xl px-5 py-3.5 border border-white/10"
          data-ocid="home.continue_learning.card"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{currentLanguage?.flag ?? "🇯🇵"}</span>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {currentLanguage?.name ?? "Japanese"} | N3 | 45% Complete
              </div>
              <div className="text-xs text-muted-foreground">
                Listening comprehension &middot; Unit 4
              </div>
            </div>
          </div>
          <Button
            className="bg-foreground text-[#0B1020] font-semibold text-sm px-5 rounded-full hover:bg-white/90 shrink-0"
            data-ocid="home.start_session.button"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Start Session
          </Button>
        </motion.div>
      </motion.div>

      {/* Bento section label */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Your Dashboard
        </h2>
        <div className="flex-1 h-px bg-white/8" />
      </motion.div>

      {/* Bento grid */}
      <BentoGrid />

      {/* Footer */}
      <Footer />
    </div>
  );
}
