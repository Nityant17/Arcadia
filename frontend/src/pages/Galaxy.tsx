import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { CONSTELLATIONS } from "@/data/constellations";
import { apiClient, getApiErrorMessage } from "@/services/api";
import { toast } from "sonner";

export default function Galaxy() {
  const [userStreak, setUserStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const galaxyBoundsRef = useRef<HTMLDivElement>(null);

  const DEBUG_STREAK: number | null = 120;

  useEffect(() => {
    let mounted = true;
    apiClient
      .getUserStreak()
      .then((response) => {
        if (mounted) {
          setUserStreak(response.data.streak || 0);
        }
      })
      .catch((error) => {
        toast.error(getApiErrorMessage(error, "Failed to load streak"));
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveStreak = DEBUG_STREAK ?? userStreak;

  const constellationProgress = useMemo(() => {
    let remaining = Math.max(0, effectiveStreak);
    return CONSTELLATIONS.map((constellation) => {
      const total = constellation.stars.length;
      const visibleCount = Math.min(total, remaining);
      const isFinished = remaining >= total;
      const isActive = remaining > 0 && !isFinished;
      remaining = Math.max(0, remaining - total);
      return { constellation, isFinished, isActive, visibleCount };
    });
  }, [effectiveStreak]);

  const completedCount = constellationProgress.filter((item) => item.isFinished).length;

  const handleWheel = (e: React.WheelEvent) => {
    setScale((prevScale) => {
      const zoomSensitivity = 0.002;
      const newScale = prevScale - e.deltaY * zoomSensitivity;
      return Math.min(Math.max(0.5, newScale), 4); 
    });
  };

  return (
    // Changed to h-full max-h-[calc(100vh-2rem)] to strictly prevent page-level scrolling
    <div className="h-full max-h-[calc(100vh-2rem)] text-white p-6 md:p-10 relative flex flex-col bg-transparent overflow-hidden">
      
      {/* CSS for Twinkling Stars */}
      <style>
        {`
          @keyframes twinkle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          .star-twinkle {
            animation: twinkle 3s ease-in-out infinite;
          }
        `}
      </style>

      {/* Header */}
      <header className="relative z-10 w-full mb-6 shrink-0">
        <p className="text-[11px] uppercase tracking-[0.4em] text-blue-300/70">Galaxy</p>
        <h1 className="mt-3 text-3xl md:text-4xl font-extralight tracking-[0.25em] uppercase text-blue-100">
          The Infinite Library
        </h1>
        <p className="text-slate-500 font-mono text-xs mt-2">
          {loading ? "Syncing your stars..." : `Streak: ${effectiveStreak} Days · ${completedCount} Constellations Discovered`}
        </p>
        <p className="text-slate-400 text-xs mt-1">
          Log in each day to reveal a new star.
        </p>
      </header>

      {/* The Interactive Box */}
      <div 
        ref={galaxyBoundsRef} 
        onWheel={handleWheel}
        // Added min-h-0 to prevent flex blowout, removed border completely
        className="relative z-10 flex-1 min-h-0 w-full rounded-[28px] bg-slate-900/30 backdrop-blur-sm overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
      >
        <motion.div
          drag
          dragConstraints={galaxyBoundsRef}
          dragElastic={0.1}
          style={{ scale }}
          className="w-[150%] h-[150%] relative z-10 flex items-center justify-center origin-center"
        >
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
          >
            {constellationProgress.map(({ constellation, isFinished, isActive, visibleCount }) => {
              if (!isFinished && !isActive) return null;

              const visibleStars = constellation.stars.slice(0, Math.max(visibleCount, 0));

              return (
                <g key={constellation.name}>
                  {/* Lines */}
                  {isFinished
                    ? constellation.lines.map((line, index) => {
                        const start = constellation.stars[line[0]];
                        const end = constellation.stars[line[1]];
                        if (!start || !end) return null;
                        return (
                          <motion.line
                            key={`${constellation.name}-line-${index}`}
                            x1={`${start.x}%`}
                            y1={`${start.y}%`}
                            x2={`${end.x}%`}
                            y2={`${end.y}%`}
                            stroke="rgba(147, 197, 253, 0.4)"
                            strokeWidth="0.5"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1.2, delay: index * 0.05 }}
                          />
                        );
                      })
                    : null}

                  {/* Stars */}
                  {visibleStars.map((star, i) => (
                    <g key={`${constellation.name}-${i}`}>
                      <motion.circle
                        cx={`${star.x}%`}
                        cy={`${star.y}%`}
                        r={isFinished ? "1.6" : "2.6"}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                        style={{ animationDelay: `${(i * 0.4) % 3}s` }}
                        className={`star-twinkle ${isFinished ? "fill-slate-300" : "fill-blue-400"}`}
                      />
                      {/* Note: The giant r="6" pulsing circle code was completely removed from here */}
                    </g>
                  ))}

                  {/* Text */}
                  {isFinished ? (
                    <motion.text
                      x={`${constellation.stars[0].x}%`}
                      y={`${Math.max(constellation.stars[0].y - 3, 3)}%`}
                      className="fill-slate-400 text-[1.5px] uppercase tracking-widest font-semibold pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      {constellation.name} · {constellation.philosopher}
                    </motion.text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </motion.div>
      </div>
    </div>
  );
}