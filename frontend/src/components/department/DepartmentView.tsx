"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Breadcrumbs, batchTitle, type Crumb } from "@/components/layout/Breadcrumbs";
import { LevelStatsPanel } from "@/components/stats/LevelStatsPanel";
import { Aurora } from "@/components/ui/aurora";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { batchApi, departmentApi, type DepartmentDetail } from "@/lib/api";

export function DepartmentView({ departmentId }: { departmentId: string }) {
  const ready = useRequireAuth();
  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "Batches", href: "/dashboard" }]);

  useEffect(() => {
    if (!ready) return;
    departmentApi
      .get(departmentId)
      .then(async (d) => {
        setDetail(d);
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

  if (!ready || !detail) return null;
  const { department, semesters } = detail;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <AppHeader />

      <main className="mx-auto w-full flex-1 px-6 py-8 lg:px-[10%]">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{department.name}</h1>
          <p className="mt-1 text-muted-foreground">Semesters</p>
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
              <Link
                key={s.id}
                href={`/semester/${s.id}`}
                className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted"
              >
                <span className="font-display text-xl font-semibold tracking-tight">Semester {s.number}</span>
                <span className="text-sm text-muted-foreground" aria-hidden>→</span>
              </Link>
            ))
          )}
        </div>

        <div className="mt-8">
          <LevelStatsPanel load={() => departmentApi.stats(departmentId)} />
        </div>
      </main>
    </div>
  );
}
