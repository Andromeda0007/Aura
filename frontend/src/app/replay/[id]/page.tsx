import { ReplayView } from "@/components/replay/ReplayView";

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReplayView sessionId={id} />;
}
