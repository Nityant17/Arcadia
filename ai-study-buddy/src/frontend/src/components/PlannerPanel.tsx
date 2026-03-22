import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import type { UserSession } from "../lib/api";
import { createPlan } from "../lib/api";
import { useCompleteTask, useGetPlanTasks } from "../hooks/useQueries";

type Props = {
  session: UserSession;
};

type PlannerTask = {
  id: string;
  subject: string;
  task_type: string;
  focus_topic?: string;
  estimated_minutes: number;
  start_time?: string;
  due_date?: string;
  end_time?: string;
  status: string;
};

export default function PlannerPanel({ session }: Props) {
  const { data, isLoading, refetch } = useGetPlanTasks(session.token, session.user_id);
  const completeTask = useCompleteTask();
  const [title, setTitle] = useState("Exam Study Plan");
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hours, setHours] = useState("6");

  const tasks: PlannerTask[] = (data?.tasks ?? []) as PlannerTask[];
  const subjects = data?.available_subjects ?? [];
  const grouped = tasks
    .filter((t) => t.status !== "completed")
    .reduce((acc: Record<string, PlannerTask[]>, item) => {
      const key = String(item.start_time ?? item.due_date).slice(0, 10);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

  const completed = tasks.filter((t) => t.status === "completed");

  const formatTaskType = (taskType: string) => {
    if (taskType === "study_block") return "Study Block";
    if (taskType === "quiz_revision") return "Quiz Revision";
    if (taskType === "weakness_booster") return "Weakness Booster";
    if (taskType === "spaced_repetition") return "Spaced Repetition";
    return taskType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDayLabel = (isoDay: string) => {
    const parsed = new Date(isoDay);
    if (Number.isNaN(parsed.getTime())) return isoDay;
    return parsed.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  };

  const formatTime = (iso: string | undefined) => {
    if (!iso) return "--:--";
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "--:--";
    return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const generate = async () => {
    if (!subject.trim() || !examDate) {
      toast.error("Select subject and exam date");
      return;
    }
    try {
      await createPlan(session.token, {
        user_id: session.user_id,
        title,
        subjects: [{ subject, exam_date: examDate, weekly_hours: Number(hours) || 6 }],
      });
      toast.success("Timetable generated");
      refetch();
    } catch (e) {
      toast.error(`Create plan failed: ${String(e)}`);
    }
  };

  return (
    <Card className="bento-card h-[calc(100vh-9.5rem)] overflow-auto border-white/15 bg-white/[0.04] text-white">
      <CardHeader>
        <CardTitle className="text-white">Timetable Planner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-2">
          <Input className="bg-white/[0.05] border-white/20 text-white placeholder:text-white/45" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Plan title" />
          {subjects.length > 0 ? (
            <select className="rounded-lg px-2 py-2 text-sm bg-white/[0.08] border border-white/15 text-white" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Select subject</option>
              {subjects.map((s: { subject: string }) => (
                <option key={s.subject} value={s.subject}>{s.subject}</option>
              ))}
            </select>
          ) : (
            <Input className="bg-white/[0.05] border-white/20 text-white placeholder:text-white/45" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          )}
          <Input className="bg-white/[0.05] border-white/20 text-white" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          <Input className="bg-white/[0.05] border-white/20 text-white placeholder:text-white/45" type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Weekly hours" />
        </div>
        <Button className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-0" onClick={generate}>Generate timetable</Button>

        <div className="border-t border-white/10 pt-3">
          <p className="font-medium text-sm mb-2">Weekly Timetable</p>
          {isLoading ? (
            <p className="text-sm text-white/60">Loading...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-white/60">No pending tasks.</p>
          ) : (
            Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, items]) => (
                <div key={day} className="mb-3 border border-white/15 bg-white/[0.06] rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/10 bg-white/[0.05]">
                    <p className="font-medium text-sm">{formatDayLabel(day)}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/60 text-xs border-b border-white/10">
                          <th className="text-left px-3 py-2 font-medium">Start</th>
                          <th className="text-left px-3 py-2 font-medium">End</th>
                          <th className="text-left px-3 py-2 font-medium">Subject</th>
                          <th className="text-left px-3 py-2 font-medium">Session</th>
                          <th className="text-left px-3 py-2 font-medium">Topic Focus</th>
                          <th className="text-left px-3 py-2 font-medium">Duration</th>
                          <th className="text-right px-3 py-2 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items
                          .slice()
                          .sort((a, b) => String(a.start_time ?? "").localeCompare(String(b.start_time ?? "")))
                          .map((item) => (
                            <tr key={String(item.id)} className="border-b border-white/5 last:border-b-0">
                              <td className="px-3 py-2">{formatTime(item.start_time)}</td>
                              <td className="px-3 py-2">{formatTime(item.end_time)}</td>
                              <td className="px-3 py-2 font-medium">{String(item.subject)}</td>
                              <td className="px-3 py-2">{formatTaskType(String(item.task_type))}</td>
                              <td className="px-3 py-2 text-white/80">{item.focus_topic?.trim() ? item.focus_topic : <span className="text-white/45">General revision</span>}</td>
                              <td className="px-3 py-2 text-white/70">{String(item.estimated_minutes)} min</td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.12]"
                                  onClick={() => completeTask.mutate({ token: session.token, taskId: String(item.id) }, { onSuccess: () => refetch() })}
                                >
                                  Done
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
          )}
        </div>

        <div className="border-t border-white/10 pt-3">
          <p className="font-medium text-sm mb-2">Completed Sessions</p>
          {completed.length === 0 ? (
            <p className="text-sm text-white/60">No completed sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {completed.slice(0, 8).map((item) => (
                <div key={String(item.id)} className="bg-emerald-500/10 border border-emerald-400/20 rounded p-2 text-sm">
                  <p className="font-medium">{item.subject} · {formatTaskType(item.task_type)}{item.focus_topic ? ` · ${item.focus_topic}` : ""}</p>
                  <p className="text-xs text-white/65">{String(item.start_time ?? "").slice(0, 16).replace("T", " ")} · {item.estimated_minutes} min</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
