import { useEffect, useMemo, useState } from "react";
import { motion, useAnimation } from "motion/react";
import { CONSTELLATIONS } from "@/data/constellations";
import { apiClient, getApiErrorMessage } from "@/services/api";
import { toast } from "sonner";

export default function Galaxy() {
  const [userStreak, setUserStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  
  // We use Framer Motion's animation controls to smoothly snap the pan back to 0,0
  const controls = useAnimation();

  const DEBUG_STREAK: number | null = 160;

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
  const gridCols = 5;
  const cellWidth = 40;
  const cellHeight = 28;
  const rows = Math.ceil(CONSTELLATIONS.length / gridCols);
  const viewBoxWidth = gridCols * cellWidth + 20;
  const viewBoxHeight = rows * cellHeight + 20;
  const STAR_SCALE = 0.28;

  const handleWheel = (e: React.WheelEvent) => {
    setScale((prevScale) => {
      const zoomSensitivity = 0.002;
      const newScale = prevScale - e.deltaY * zoomSensitivity;
      return Math.min(Math.max(0.5, newScale), 4); 
    });
  };

  // Snaps the zoom to 1x and triggers the animation controls to reset the X/Y drag position
  const handleResetView = () => {
    setScale(1);
    controls.start({ x: 0, y: 0 });
  };

  // Dynamic drag limits: as you zoom in (scale increases), the allowable pan area expands
  const panLimit = 600 * scale;

  return (
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
        onWheel={handleWheel}
        className="relative z-10 flex-1 min-h-0 w-full rounded-[28px] border border-slate-800/80 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: `radial-gradient(circle at center, rgba(15, 23, 42, 0.8) 0%, rgba(2, 6, 23, 1) 100%), url('https://www.transparenttextures.com/patterns/stardust.png')`,
          backgroundBlendMode: 'screen'
        }}
      >
        {/* Reset View Button */}
        <button
          onClick={handleResetView}
          className="absolute bottom-6 right-6 z-20 p-3 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all shadow-lg backdrop-blur-sm group"
          title="Reset View"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-300">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="22" y1="12" x2="18" y2="12"></line>
            <line x1="6" y1="12" x2="2" y2="12"></line>
            <line x1="12" y1="6" x2="12" y2="2"></line>
            <line x1="12" y1="22" x2="12" y2="18"></line>
          </svg>
        </button>

        <motion.div
          drag
          dragConstraints={{
            top: -panLimit,
            bottom: panLimit,
            left: -panLimit,
            right: panLimit,
          }}
          dragElastic={0.1}
          animate={controls}
          style={{ scale }}
          className="w-[150%] h-[150%] relative z-10 flex items-center justify-center origin-center"
        >
          <svg
            className="w-full h-full overflow-visible"
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {constellationProgress.map(({ constellation, isFinished, isActive, visibleCount }, index) => {
              if (!isFinished && !isActive) return null;

              const originX = 10 + (index % gridCols) * cellWidth;
              const originY = 10 + Math.floor(index / gridCols) * cellHeight;
              const project = (star: { x: number; y: number }) => ({
                x: originX + star.x * STAR_SCALE,
                y: originY + star.y * STAR_SCALE,
              });

              const visibleStars = constellation.stars.slice(0, Math.max(visibleCount, 0));

              return (
                <g key={constellation.name}>
                  {/* Lines */}
                  {isFinished
                    ? constellation.lines.map((line, index) => {
                        const start = constellation.stars[line[0]];
                        const end = constellation.stars[line[1]];
                        if (!start || !end) return null;
                        const startPos = project(start);
                        const endPos = project(end);
                        return (
                          <motion.line
                            key={`${constellation.name}-line-${index}`}
                            x1={startPos.x}
                            y1={startPos.y}
                            x2={endPos.x}
                            y2={endPos.y}
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
                  {visibleStars.map((star, i) => {
                    const point = project(star);
                    return (
                      <g key={`${constellation.name}-${i}`}>
                        <motion.circle
                          cx={point.x}
                          cy={point.y}
                          r={isFinished ? "1.0" : "2.0"}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.4, delay: i * 0.08 }}
                          style={{ animationDelay: `${(i * 0.4) % 3}s` }}
                          className={`star-twinkle ${isFinished ? "fill-slate-300" : "fill-blue-400"}`}
                        />
                      </g>
                    );
                  })}

                  {/* Text */}
                  {isFinished ? (
                    <motion.text
                      x={project(constellation.stars[0]).x}
                      y={project(constellation.stars[0]).y - 3}
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