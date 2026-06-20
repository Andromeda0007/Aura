"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {c.href && !last ? (
              <Link href={c.href} className="truncate transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className={last ? "truncate font-medium text-foreground" : "truncate"}>{c.label}</span>
            )}
            {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          </span>
        );
      })}
    </nav>
  );
}

/** Batch label = admission year range, e.g. "2022–2026". */
export function batchTitle(b: { start_year?: number; end_year?: number; startYear?: number; endYear?: number }): string {
  const s = b.start_year ?? b.startYear;
  const e = b.end_year ?? b.endYear;
  return `${s}–${e}`;
}

export function semesterTitle(n: number): string {
  return `Semester ${n}`;
}
