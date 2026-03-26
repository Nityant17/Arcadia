import { Gamepad2, Sparkles, Wrench } from "lucide-react";
import { motion } from "motion/react";

export default function GamePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      // Adjust "pt-24" higher or lower to move the card exactly where you want it
      className="flex w-full justify-center px-4 pt-24"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45 p-10 text-center backdrop-blur-xl shadow-2xl md:p-16">
        {/* Animated Background Glow */}
        <div className="absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-[80px]" />

        {/* Floating Gamepad Icon */}
        <motion.div
          animate={{ y: [-8, 8, -8] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-cyan-500/30 bg-slate-900/80 shadow-[0_0_32px_rgba(6,182,212,0.2)]"
        >
          <Gamepad2 className="h-10 w-10 text-cyan-300" />
        </motion.div>

        {/* Main Title Reveal */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-4 bg-gradient-to-r from-cyan-300 via-teal-300 to-blue-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-5xl"
        >
          New Quests Incoming...
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mx-auto max-w-md text-lg text-slate-400"
        >
          We're currently forging new challenges and leveling up the Arcadia Quest experience. Grab a health potion and check back soon!
        </motion.p>

        {/* "Under Construction" Tags */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-10 flex flex-wrap justify-center gap-3"
        >
          <div className="flex items-center gap-2 rounded-full border border-white/5 bg-slate-900/50 px-4 py-2 text-sm font-medium text-cyan-200">
            <Sparkles className="h-4 w-4" />
            <span>XP System Rewire</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/5 bg-slate-900/50 px-4 py-2 text-sm font-medium text-teal-200">
            <Wrench className="h-4 w-4" />
            <span>Building Arenas</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}