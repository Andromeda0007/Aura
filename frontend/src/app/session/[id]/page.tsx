import { SessionHistoryView } from "@/components/session/SessionHistoryView";

export default async function SessionHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionHistoryView sessionId={id} />;
}
