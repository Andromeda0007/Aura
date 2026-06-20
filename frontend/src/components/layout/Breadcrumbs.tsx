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

/** Compose a batch's display title from its structured fields. */
export function batchTitle(b: {
  program: string;
  semester: number;
  year: number;
  section?: string | null;
}): string {
  const sec = b.section ? ` · ${b.section}` : "";
  return `${b.program} · Sem ${b.semester}${sec} · ${b.year}`;
}
