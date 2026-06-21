"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";

import type { AdminTreeBatch } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface Picked {
  id: string;
  label: string;
}

/** Build a lookup of semester-id → human label, used to pre-seed the picker
 *  from a user's existing `semesterIds`. */
export function buildSemesterLabels(tree: AdminTreeBatch[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of tree) {
    for (const d of b.departments) {
      for (const s of d.semesters) {
        m.set(s.id, `${d.name} · ${b.label} · Sem ${s.number}`);
      }
    }
  }
  return m;
}

/** Semester assignment selector, shared by the create form and the edit modal.
 *  Teacher → department, then multi-select semesters across any batch of that
 *  department. Student → batch → department → exactly one semester. Admin → nothing. */
export function AssignmentPicker({
  role,
  tree,
  picked,
  onChange,
}: {
  role: string;
  tree: AdminTreeBatch[];
  picked: Picked[];
  onChange: (picked: Picked[]) => void;
}) {
  const single = role === "student";
  const [deptName, setDeptName] = useState(""); // teacher: department (subject) first
  const [batchId, setBatchId] = useState(""); // student: batch first
  const [deptId, setDeptId] = useState(""); // student: dept within batch

  // Nav state resets when the role changes via a `key` on the call site, which
  // remounts this component fresh — selection itself is owned by the parent.

  // distinct department names across all batches (teachers pick one subject area)
  const deptNames = useMemo(
    () => [...new Set(tree.flatMap((b) => b.departments.map((d) => d.name)))].sort(),
    [tree],
  );
  // for the chosen department name: each batch that has it
  const teacherRows = useMemo(
    () =>
      tree
        .map((b) => ({ batch: b, dept: b.departments.find((d) => d.name === deptName) }))
        .filter((x) => x.dept),
    [tree, deptName],
  );

  const studentBatch = tree.find((b) => b.id === batchId);
  const studentDept = studentBatch?.departments.find((d) => d.id === deptId);

  function toggle(id: string, label: string) {
    if (single) {
      onChange([{ id, label }]);
      return;
    }
    onChange(picked.some((x) => x.id === id) ? picked.filter((x) => x.id !== id) : [...picked, { id, label }]);
  }

  if (role === "admin") return null;

  return (
    <div className="space-y-2">
      {/* TEACHER: department first, then semesters across any batches of that dept */}
      {role === "teacher" && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <select
            aria-label="Department"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select department…</option>
            {deptNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {deptName && teacherRows.map(({ batch, dept }) => (
            <div key={dept!.id}>
              <p className="mb-1 mt-1 text-xs font-medium text-muted-foreground">Batch {batch.label}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {dept!.semesters.map((s) => {
                  const label = `${deptName} · ${batch.label} · Sem ${s.number}`;
                  const on = picked.some((p) => p.id === s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggle(s.id, label)}
                      className={cn("rounded-lg border px-2 py-1.5 text-xs", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
                      S{s.number}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STUDENT: batch -> department -> one semester */}
      {role === "student" && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <select aria-label="Batch" value={batchId} onChange={(e) => { setBatchId(e.target.value); setDeptId(""); onChange([]); }}
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Select batch…</option>
            {tree.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <select aria-label="Department" value={deptId} onChange={(e) => { setDeptId(e.target.value); onChange([]); }} disabled={!batchId}
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
            <option value="">Select department…</option>
            {studentBatch?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {studentDept && (
            <div className="grid grid-cols-4 gap-1.5">
              {studentDept.semesters.map((s) => {
                const label = `${studentDept.name} · ${studentBatch!.label} · Sem ${s.number}`;
                const on = picked.some((p) => p.id === s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggle(s.id, label)}
                    className={cn("rounded-lg border px-2 py-1.5 text-xs", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
                    S{s.number}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* selected chips */}
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <span key={p.id} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              {p.label}
              <button type="button" aria-label={`Remove ${p.label}`} onClick={() => onChange(picked.filter((x) => x.id !== p.id))} className="text-muted-foreground hover:text-danger">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
