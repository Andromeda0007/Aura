import { Aurora } from "@/components/ui/aurora";
import { LectureGhosts } from "@/components/ui/lecture-ghosts";

/** Shared background for in-app pages: the Aurora glow + subject doodles (a touch
 *  brighter than the landing's dim wash) plus a couple of faint lecture-card
 *  ghosts. Landing and login keep their own bespoke backgrounds. */
export function AppBackdrop() {
  return (
    <>
      <Aurora className="opacity-60" />
      <LectureGhosts />
    </>
  );
}
