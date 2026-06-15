import { PublicQuiz } from "@/components/quiz/PublicQuiz";

// Public, no-auth student quiz page. Next 16: params are async.
export default async function PublicQuizPage({
  params,
}: {
  params: Promise<{ share_code: string }>;
}) {
  const { share_code } = await params;
  return <PublicQuiz shareCode={share_code} />;
}
