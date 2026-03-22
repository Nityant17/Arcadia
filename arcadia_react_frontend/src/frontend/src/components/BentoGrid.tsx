import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  FileText,
  Layers,
  MessageSquare,
  Send,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

function CardWrap({
  children,
  className = "",
  delay = 0,
}: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className={`glass-card glass-card-hover rounded-2xl p-5 flex flex-col gap-3 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function CardHeader({
  icon,
  title,
  action,
}: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-arcadia-teal">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      {action}
    </div>
  );
}

// 1. Daily Challenge
function DailyChallengeCard() {
  const progress = 68;
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <CardWrap delay={0.05}>
      <CardHeader
        icon={<Trophy className="w-4 h-4" />}
        title="Daily Challenge"
      />
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 shrink-0">
          <svg
            width="80"
            height="80"
            className="progress-ring"
            aria-label="Progress ring"
          >
            <title>Challenge progress</title>
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="6"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="oklch(0.78 0.16 196)"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
            {progress}%
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <Badge className="bg-[oklch(0.78_0.16_196)]/20 text-arcadia-teal border-[oklch(0.78_0.16_196)]/30 text-xs w-fit">
            Japanese Quiz
          </Badge>
          <p className="text-xs text-muted-foreground">
            &#x23F1; 12 min remaining
          </p>
          <p className="text-xs text-muted-foreground">8 / 12 questions done</p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-white/10 hover:bg-white/10 text-xs mt-auto"
        data-ocid="bento.challenge.button"
      >
        Continue Quiz
      </Button>
    </CardWrap>
  );
}

// 2. My Progress
function MyProgressCard() {
  const points = [20, 45, 30, 60, 55, 80, 75, 90];
  const maxY = 90;
  const w = 200;
  const h = 48;
  const pts = points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / maxY) * h}`)
    .join(" ");

  return (
    <CardWrap delay={0.1}>
      <CardHeader
        icon={<TrendingUp className="w-4 h-4" />}
        title="My Progress"
      />
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Level", value: "N3", color: "text-arcadia-teal" },
          { label: "Streak", value: "14d 🔥", color: "text-arcadia-magenta" },
          { label: "XP Today", value: "320", color: "text-arcadia-purple" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white/5 rounded-xl p-2.5 text-center"
          >
            <div className={`text-lg font-bold ${stat.color}`}>
              {stat.value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      <svg
        width="100%"
        height="48"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <title>Progress chart</title>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="oklch(0.78 0.16 196)"
              stopOpacity="0.3"
            />
            <stop
              offset="100%"
              stopColor="oklch(0.78 0.16 196)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="oklch(0.78 0.16 196)"
          strokeWidth="2"
          points={pts}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          fill="url(#sparkGrad)"
          stroke="none"
          points={`0,${h} ${pts} ${w},${h}`}
        />
      </svg>
    </CardWrap>
  );
}

// 3. Upcoming Sessions
function UpcomingSessionsCard() {
  const sessions = [
    { flag: "🇯🇵", lang: "Japanese", time: "Today 3:00 PM", level: "N3" },
    { flag: "🇪🇸", lang: "Spanish", time: "Tomorrow 10:00 AM", level: "B2" },
    { flag: "🇫🇷", lang: "French", time: "Wed 2:00 PM", level: "A2" },
  ];

  return (
    <CardWrap delay={0.15}>
      <CardHeader
        icon={<Calendar className="w-4 h-4" />}
        title="Upcoming Sessions"
        action={
          <Badge className="bg-white/5 text-muted-foreground border-white/10 text-[10px]">
            Planner
          </Badge>
        }
      />
      <div className="flex flex-col gap-2">
        {sessions.map((s, i) => (
          <div
            key={s.lang}
            className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
            data-ocid={`bento.session.item.${i + 1}`}
          >
            <div className="flex items-center gap-2">
              <span>{s.flag}</span>
              <div>
                <div className="text-xs font-medium text-foreground">
                  {s.lang}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {s.time}
                </div>
              </div>
            </div>
            <Badge className="bg-white/5 text-muted-foreground border-white/10 text-[10px]">
              {s.level}
            </Badge>
          </div>
        ))}
      </div>
    </CardWrap>
  );
}

// 4. Active Words
function ActiveWordsCard() {
  const pts = [5, 12, 8, 15, 11, 18, 15]
    .map((v, i, arr) => `${(i / (arr.length - 1)) * 120},${28 - (v / 18) * 28}`)
    .join(" ");

  return (
    <CardWrap delay={0.2}>
      <CardHeader icon={<Zap className="w-4 h-4" />} title="Active Words" />
      <div className="flex items-end justify-between">
        <div>
          <div className="text-4xl font-bold text-foreground">15</div>
          <div className="text-xs text-arcadia-teal mt-1">
            15 new words today
          </div>
        </div>
        <svg width="120" height="32" viewBox="0 0 120 32">
          <title>Sparkline</title>
          <polyline
            fill="none"
            stroke="oklch(0.78 0.16 196)"
            strokeWidth="2"
            points={pts}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <Progress
        value={60}
        className="h-1 bg-white/10 [&>div]:bg-arcadia-teal"
      />
      <p className="text-[10px] text-muted-foreground">60% of daily goal</p>
    </CardWrap>
  );
}

// 5. Vocabulary Deck
function VocabularyDeckCard() {
  return (
    <CardWrap
      delay={0.25}
      className="bg-gradient-to-br from-[oklch(0.62_0.18_240)]/20 to-[oklch(0.60_0.20_264)]/20"
    >
      <CardHeader
        icon={<Layers className="w-4 h-4" />}
        title="Vocabulary Deck"
      />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-4xl font-bold text-foreground">15</div>
          <div className="text-xs text-muted-foreground mt-1">
            cards to review
          </div>
        </div>
        {/* Stacked card illustration */}
        <div className="relative w-16 h-20">
          {[3, 2, 1, 0].map((i) => (
            <div
              key={i}
              className="absolute w-12 h-16 rounded-lg border border-white/15"
              style={{
                background: `linear-gradient(135deg, oklch(${0.55 + i * 0.05} 0.20 264), oklch(${0.5 + i * 0.05} 0.22 304))`,
                bottom: `${i * 4}px`,
                right: `${i * 4}px`,
              }}
            />
          ))}
        </div>
      </div>
      <Button
        size="sm"
        className="bg-white/10 hover:bg-white/20 border border-white/10 text-xs mt-auto"
        data-ocid="bento.vocab.button"
      >
        Start Review
      </Button>
    </CardWrap>
  );
}

// 6. AI Tutor Chat
function AITutorCard() {
  return (
    <CardWrap delay={0.3}>
      <CardHeader
        icon={<MessageSquare className="w-4 h-4" />}
        title="AI Tutor Chat"
      />
      <div className="flex flex-col gap-2">
        <div className="bg-white/5 rounded-xl p-3 text-xs text-muted-foreground">
          <span className="text-arcadia-teal font-medium">Tutor: </span>
          &#12371;&#12435;&#12395;&#12385;&#12399;&#65281;&#20170;&#26085;&#12399;&#20309;&#12434;&#32244;&#32722;&#12375;&#12414;&#12377;&#12363;&#65311;
        </div>
        <div className="bg-[oklch(0.78_0.16_196)]/15 rounded-xl p-3 text-xs text-foreground self-end ml-8">
          I want to practice N3 grammar today.
        </div>
      </div>
      <div className="flex gap-2 mt-auto">
        <Input
          placeholder="Type a message…"
          className="bg-white/5 border-white/10 text-xs text-foreground placeholder:text-muted-foreground h-8"
          data-ocid="bento.chat.input"
        />
        <Button
          size="sm"
          className="bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan h-8 w-8 p-0"
          data-ocid="bento.chat.button"
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </CardWrap>
  );
}

// 7. Recent Notes
function RecentNotesCard() {
  const notes = [
    { id: "te-form", text: "\u3066-form conjugation rules" },
    {
      id: "n3-kanji",
      text: "N3 Kanji: \u6a5f\u4f1a\u30fb\u7d4c\u9a13\u30fb\u611f\u8b1d",
    },
    {
      id: "conditionals",
      text: "Conditional forms: \uff5e\u305f\u3089 vs \uff5e\u3070",
    },
  ];

  return (
    <CardWrap delay={0.35}>
      <CardHeader
        icon={<FileText className="w-4 h-4" />}
        title="Recent Notes"
        action={
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-ocid="bento.notes.button"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        }
      />
      <div className="flex flex-col gap-1.5">
        {notes.map((note, i) => (
          <div
            key={note.id}
            className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
            data-ocid={`bento.notes.item.${i + 1}`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-arcadia-teal shrink-0" />
            <span className="text-xs text-foreground truncate">
              {note.text}
            </span>
          </div>
        ))}
      </div>
    </CardWrap>
  );
}

// 8. New Study Module
function StudyModuleCard() {
  return (
    <CardWrap delay={0.4}>
      <CardHeader
        icon={<BookOpen className="w-4 h-4" />}
        title="New Study Module"
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🇪🇸</span>
            <span className="text-sm font-semibold text-foreground">
              Spanish Subjunctive
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Master the present subjunctive mood with guided exercises.
          </p>
          <Badge className="bg-[oklch(0.60_0.20_264)]/20 text-arcadia-purple border-[oklch(0.60_0.20_264)]/30 text-[10px] w-fit">
            Study Module
          </Badge>
        </div>
      </div>
      {/* Wavy gradient line */}
      <svg
        width="100%"
        height="12"
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <title>Decorative wave</title>
        <defs>
          <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.78 0.16 196)" />
            <stop offset="50%" stopColor="oklch(0.60 0.20 264)" />
            <stop offset="100%" stopColor="oklch(0.66 0.22 304)" />
          </linearGradient>
        </defs>
        <path
          d="M0,6 C25,2 50,10 75,6 C100,2 125,10 150,6 C175,2 200,8 200,6"
          fill="none"
          stroke="url(#waveGrad)"
          strokeWidth="2"
        />
      </svg>
      <Button
        size="sm"
        className="bg-gradient-to-r from-[oklch(0.62_0.18_240)] to-[oklch(0.60_0.20_264)] text-white text-xs mt-auto border-0"
        data-ocid="bento.study.button"
      >
        Start Module
      </Button>
    </CardWrap>
  );
}

export default function BentoGrid() {
  return (
    <section className="grid grid-cols-3 gap-4" data-ocid="bento.section">
      <DailyChallengeCard />
      <MyProgressCard />
      <UpcomingSessionsCard />
      <ActiveWordsCard />
      <VocabularyDeckCard />
      <AITutorCard />
      <RecentNotesCard />
      <StudyModuleCard />
      {/* Filler card to make it 3-column */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.45, ease: "easeOut" }}
        className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center gap-3 border-dashed"
      >
        <Trophy className="w-8 h-8 text-muted-foreground/30" />
        <span className="text-xs text-muted-foreground/50">
          More modules coming soon
        </span>
      </motion.div>
    </section>
  );
}
