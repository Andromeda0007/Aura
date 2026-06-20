import { BatchView } from "@/components/batch/BatchView";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BatchView batchId={id} />;
}
