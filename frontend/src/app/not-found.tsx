import Link from "next/link";

import { Aurora } from "@/components/ui/aurora";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Aurora className="opacity-40" />
      <p className="font-display text-7xl font-semibold tracking-tight">404</p>
      <p className="mt-3 text-lg text-muted-foreground">This page wandered off the board.</p>
      <Link
        href="/"
        className="mt-7 inline-flex h-11 items-center rounded-full bg-primary px-6 font-medium text-primary-foreground transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
      >
        Back to Aura
      </Link>
    </div>
  );
}
