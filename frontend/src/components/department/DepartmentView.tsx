"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Breadcrumbs, batchTitle, type Crumb } from "@/components/layout/Breadcrumbs";
import { LevelStatsPanel } from "@/components/stats/LevelStatsPanel";
import { AppBackdrop } from "@/components/ui/app-backdrop";
import { CardActions } from "@/components/ui/card-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useIsAdmin } from "@/hooks/useRole";
import { batchApi, departmentApi, semesterApi, type DepartmentDetail, type Semester } from "@/lib/api";

function detail(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof msg === "string" ? msg : fallback;
}

export function DepartmentView({ departmentId }: { departmentId: string }) {
  const ready = useRequireAuth();
  const isAdmin = useIsAdmin();
  const [data, setData] = useState<DepartmentDetail | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "Batches", href: "/dashboard" }]);
  const [deleting, setDeleting] = useState<Semester | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const d = await departmentApi.get(departmentId);
    setData(d);
    return d;
  }

  useEffect(() => {
    if (!ready) return;
    refresh()
      .then(async (d) => {
        try {
          const b = await batchApi.get(d.department.batch_id);
          setCrumbs([
            { label: "Batches", href: "/dashboard" },
            { label: batchTitle(b), href: `/batch/${b.id}` },
            { label: d.department.name },
          ]);
        } catch {
          setCrumbs([{ label: "Batches", href: "/dashboard" }, { label: d.department.name }]);
        }
      })
      .catch(() => toast.error("Department not found"));
  }, [ready, departmentId]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await semesterApi.remove(deleting.id);
      setDeleting(null);
      await refresh();
      toast.success("Semester deleted");
    } catch (e2) {
      toast.error(detail(e2, "Could not delete"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !data) return null;
  const { department, semesters } = data;

  return (
    <div className="relative flex flex-1 flex-col">
      <AppBackdrop />
      <AppHeader />

      <main className="mx-auto w-full flex-1 px-6 py-8 lg:px-[10%]">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{department.name}</h1>
          <p className="mt-1 text-muted-foreground">Semesters</p>
        </div>

        <div className="mt-8">
          <LevelStatsPanel load={() => departmentApi.stats(departmentId)} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {semesters.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
              <Layers className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No semesters here</p>
              <p className="mt-1 text-sm text-muted-foreground">Nothing assigned to you in this department.</p>
            </div>
          ) : (
            semesters.map((s) => (
              <div key={s.id} className="group relative">
                <Link
                  href={`/semester/${s.id}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <span className="font-display text-xl font-semibold tracking-tight">Semester {s.number}</span>
                  <span className="text-sm text-muted-foreground" aria-hidden>→</span>
                </Link>
                <CardActions show={isAdmin} onDelete={() => setDeleting(s)} />
              </div>
            ))
          )}
        </div>

      </main>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete semester?"
        message={
          deleting && (
            <>
              Permanently delete <span className="font-medium text-foreground">Semester {deleting.number}</span> of{" "}
              {department.name} — including all its courses, units and sessions. This can’t be undone.
            </>
          )
        }
      />
    </div>
  );
}
