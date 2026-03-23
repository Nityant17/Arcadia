import { motion } from "motion/react";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface PlaceholdersAndVanishInputProps {
  placeholders: string[];
  onSubmit?: (value: string) => void;
  className?: string;
}

export function PlaceholdersAndVanishInput({
  placeholders,
  onSubmit,
  className,
}: PlaceholdersAndVanishInputProps) {
  const [value, setValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [vanish, setVanish] = useState(false);

  const activePlaceholder = useMemo(() => {
    if (placeholders.length === 0) return "Type here...";
    return placeholders[activeIndex % placeholders.length];
  }, [activeIndex, placeholders]);

  useEffect(() => {
    if (placeholders.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % placeholders.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [placeholders]);

  const submit = () => {
    if (!value.trim()) return;
    setVanish(true);
    onSubmit?.(value.trim());
    window.setTimeout(() => {
      setValue("");
      setVanish(false);
    }, 220);
  };

  return (
    <div className={`relative ${className || ""}`}>
      <motion.div
        animate={vanish ? { scale: 0.98, opacity: 0.45 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 backdrop-blur-xl"
      >
        <Search className="h-4 w-4 text-cyan-400" />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={activePlaceholder}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          aria-label="Ask Arcadia"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded-xl border border-cyan-500/30 px-2.5 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/15 hover:shadow-[0_0_14px_rgba(6,182,212,0.25)] transition-all"
        >
          Ask
        </button>
      </motion.div>
    </div>
  );
}
