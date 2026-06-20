"use client";

import { GraduationCap, Layers, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { batchTitle } from "@/components/layout/Breadcrumbs";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useIsAdmin, useRole } from "@/hooks/useRole";
import { batchApi, type BatchSummary } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const ready = useRequireAuth();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = useRole();
  const isAdmin = useIsAdmin();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [program, setProgram] = useState("");
  const [semester, setSemester] = useState(1);
  const [year, setYear] = useState(2026);
  const [section, setSection] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setBatches(await batchApi.list());
  }

  useEffect(() => {
    if (!ready) return;
    batchApi
      .list()
      .then((list) => {
        setBatches(list);
        setLoaded(true);
        // Students live in exactly one batch — drop them straight into it.
        if (role === "student" && list.length >= 1) router.replace(`/batch/${list[0].id}`);
      })
      .catch(() => toast.error("Could not load batches"));
  }, [ready, role, router]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!program.trim()) return;
    setCreating(true);
    try {
      await batchApi.create({ program: program.trim(), semester, year, section: section.trim() || null });
      setProgram("");
      setSection("");
      setShowForm(false);
      await refresh();
    } catch {
      toast.error("Could not create batch");
    } finally {
      setCreating(false);
    }
  }

  if (!ready) return null;
  const firstName = user?.full_name?.split(" ")[0] ?? "there";
  // Students are redirected into their batch; avoid flashing the grid.
  if (role === "student") {
    return (
      <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
        {loaded && batches.length === 0 ? "No class assigned yet — ask your admin." : "Opening your class…"}
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <OnboardingTour />
      <Aurora className="opacity-50" />
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-1 text-muted-foreground">
              {isAdmin ? "Pick a batch, or start a new one for this year." : "Your assigned batches."}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" /> New batch
            </Button>
          )}
        </div>

        {isAdmin && showForm && (
          <form
            onSubmit={create}
            className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          >
            <Input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Program (e.g. Computer Science)" />
            <Input
              type="number"
              min={1}
              max={12}
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              aria-label="Semester"
              placeholder="Sem"
            />
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Year"
              placeholder="Year"
            />
            <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section (opt)" />
            <Button type="submit" disabled={creating}>{creating ? "…" : "Add"}</Button>
          </form>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batches.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
              <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No batches yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create one (e.g. Computer Science · Sem 5 · 2026) to add your courses.
              </p>
            </div>
          ) : (
            batches.map((b) => (
              <Link
                key={b.id}
                href={`/batch/${b.id}`}
                className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{b.year}</p>
                <h3 className="mt-1 font-display text-lg font-semibold leading-snug">
                  {batchTitle(b)}
                </h3>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> {b.courses} course{b.courses === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" /> {b.tokensUsed.toLocaleString()} tok
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
