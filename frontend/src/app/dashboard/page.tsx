"use client";

import { formatDistanceToNow } from "date-fns";
import { BarChart3, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { sessionApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { Session } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success",
  paused: "bg-accent/15 text-accent",
  completed: "bg-muted text-muted-foreground",
};

export default function DashboardPage() {
  const ready = useRequireAuth();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!ready) return;
    sessionApi.list().then(setSessions).catch(() => toast.error("Could not load sessions"));
  }, [ready]);

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

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
            A
          </span>
          <span className="font-semibold">Aura</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user?.full_name}
          </span>
          <Link
            href="/stats"
            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm hover:bg-muted"
          >
            <BarChart3 className="h-4 w-4" /> Stats
          </Link>
          <ThemeToggle />
          <Button
            variant="ghost" size="icon" aria-label="Log out"
            onClick={() => { logout(); router.replace("/auth/login"); }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Your sessions</h1>

        <form onSubmit={createSession} className="mt-5 flex gap-2">
          <Input
            value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="New session subject — e.g. Photosynthesis"
            className="flex-1"
          />
          <Button type="submit" disabled={creating}>
            <Plus className="h-4 w-4" /> {creating ? "Starting…" : "Start"}
          </Button>
        </form>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet — start your first one above.</p>
          ) : (
            sessions.map((s) => (
              <Link
                key={s.id} href={`/classroom/${s.id}`}
                className="rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium">{s.subject}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status] ?? ""}`}>
                    {s.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
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
