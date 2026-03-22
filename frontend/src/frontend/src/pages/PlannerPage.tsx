import { Button } from "@/components/ui/button";
import { apiClient, type PlannerSubjectStat, type PlannerTask } from "@/services/api";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

function getMonday(referenceDate: Date) {
  const date = new Date(referenceDate);
  const day = date.getDay();
  date.setDate(date.getDate() - ((day + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date;
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
  const [sessions, setSessions] = useState<Map<string, string>>(new Map());
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [availableSubjects, setAvailableSubjects] = useState<PlannerSubjectStat[]>([]);
  const [allTasks, setAllTasks] = useState<PlannerTask[]>([]);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planInputs, setPlanInputs] = useState<
    Record<string, { examDate: string; weeklyHours: number }>
  >({});
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, boolean>>({});
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const dates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const nextDate = new Date(weekStart);
        nextDate.setDate(weekStart.getDate() + i);
        return nextDate;
      }),
    [weekStart],
  );

  function cellKey(day: number, hour: number) {
    return `${day}-${hour}`;
  }

  function handleCellClick(day: number, hour: number) {
    setEditing({ day, hour, value: sessions.get(cellKey(day, hour)) ?? "" });
  }

  function getDefaultExamDate() {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  }

  function applyTasksToGrid(tasks: PlannerTask[], anchorWeek: Date) {
    const next = new Map<string, string>();
    const weekEnd = new Date(anchorWeek);
    weekEnd.setDate(anchorWeek.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    for (const task of tasks) {
      if (task.status !== "pending") continue;
      const due = new Date(task.due_date);
      if (Number.isNaN(due.getTime())) continue;

      if (due < anchorWeek || due > weekEnd) continue;

      const weekday = (due.getDay() + 6) % 7;
      const hour = due.getHours();
      if (weekday < 0 || weekday > 6 || hour < 8 || hour > 21) continue;

      const focus = task.focus_topic?.trim();
      const taskLabel = task.task_type.replaceAll("_", " ");
      const labelCore = focus
        ? `${task.subject}: ${focus} (${taskLabel})`
        : `${task.subject}: ${taskLabel}`;

      const key = cellKey(weekday, hour);
      const current = next.get(key);
      next.set(key, current ? `${current} · ${labelCore}` : labelCore);
    }

    setSessions(next);
  }

  function prettyDate(date: Date) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  async function loadPlannerData() {
    setPlannerLoading(true);
    try {
      const response = await apiClient.getPlannerTasks();
      setAvailableSubjects(response.data.available_subjects);
      setAllTasks(response.data.tasks);

      const pendingTasks = response.data.tasks
        .filter((task) => task.status === "pending")
        .map((task) => new Date(task.due_date))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      const anchorWeek = pendingTasks.length > 0 ? getMonday(pendingTasks[0]) : getMonday(new Date());
      setWeekStart(anchorWeek);
      applyTasksToGrid(response.data.tasks, anchorWeek);

      setPlanInputs((prev) => {
        const next = { ...prev };
        for (const subject of response.data.available_subjects) {
          if (!next[subject.subject]) {
            next[subject.subject] = {
              examDate: getDefaultExamDate(),
              weeklyHours: 4,
            };
          }
        }
        return next;
      });

      setSelectedSubjects((prev) => {
        const next = { ...prev };
        for (const subject of response.data.available_subjects) {
          if (next[subject.subject] === undefined) {
            next[subject.subject] = true;
          }
        }
        return next;
      });
    } catch {
      toast.error("Failed to load planner data");
    } finally {
      setPlannerLoading(false);
    }
  }

  async function generatePlan() {
    const normalizedDate = (value?: string) => {
      if (!value || Number.isNaN(new Date(value).getTime())) return getDefaultExamDate();
      return value.slice(0, 10);
    };

    const normalizedHours = (value?: number) => {
      if (!Number.isFinite(value)) return 4;
      return Math.max(1, Math.min(40, Math.round(value ?? 4)));
    };

    const subjects = availableSubjects
      .filter((subject) => selectedSubjects[subject.subject])
      .map((subject) => ({
        subject: subject.subject,
        exam_date: normalizedDate(planInputs[subject.subject]?.examDate),
        weekly_hours: normalizedHours(planInputs[subject.subject]?.weeklyHours),
      }))
      .filter((item) => item.subject.trim().length > 0);

    if (subjects.length === 0) {
      toast.error("Upload documents first so Arcadia can plan by subject");
      return;
    }

    setGeneratingPlan(true);
    try {
      await apiClient.createPlannerPlan({
        title: "AI Timetable",
        subjects,
      });
      await loadPlannerData();
      toast.success("AI timetable generated");
    } catch {
      toast.error("Failed to generate AI timetable");
    } finally {
      setGeneratingPlan(false);
    }
  }

  useEffect(() => {
    loadPlannerData();
  }, []);

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

  function goToPreviousWeek() {
    const next = new Date(weekStart);
    next.setDate(next.getDate() - 7);
    setWeekStart(next);
    applyTasksToGrid(allTasks, next);
  }

  function goToNextWeek() {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
    applyTasksToGrid(allTasks, next);
  }

  const upcomingTasks = useMemo(
    () => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      return allTasks
        .filter((task) => task.status === "pending")
        .filter((task) => {
          const due = new Date(task.due_date);
          if (Number.isNaN(due.getTime())) return false;
          return due >= weekStart && due <= weekEnd;
        })
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 8);
    },
    [allTasks, weekStart],
  );

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
            Set exam date + weekly hours per subject, then click Plan For Me.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/10 text-sm"
            onClick={loadPlannerData}
            disabled={plannerLoading}
            data-ocid="planner.refresh.button"
          >
            {plannerLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Refresh
          </Button>
          <Button
            className="bg-arcadia-teal text-[#0B1020] hover:bg-arcadia-cyan"
            onClick={generatePlan}
            disabled={generatingPlan || availableSubjects.length === 0}
            data-ocid="planner.generate.button"
          >
            {generatingPlan ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : null}
            Plan For Me
          </Button>
          <Button
            variant="outline"
            className="border-white/10 text-sm"
            onClick={clearAll}
            data-ocid="planner.clear.button"
          >
            Clear All
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          AI Planning Inputs
        </div>
        <p className="text-sm text-foreground/90 mb-3">
          Choose the subjects you want to include, then set exam date and weekly hours for each selected subject.
        </p>
        {availableSubjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Upload notes first. Arcadia will detect subjects and generate a timetable automatically.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Button
                size="sm"
                variant="outline"
                className="border-white/10"
                onClick={() =>
                  setSelectedSubjects(
                    Object.fromEntries(availableSubjects.map((subject) => [subject.subject, true])),
                  )
                }
              >
                Select all
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/10"
                onClick={() =>
                  setSelectedSubjects(
                    Object.fromEntries(availableSubjects.map((subject) => [subject.subject, false])),
                  )
                }
              >
                Clear selection
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableSubjects.map((subject) => (
              <div key={subject.subject} className={`glass-card rounded-xl p-3 space-y-2 border ${selectedSubjects[subject.subject] ? "border-[oklch(0.78_0.16_196)]/30" : "border-white/10 opacity-80"}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selectedSubjects[subject.subject]}
                    onChange={(event) =>
                      setSelectedSubjects((prev) => ({
                        ...prev,
                        [subject.subject]: event.target.checked,
                      }))
                    }
                    className="accent-[oklch(0.78_0.16_196)]"
                  />
                  <div className="text-sm font-semibold text-foreground">{subject.subject}</div>
                </label>
                <div className="text-xs text-muted-foreground">
                  {subject.documents} docs · {subject.chunks} chunks
                </div>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className="text-[11px] text-muted-foreground">Exam date</span>
                    <input
                    type="date"
                    className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-sm text-foreground disabled:opacity-50"
                    disabled={!selectedSubjects[subject.subject]}
                    value={planInputs[subject.subject]?.examDate || getDefaultExamDate()}
                    onChange={(event) =>
                      setPlanInputs((prev) => ({
                        ...prev,
                        [subject.subject]: {
                          examDate: event.target.value,
                          weeklyHours: prev[subject.subject]?.weeklyHours || 4,
                        },
                      }))
                    }
                  />
                  </label>
                  <label className="w-28">
                    <span className="text-[11px] text-muted-foreground">Hours/week</span>
                    <input
                    type="number"
                    min={1}
                    max={40}
                    className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-sm text-foreground disabled:opacity-50"
                    disabled={!selectedSubjects[subject.subject]}
                    value={planInputs[subject.subject]?.weeklyHours || 4}
                    onChange={(event) =>
                      setPlanInputs((prev) => ({
                        ...prev,
                        [subject.subject]: {
                          examDate: prev[subject.subject]?.examDate || getDefaultExamDate(),
                          weeklyHours: Number(event.target.value || 4),
                        },
                      }))
                    }
                  />
                  </label>
                </div>
              </div>
            ))}
            </div>
          </>
        )}
      </div>

      <div className="glass-card rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-foreground">Week View</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-white/10" size="sm" onClick={goToPreviousWeek}>
              Prev
            </Button>
            <span className="text-xs text-muted-foreground min-w-[130px] text-center">
              {prettyDate(dates[0])} - {prettyDate(dates[6])}
            </span>
            <Button variant="outline" className="border-white/10" size="sm" onClick={goToNextWeek}>
              Next
            </Button>
          </div>
        </div>

        {upcomingTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks in this week. Use Prev/Next or click Plan For Me to generate your timetable.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {upcomingTasks.map((task) => (
              <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground">
                <div className="font-medium truncate">{task.subject} · {task.focus_topic || "General"}</div>
                <div className="text-xs text-arcadia-teal truncate">{task.task_type.replaceAll("_", " ")}</div>
                <div className="text-xs text-muted-foreground">{new Date(task.due_date).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
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
                    {dates[i].getDate()}
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
