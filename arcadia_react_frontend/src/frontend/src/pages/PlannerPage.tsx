import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_COLORS = [
  "bg-[oklch(0.78_0.16_196)]/25 text-arcadia-teal border-[oklch(0.78_0.16_196)]/40",
  "bg-[oklch(0.60_0.20_264)]/25 text-arcadia-purple border-[oklch(0.60_0.20_264)]/40",
  "bg-[oklch(0.62_0.18_240)]/25 text-arcadia-blue border-[oklch(0.62_0.18_240)]/40",
  "bg-[oklch(0.62_0.22_340)]/25 text-arcadia-magenta border-[oklch(0.62_0.22_340)]/40",
  "bg-[oklch(0.78_0.16_196)]/20 text-arcadia-teal border-[oklch(0.78_0.16_196)]/30",
  "bg-[oklch(0.66_0.22_304)]/25 text-arcadia-purple border-[oklch(0.66_0.22_304)]/30",
  "bg-[oklch(0.82_0.14_200)]/20 text-arcadia-teal border-[oklch(0.82_0.14_200)]/30",
];

function fmt12(h: number) {
  if (h === 12) return "12 PM";
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
}

function getWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getDate();
  });
}

interface EditingCell {
  day: number;
  hour: number;
  value: string;
}

function CellModal({
  editing,
  onClose,
  onSave,
  onChange,
}: {
  editing: EditingCell;
  onClose: () => void;
  onSave: () => void;
  onChange: (val: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      aria-modal="true"
      aria-label="Edit session"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="glass rounded-2xl p-6 w-80 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground">
          {DAYS[editing.day]} &middot; {fmt12(editing.hour)}
        </h3>
        <input
          ref={inputRef}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[oklch(0.78_0.16_196)]"
          placeholder="Session label (blank to remove)"
          value={editing.value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onClose();
          }}
          data-ocid="planner.cell.input"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={onSave}
            className="flex-1 bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
            data-ocid="planner.cell.save"
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="flex-1 border-white/10"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  const [sessions, setSessions] = useState<Map<string, string>>(
    new Map([
      ["0-9", "Japanese Study"],
      ["2-14", "Spanish Review"],
      ["4-11", "Quiz Practice"],
    ]),
  );
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const dates = useMemo(() => getWeekDates(), []);

  function cellKey(day: number, hour: number) {
    return `${day}-${hour}`;
  }

  function handleCellClick(day: number, hour: number) {
    setEditing({ day, hour, value: sessions.get(cellKey(day, hour)) ?? "" });
  }

  function commitEdit() {
    if (!editing) return;
    const key = cellKey(editing.day, editing.hour);
    setSessions((prev) => {
      const next = new Map(prev);
      if (editing.value.trim()) next.set(key, editing.value.trim());
      else next.delete(key);
      return next;
    });
    setEditing(null);
  }

  function clearAll() {
    setSessions(new Map());
    setEditing(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      data-ocid="planner.page"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planner</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Click any cell to add or edit a session
          </p>
        </div>
        <Button
          variant="outline"
          className="border-white/10 text-sm"
          onClick={clearAll}
          data-ocid="planner.clear.button"
        >
          Clear All
        </Button>
      </div>

      {editing && (
        <CellModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={commitEdit}
          onChange={(val) =>
            setEditing((prev) => (prev ? { ...prev, value: val } : null))
          }
        />
      )}

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr>
              <th className="w-16 py-3 px-2 text-xs text-muted-foreground font-medium text-right pr-4 border-b border-r border-white/10" />
              {DAYS.map((d, i) => (
                <th
                  key={d}
                  className="py-3 px-2 text-xs font-semibold text-foreground text-center border-b border-r border-white/10 last:border-r-0"
                >
                  <div>{d}</div>
                  <div className="text-muted-foreground font-normal">
                    {dates[i]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h}>
                <td className="py-2 px-2 text-xs text-muted-foreground text-right pr-4 border-r border-white/10 whitespace-nowrap">
                  {fmt12(h)}
                </td>
                {DAYS.map((_, di) => {
                  const key = cellKey(di, h);
                  const label = sessions.get(key);
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: timetable cell
                    <td
                      key={`${di}-${h}`}
                      className="py-1.5 px-1.5 border-r border-b border-white/5 last:border-r-0 h-10 cursor-pointer hover:bg-white/5 transition-colors align-middle"
                      onClick={() => handleCellClick(di, h)}
                      data-ocid={`planner.cell.${di}.${h}`}
                    >
                      {label && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md border font-medium truncate block max-w-full ${DAY_COLORS[di]}`}
                        >
                          {label}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
