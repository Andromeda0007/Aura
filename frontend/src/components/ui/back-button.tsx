"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

/** Goes to the actual previous page (browser history); falls back to a route
 *  when there's no history (deep link / fresh load). */
export function BackButton({
  fallback = "/dashboard",
  label = "Back",
  className,
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={goBack}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}
