import { CourseDetailView } from "@/components/courses/CourseDetailView";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseDetailView courseId={id} />;
}
