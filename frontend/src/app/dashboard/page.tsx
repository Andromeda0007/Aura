"use client";

import { formatDistanceToNow } from "date-fns";
import { BarChart3, ClipboardList, Clock, FileQuestion, GraduationCap, Library, LogOut, MessageSquare, Plus, Search, Settings, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { sessionApi, statsApi, type StatsOverview } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { Session } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success",
  paused: "bg-accent/15 text-accent",
  completed: "bg-muted text-muted-foreground",
};
type StatusFilter = "all" | "active" | "completed";

function Kpi({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const ready = useRequireAuth();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<"recent" | "subject">("recent");

  useEffect(() => {
    if (!ready) return;
    sessionApi.list().then(setSessions).catch(() => toast.error("Could not load sessions"));
    statsApi.overview().then(setOverview).catch(() => {});
  }, [ready]);

  const recent = sessions[0];
  const filtered = useMemo(() => {
    let list = sessions.filter((s) => s.subject.toLowerCase().includes(q.toLowerCase()));
    if (status !== "all") list = list.filter((s) => s.status === status);
    list = [...list].sort((a, b) =>
      sort === "subject"
        ? a.subject.localeCompare(b.subject)
        : +new Date(b.created_at) - +new Date(a.created_at),
    );
    return list;
  }, [sessions, q, status, sort]);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setCreating(true);
    try {
      const s = await sessionApi.create(subject.trim());
      router.push(`/classroom/${s.id}`);
    } catch {
      toast.error("Could not create session");
      setCreating(false);
    }
  }

  if (!ready) return null;
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-50" />

      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-semibold text-primary-foreground">
            A
          </span>
          <span className="font-semibold">Aura</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{user?.full_name}</span>
          <Link
            href="/tools"
            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
          >
            <Sparkles className="h-4 w-4" /> Tools
          </Link>
          <Link
            href="/courses"
            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
          >
            <GraduationCap className="h-4 w-4" /> Courses
          </Link>
          <Link
            href="/assignments"
            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
          >
            <ClipboardList className="h-4 w-4" /> Homework
          </Link>
          <Link
            href="/library"
            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
          >
            <Library className="h-4 w-4" /> Library
          </Link>
          <Link
            href="/quizzes"
            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
          >
            <FileQuestion className="h-4 w-4" /> Quizzes
          </Link>
          <Link
            href="/stats"
            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
          >
            <BarChart3 className="h-4 w-4" /> Stats
          </Link>
          <Link
            href="/settings"
            className="grid h-9 w-9 place-items-center rounded-full border border-border transition-colors hover:bg-muted"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out"
            onClick={() => {
              logout();
              router.replace("/auth/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-1 text-muted-foreground">Start a session, or pick up where you left off.</p>

        {/* KPI overview */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Zap} label="Sessions" value={overview?.totalSessions ?? "—"} />
          <Kpi icon={FileQuestion} label="Quizzes" value={overview?.totalQuizzes ?? "—"} />
          <Kpi icon={MessageSquare} label="Commands" value={overview?.totalCommands ?? "—"} />
          <Kpi
            icon={Clock}
            label="Avg response"
            value={overview ? `${(overview.avgLatencyMs / 1000).toFixed(1)}s` : "—"}
          />
        </div>

        {/* New session + continue */}
        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto]">
          <form onSubmit={createSession} className="flex gap-2">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="New session subject — e.g. Photosynthesis"
              className="flex-1"
            />
            <Button type="submit" disabled={creating}>
              <Plus className="h-4 w-4" /> {creating ? "Starting…" : "Start"}
            </Button>
          </form>
          {recent && (
            <Link
              href={`/classroom/${recent.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm transition-colors hover:bg-primary/10"
            >
              <span className="truncate">
                <span className="text-muted-foreground">Continue</span>{" "}
                <span className="font-medium">{recent.subject}</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>

        {/* Sessions + filters */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your sessions</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="h-9 w-40 pl-9"
              />
            </div>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="h-9 rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <select
              aria-label="Sort sessions"
              value={sort}
              onChange={(e) => setSort(e.target.value as "recent" | "subject")}
              className="h-9 rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="recent">Recent</option>
              <option value="subject">A–Z</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {sessions.length === 0 ? "No sessions yet — start your first one above." : "No sessions match."}
            </p>
          ) : (
            filtered.map((s) => (
              <Link
                key={s.id}
                href={`/classroom/${s.id}`}
                className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium leading-snug">{s.subject}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status] ?? ""}`}>
                    {s.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                </p>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
