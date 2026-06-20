import { DepartmentView } from "@/components/department/DepartmentView";

export default async function DepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DepartmentView departmentId={id} />;
}
