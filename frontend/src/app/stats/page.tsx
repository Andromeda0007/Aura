"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
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

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { statsApi, type StatsActivity, type StatsOverview } from "@/lib/api";

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

  useEffect(() => {
    if (!ready) return;
    Promise.all([statsApi.overview(), statsApi.activity()])
      .then(([o, a]) => {
        setOverview(o);
        setActivity(a);
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
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="rounded-full p-1.5 hover:bg-muted" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="font-semibold">Stats</span>
        </div>
        <ThemeToggle />
      </header>

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
          </>
        )}
      </main>
    </div>
  );
}
