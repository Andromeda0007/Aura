"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { statsApi, type StatsActivity, type StatsDeep, type StatsOverview } from "@/lib/api";

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#ef4444", "#94a3b8"];

function lastDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function Kpi({ label, value, i }: { label: string; value: string | number; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.25 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </motion.div>
  );
}

export default function StatsPage() {
  const ready = useRequireAuth();
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [activity, setActivity] = useState<StatsActivity | null>(null);
  const [deep, setDeep] = useState<StatsDeep | null>(null);

  useEffect(() => {
    if (!ready) return;
    Promise.all([statsApi.overview(), statsApi.activity(), statsApi.deep()])
      .then(([o, a, d]) => {
        setOverview(o);
        setActivity(a);
        setDeep(d);
      })
      .catch(() => toast.error("Could not load stats"));
  }, [ready]);

  if (!ready) return null;

  const activitySeries = activity
    ? lastDays(14).map((d) => ({
        date: d.slice(5),
        sessions: activity.sessionsByDay[d] ?? 0,
        commands: activity.commandsByDay[d] ?? 0,
      }))
    : [];
  const intentData = overview
    ? Object.entries(overview.intentMix).map(([name, value]) => ({ name, value }))
    : [];
  const empty = overview && overview.totalSessions === 0;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl px-6 pt-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Stats</h1>
        <p className="mt-1 text-sm text-muted-foreground">How your classes are going.</p>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {empty ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="font-medium">No data yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Run a session and ask Aura a few things — your stats will show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi i={0} label="Sessions" value={overview?.totalSessions ?? "—"} />
              <Kpi i={1} label="Commands" value={overview?.totalCommands ?? "—"} />
              <Kpi i={2} label="Quizzes" value={overview?.totalQuizzes ?? "—"} />
              <Kpi i={3} label="Transcripts" value={overview?.totalTranscripts ?? "—"} />
              <Kpi i={4} label="Avg latency" value={overview ? `${overview.avgLatencyMs}ms` : "—"} />
              <Kpi i={5} label="P95 latency" value={overview ? `${overview.p95LatencyMs}ms` : "—"} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
                <p className="mb-3 text-sm font-semibold">Activity (last 14 days)</p>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={activitySeries}>
                    <defs>
                      <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={28} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        color: "var(--foreground)",
                      }}
                    />
                    <Area type="monotone" dataKey="sessions" stroke="#6366f1" fill="url(#gS)" />
                    <Area type="monotone" dataKey="commands" stroke="#8b5cf6" fill="url(#gC)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-3 text-sm font-semibold">Commands by intent</p>
                {intentData.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={intentData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                        {intentData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          color: "var(--foreground)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">No commands yet.</p>
                )}
              </div>
            </div>

            {deep && (
              <>
                <h2 className="mt-10 font-display text-xl font-semibold tracking-tight">
                  Deep insights
                </h2>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="mb-3 text-sm font-semibold">Activity by subject</p>
                    {deep.bySubject.length ? (
                      <ResponsiveContainer width="100%" height={Math.max(180, deep.bySubject.length * 42)}>
                        <BarChart data={deep.bySubject} layout="vertical" margin={{ left: 8 }}>
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                          <YAxis
                            type="category"
                            dataKey="subject"
                            width={110}
                            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: 12,
                              color: "var(--foreground)",
                            }}
                          />
                          <Bar dataKey="commands" fill="#6366f1" radius={[0, 6, 6, 0]} name="Aura asks" />
                          <Bar dataKey="sessions" fill="#22c55e" radius={[0, 6, 6, 0]} name="Sessions" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="py-10 text-center text-sm text-muted-foreground">No subjects yet.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="mb-1 text-sm font-semibold">Hardest concepts</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Quiz questions students miss most.
                    </p>
                    {deep.hardestConcepts.length ? (
                      <div className="space-y-2.5">
                        {deep.hardestConcepts.map((h, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="min-w-0 truncate">{h.question}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {Math.round(h.missRate * 100)}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-danger" style={{ width: `${Math.round(h.missRate * 100)}%` }} />
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{h.subject}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        No quiz attempts yet.
                      </p>
                    )}
                  </div>
                </div>

                {deep.quizPerformance.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                    <p className="mb-3 text-sm font-semibold">Quiz performance (hardest first)</p>
                    <div className="divide-y divide-border">
                      {deep.quizPerformance.map((q) => (
                        <div key={q.quizId} className="flex items-center gap-3 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{q.subject}</span>
                          <span className="text-xs text-muted-foreground">{q.attempts} attempts</span>
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-success" style={{ width: `${q.avgPct}%` }} />
                          </div>
                          <span className="w-10 shrink-0 text-right tabular-nums font-medium">{q.avgPct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
