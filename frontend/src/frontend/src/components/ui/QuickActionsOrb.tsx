import { Sparkles } from "lucide-react";

export function QuickActionsOrb() {
  return (
    <div className="relative flex h-40 w-full items-center justify-center">
      <div className="absolute h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="absolute h-24 w-24 rounded-full border border-cyan-400/40 bg-slate-950/70 shadow-[0_0_30px_rgba(6,182,212,0.35)] animate-pulse" />
      <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-500/10">
        <Sparkles className="h-6 w-6 text-cyan-300" />
      </div>
    </div>
  );
}
