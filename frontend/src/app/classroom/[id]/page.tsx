import { Workspace } from "@/components/classroom/Workspace";

// Next 16: route params are async and must be awaited.
export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // key forces a clean remount per session so the transcript intro animation
  // (reveal → tuck) replays every time a session opens, not just on refresh.
  return <Workspace key={id} sessionId={id} />;
}
