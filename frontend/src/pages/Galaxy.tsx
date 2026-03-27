import { useEffect, useMemo, useState } from "react";
import { motion, useAnimation, useMotionValue } from "motion/react";
import { CONSTELLATIONS } from "@/data/constellations";
import { apiClient, getApiErrorMessage } from "@/services/api";
import { toast } from "sonner";

const VIEWBOX_WIDTH = 1920;
const VIEWBOX_HEIGHT = 1280;

// Increased scale and distance for the larger footprint
const STAR_SCALE = 2.0; 
const MIN_LAYOUT_DISTANCE = 420; 

const mulberry32 = (seed: number) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export default function Galaxy() {
  const [userStreak, setUserStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const controls = useAnimation();
  const DEBUG_STREAK: number | null = null;

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

  const { constellationProgress, layout } = useMemo(() => {
    const rng = mulberry32(0x1a7a2c1d);

    const shuffledConstellations = [...CONSTELLATIONS];
    for (let i = shuffledConstellations.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledConstellations[i], shuffledConstellations[j]] = [
        shuffledConstellations[j],
        shuffledConstellations[i],
      ];
    }

    let remaining = Math.max(0, effectiveStreak);
    const progress = shuffledConstellations.map((constellation) => {
      const total = constellation.stars.length;
      const visibleCount = Math.min(total, remaining);
      const isFinished = remaining >= total;
      const isActive = remaining > 0 && !isFinished;
      remaining = Math.max(0, remaining - total);
      return { constellation, isFinished, isActive, visibleCount };
    });

    const points: Array<{ x: number; y: number; scale: number }> = [];
    let angle = 0;
    const angleStep = 0.4; 
    const radiusStep = 22; 

    for (let i = 0; i < shuffledConstellations.length; i += 1) {
      let placed = false;
      while (!placed) {
        const r = angle * radiusStep;
        const nextX = VIEWBOX_WIDTH / 2 + r * Math.cos(angle);
        const nextY = VIEWBOX_HEIGHT / 2 + r * Math.sin(angle);

        const isClear = points.every((point) => {
          const dx = point.x - nextX;
          const dy = point.y - nextY;
          return Math.sqrt(dx * dx + dy * dy) >= MIN_LAYOUT_DISTANCE;
        });

        if (isClear) {
          points.push({
            x: nextX,
            y: nextY,
            scale: STAR_SCALE + rng() * 0.3,
          });
          placed = true;
        }
        angle += angleStep;
      }
    }
    return { constellationProgress: progress, layout: points };
  }, [effectiveStreak]);

  const completedCount = constellationProgress.filter((item) => item.isFinished).length;

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setScale((prevScale) => {
      const zoomSensitivity = 0.0012;
      const newScale = Math.min(Math.max(0.3, prevScale - e.deltaY * zoomSensitivity), 6); 
      
      const ratio = newScale / prevScale;
      const currentX = x.get();
      const currentY = y.get();
      
      x.set(currentX - ((mouseX - centerX) - currentX) * (ratio - 1));
      y.set(currentY - ((mouseY - centerY) - currentY) * (ratio - 1));
      
      return newScale;
    });
  };

  const handleResetView = () => {
    setScale(1);
    controls.start({ 
      x: 0, 
      y: 0,
      transition: { type: "spring", stiffness: 150, damping: 20, mass: 0.8 }
    });
  };

  const panLimit = Math.max(VIEWBOX_WIDTH, VIEWBOX_HEIGHT) * scale * 3.5;

  return (
    <div className="h-full max-h-[calc(100vh-2rem)] text-white p-6 md:p-10 relative flex flex-col bg-transparent overflow-hidden">
      
      <style>
        {`
          @keyframes twinkle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          .star-twinkle {
            animation: twinkle 3s ease-in-out infinite;
          }
          .name-glow {
            filter: drop-shadow(0 0 8px rgba(147, 197, 253, 0.8));
          }
        `}
      </style>

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

      <div 
        onWheel={handleWheel}
        className="relative z-10 flex-1 min-h-0 w-full rounded-[28px] border border-slate-800/80 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] overflow-hidden cursor-grab active:cursor-grabbing flex items-center justify-center"
        style={{
          backgroundImage: `radial-gradient(circle at center, rgba(15, 23, 42, 0.8) 0%, rgba(2, 6, 23, 1) 100%), url('https://www.transparenttextures.com/patterns/stardust.png')`,
          backgroundBlendMode: 'screen'
        }}
      >
        <button
          onClick={handleResetView}
          className="absolute bottom-6 right-6 z-20 p-3 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all shadow-lg backdrop-blur-sm group"
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
          dragConstraints={{ top: -panLimit, bottom: panLimit, left: -panLimit, right: panLimit }}
          dragElastic={0.03}
          dragMomentum={false}
          animate={controls}
          style={{ x, y, scale }}
          className="w-[220%] h-[220%] shrink-0 relative z-10 flex items-center justify-center origin-center"
        >
          <svg
            className="w-full h-full overflow-visible"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <rect 
              x="-15000" 
              y="-15000" 
              width="30000" 
              height="30000" 
              fill="transparent" 
              pointerEvents="all"
            />
            {constellationProgress.map(({ constellation, isFinished, isActive, visibleCount }, index) => {
              if (!isFinished && !isActive) return null;

              const placement = layout[index];
              const localScale = placement?.scale ?? STAR_SCALE;

              const project = (star: { x: number; y: number }) => ({
                x: (placement?.x ?? VIEWBOX_WIDTH / 2) + (star.x - 50) * localScale,
                y: (placement?.y ?? VIEWBOX_HEIGHT / 2) + (star.y - 50) * localScale,
              });

              const visibleStars = constellation.stars.slice(0, Math.max(visibleCount, 0));
              const anchor = project(constellation.stars[0]);
              const artworkX = (placement?.x ?? VIEWBOX_WIDTH / 2) - 50 * localScale;
              const artworkY = (placement?.y ?? VIEWBOX_HEIGHT / 2) - 50 * localScale;

              return (
                <motion.g 
                  key={constellation.name}
                  whileHover="hovered"
                  initial="initial"
                  className="cursor-default"
                >
                  {isFinished && constellation.artwork && (
                    <motion.image
                      href={constellation.artwork}
                      x={artworkX}
                      y={artworkY}
                      width={100 * localScale}
                      height={100 * localScale}
                      preserveAspectRatio="xMidYMid meet"
                      variants={{
                        initial: { opacity: 0.35 },
                        hovered: { opacity: 0.8, transition: { duration: 0.3 } }
                      }}
                    />
                  )}

                  {isFinished && constellation.lines.map((line, i) => {
                    const startPos = project(constellation.stars[line[0]]);
                    const endPos = project(constellation.stars[line[1]]);
                    return (
                      <motion.line
                        key={`${constellation.name}-line-${i}`}
                        x1={startPos.x} y1={startPos.y} x2={endPos.x} y2={endPos.y}
                        stroke="rgba(191, 219, 254, 0.8)"
                        strokeWidth="2.2"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, delay: i * 0.05 }}
                      />
                    );
                  })}

                  {visibleStars.map((star, i) => {
                    const point = project(star);
                    return (
                      <motion.circle
                        key={`${constellation.name}-${i}`}
                        cx={point.x} cy={point.y}
                        r={isFinished ? "3.5" : "5.5"}
                        variants={{
                          initial: { fill: isFinished ? "#cbd5e1" : "#60a5fa", scale: 1 },
                          hovered: { fill: "#fff", scale: 1.2, transition: { duration: 0.2 } }
                        }}
                        className="star-twinkle"
                        style={{ animationDelay: `${(i * 0.4) % 3}s` }}
                      />
                    );
                  })}

                  {isFinished && (
                    <motion.text
                      x={anchor.x}
                      y={anchor.y - 28}
                      className="fill-slate-400 text-[20px] uppercase tracking-widest font-semibold pointer-events-none"
                      variants={{
                        initial: { fill: "#94a3b8", opacity: 1 },
                        hovered: { fill: "#fff", opacity: 1, transition: { duration: 0.2 } }
                      }}
                    >
                      {constellation.name}
                    </motion.text>
                  )}
                </motion.g>
              );
            })}
          </svg>
        </motion.div>
      </div>
    </div>
  );
}