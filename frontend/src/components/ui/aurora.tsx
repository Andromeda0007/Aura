import { DoodleIcons } from "@/components/ui/doodles";
import { cn } from "@/lib/utils";

/** Signature aurora glow — brand-hue radial blobs, blurred, plus faint scattered
 *  subject doodles. Background only. Drop into a `relative` container. */
export function Aurora({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <div
        className="absolute -top-40 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
        style={{ background: "radial-gradient(closest-side, var(--primary), transparent)" }}
      />
      <div
        className="absolute -right-40 top-24 h-[34rem] w-[34rem] rounded-full opacity-[0.16] blur-[120px]"
        style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }}
      />
      <div
        className="absolute -bottom-48 -left-40 h-[32rem] w-[32rem] rounded-full opacity-[0.12] blur-[120px]"
        style={{ background: "radial-gradient(closest-side, var(--success), transparent)" }}
      />
      <DoodleIcons />
    </div>
  );
}
