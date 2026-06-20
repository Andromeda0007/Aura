import { SemesterView } from "@/components/semester/SemesterView";

export default async function SemesterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SemesterView semesterId={id} />;
}
