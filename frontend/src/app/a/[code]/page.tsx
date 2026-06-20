import { PublicAssignment } from "@/components/assignment/PublicAssignment";

export default async function PublicAssignmentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PublicAssignment code={code} />;
}
