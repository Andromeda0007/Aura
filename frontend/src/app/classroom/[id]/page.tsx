import { Workspace } from "@/components/classroom/Workspace";

// Next 16: route params are async and must be awaited.
export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Workspace sessionId={id} />;
}
