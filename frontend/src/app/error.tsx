"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-4xl font-semibold tracking-tight">Something broke</p>
      <p className="mt-2 max-w-sm text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to your dashboard.
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center rounded-full border border-border px-6 font-medium transition-colors hover:bg-muted"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
