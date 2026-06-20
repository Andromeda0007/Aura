"use client";

import { GraduationCap, Layers, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useIsAdmin, useRole } from "@/hooks/useRole";
import { batchApi, semesterApi, type BatchSummary, type MySemester } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const ready = useRequireAuth();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = useRole();
  const isAdmin = useIsAdmin();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [mine, setMine] = useState<MySemester[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [start, setStart] = useState(2022);
  const [end, setEnd] = useState(2026);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!ready || !role) return;
    if (role === "admin") {
      batchApi.list().then(setBatches).catch(() => toast.error("Could not load batches")).finally(() => setLoaded(true));
    } else {
      semesterApi
        .mine()
        .then((sems) => {
          setMine(sems);
          setLoaded(true);
          if (role === "student" && sems.length >= 1) router.replace(`/semester/${sems[0].id}`);
        })
        .catch(() => toast.error("Could not load your classes"));
    }
  }, [ready, role, router]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await batchApi.create({ start_year: start, end_year: end });
      setShowForm(false);
      setBatches(await batchApi.list());
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Could not create batch");
    } finally {
      setCreating(false);
    }
  }

  if (!ready || !role) return null;
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  // Student: redirected into their semester.
  if (role === "student") {
    return (
      <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
        {loaded && mine.length === 0 ? "No class assigned yet — ask your admin." : "Opening your class…"}
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <OnboardingTour />
      <Aurora className="opacity-50" />
      <AppHeader />

      <main className="mx-auto w-full flex-1 px-6 py-10 lg:px-[10%]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back, {firstName}.</h1>
            <p className="mt-1 text-muted-foreground">
              {isAdmin ? "Pick an admission batch, or start a new one." : "Your classes."}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" /> New batch
            </Button>
          )}
        </div>

        {isAdmin && showForm && (
          <form onSubmit={create} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Start year</p>
              <Input type="number" min={2000} max={2100} value={start} onChange={(e) => setStart(Number(e.target.value))} className="w-32" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">End year</p>
              <Input type="number" min={2000} max={2100} value={end} onChange={(e) => setEnd(Number(e.target.value))} className="w-32" />
            </div>
            <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
          </form>
        )}

        {/* Admin: batches grid. Teacher: their class (semester) grid. */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isAdmin ? (
            batches.length === 0 ? (
              <Empty icon={GraduationCap} title="No batches yet" body="Create an admission batch (e.g. 2022–2026) to add departments." />
            ) : (
              batches.map((b) => (
                <Link key={b.id} href={`/batch/${b.id}`} className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Batch</p>
                  <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">{b.startYear}–{b.endYear}</h3>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> {b.departments} dept{b.departments === 1 ? "" : "s"}</span>
                    <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> {b.tokensUsed.toLocaleString()} tok</span>
                  </div>
                </Link>
              ))
            )
          ) : mine.length === 0 ? (
            <Empty icon={GraduationCap} title="No classes yet" body="Your admin hasn't assigned you a class." />
          ) : (
            mine.map((s) => (
              <Link key={s.id} href={`/semester/${s.id}`} className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{s.batch}</p>
                <h3 className="mt-1 font-display text-lg font-semibold leading-snug">{s.department} · Sem {s.number}</h3>
                <p className="mt-3 text-xs text-muted-foreground">Open class →</p>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function Empty({ icon: Icon, title, body }: { icon: typeof GraduationCap; title: string; body: string }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
