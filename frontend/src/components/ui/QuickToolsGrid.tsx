import { motion, AnimatePresence, useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  CloudUpload,
  Brain,
  MessageSquare,
  Swords,
  Calendar,
  Code2,
  NotebookPen,
  Sparkles,
} from "lucide-react";

export type QuickToolId =
  | "ask"
  | "upload"
  | "quiz"
  | "study"
  | "planner"
  | "challenge"
  | "dashboard"
  | "notes"
  | "code";

interface QuickToolsGridProps {
  onToolClick?: (toolId: QuickToolId) => void;
  disabled?: boolean;
  hidden?: boolean;
}

const toolItems: Array<{ id: QuickToolId; label: string; icon: ReactNode }> = [
  { id: "ask", label: "Ask AI", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "upload", label: "Upload Note", icon: <CloudUpload className="h-4 w-4" /> },
  { id: "quiz", label: "Quick Quiz", icon: <Brain className="h-4 w-4" /> },
  { id: "study", label: "Study", icon: <BookOpen className="h-4 w-4" /> },
  { id: "notes", label: "Notes", icon: <NotebookPen className="h-4 w-4" /> },
  { id: "challenge", label: "Challenge", icon: <Swords className="h-4 w-4" /> },
  { id: "planner", label: "Planner", icon: <Calendar className="h-4 w-4" /> },
  { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "code", label: "Code Lab", icon: <Code2 className="h-4 w-4" /> },
];

export const QuickToolsGrid = ({ onToolClick, disabled = false, hidden = false }: QuickToolsGridProps) => {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [placement, setPlacement] = useState<"tl" | "tr" | "bl" | "br">("tl");
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const BALL_SIZE = 56;
  const MARGIN = 18;
  const STORAGE_KEY = "arcadia:quicktools-position";

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!viewport.width || !viewport.height) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    let startX = viewport.width - BALL_SIZE - MARGIN;
    let startY = viewport.height - BALL_SIZE - MARGIN;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { x?: number; y?: number };
        if (typeof parsed.x === "number") startX = parsed.x;
        if (typeof parsed.y === "number") startY = parsed.y;
      } catch {
        // ignore
      }
    }
    const maxX = viewport.width - BALL_SIZE - MARGIN;
    const maxY = viewport.height - BALL_SIZE - MARGIN;
    x.set(clamp(startX, MARGIN, maxX));
    y.set(clamp(startY, MARGIN, maxY));
    setReady(true);
  }, [viewport.height, viewport.width]);

  const persistPosition = () => {
    if (!viewport.width || !viewport.height) return;
    const maxX = viewport.width - BALL_SIZE - MARGIN;
    const maxY = viewport.height - BALL_SIZE - MARGIN;
    const next = {
      x: clamp(x.get(), MARGIN, maxX),
      y: clamp(y.get(), MARGIN, maxY),
    };
    x.set(next.x);
    y.set(next.y);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (!viewport.width || !viewport.height) return;

    const updatePlacement = () => {
      const centerX = x.get() + BALL_SIZE / 2;
      const centerY = y.get() + BALL_SIZE / 2;
      const horizontal = centerX > viewport.width / 2 ? "r" : "l";
      const vertical = centerY > viewport.height / 2 ? "t" : "b";
      setPlacement(`${vertical}${horizontal}` as "tl" | "tr" | "bl" | "br");
    };

    updatePlacement();
    const unsubX = x.on("change", updatePlacement);
    const unsubY = y.on("change", updatePlacement);
    return () => {
      unsubX();
      unsubY();
    };
  }, [viewport.height, viewport.width, x, y]);

  if (!ready || hidden) return null;

  return (
    <div ref={constraintsRef} className="pointer-events-none fixed inset-0 z-50">
      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.12}
        dragMomentum={false}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => {
          persistPosition();
          window.setTimeout(() => setDragging(false), 0);
        }}
        style={{ x, y }}
        className="pointer-events-auto absolute"
      >
        <div className="relative">
          <button
            type="button"
            aria-label="Quick tools accessibility ball"
            onClick={() => {
              if (dragging) return;
              setOpen((prev) => !prev);
            }}
            disabled={disabled}
            className={`group flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-950/80 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.25)] backdrop-blur transition-all ${
              disabled ? "opacity-60 cursor-not-allowed" : "hover:scale-105 hover:bg-slate-900/90"
            }`}
          >
            <Sparkles className="h-5 w-5 text-cyan-200 transition-transform group-hover:rotate-6" />
          </button>

          <AnimatePresence>
            {open && !disabled ? (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className={`absolute w-52 rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-[0_18px_60px_rgba(2,6,23,0.6)] backdrop-blur ${
                  placement === "tl"
                    ? "bottom-16 left-0 origin-bottom-left"
                    : placement === "tr"
                      ? "bottom-16 right-0 origin-bottom-right"
                      : placement === "bl"
                        ? "top-16 left-0 origin-top-left"
                        : "top-16 right-0 origin-top-right"
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 px-2 pb-2">
                  Quick Tools
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {toolItems.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      aria-label={tool.label}
                      onClick={() => {
                        onToolClick?.(tool.id);
                        setOpen(false);
                      }}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 text-[11px] text-slate-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/10"
                    >
                      <span className="text-cyan-200">{tool.icon}</span>
                      <span className="text-[9px] tracking-wide">{tool.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
