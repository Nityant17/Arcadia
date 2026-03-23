import { motion } from "motion/react";
import type { ReactNode } from "react";

interface MacbookScrollProps {
  title: ReactNode;
  badge?: ReactNode;
  src: string;
  showGradient?: boolean;
}

export function MacbookScroll({
  title,
  badge,
  src,
  showGradient = true,
}: MacbookScrollProps) {
  return (
    <section className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/40 backdrop-blur-xl p-6 md:p-8">
      {showGradient && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.18),transparent_55%)]" />
      )}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-semibold leading-tight bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
            {title}
          </h2>
        </div>
        {badge}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 130, damping: 18 }}
        className="relative mx-auto mt-8 w-full max-w-4xl"
      >
        <div className="rounded-t-[1.6rem] border border-white/15 bg-black p-2 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
          <div className="mb-2 flex items-center gap-1.5 px-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/90" />
          </div>
          <img
            src={src}
            alt="Arcadia preview"
            className="h-[240px] md:h-[360px] w-full rounded-[1rem] object-cover object-top"
            loading="lazy"
          />
        </div>

        <div className="mx-auto h-4 w-[94%] rounded-b-[999px] bg-gradient-to-b from-zinc-300/90 to-zinc-500/80" />
      </motion.div>
    </section>
  );
}
