import { CourseView } from "@/components/course/CourseView";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseView courseId={id} />;
}
