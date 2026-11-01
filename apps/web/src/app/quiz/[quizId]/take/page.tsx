import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { db } from "@/db";
import { questions, quizzes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { QuizPlayer } from "@/components/quiz-player";
import { Button } from "@/components/ui/button";

export const maxDuration = 60;

export default async function TakeQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const quizRows = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
    .limit(1);
  const quiz = quizRows[0];
  if (!quiz) notFound();

  const qs = await db
    .select({
      id: questions.id,
      orderIndex: questions.orderIndex,
      type: questions.type,
      questionText: questions.questionText,
      options: questions.options,
    })
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderIndex));

  // Keamanan payload: correctAnswer & explanation TIDAK dikirim ke client.
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <p className="truncate text-sm text-muted-foreground">{quiz.topic}</p>
      </div>
      <div>
        <h1 className="text-xl font-bold">{quiz.topic}</h1>
        <p className="text-sm text-muted-foreground">
          Jawab semua soal, lalu kumpulkan untuk dinilai AI.
        </p>
      </div>
      <QuizPlayer quizId={quizId} userId={userId} questions={qs} />
    </div>
  );
}
