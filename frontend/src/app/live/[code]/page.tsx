import { LiveViewer } from "@/components/live/LiveViewer";

// Public, no-auth live student viewer. Next 16: params are async.
export default async function LivePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LiveViewer code={code} />;
}
