import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Play } from "@phosphor-icons/react/dist/ssr";
import { db } from "@/db";
import { questions, quizAttempts, quizzes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { difficultyLabel, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function QuizDetailPage({
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

  const [qs, attempts] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .orderBy(asc(questions.orderIndex)),
    db
      .select()
      .from(quizAttempts)
      .where(
        and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId))
      )
      .orderBy(desc(quizAttempts.completedAt)),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <Link href={`/quiz/${quizId}/take`}>
          <Button size="sm">
            <Play className="h-4 w-4" weight="fill" />
            {attempts.length > 0 ? "Kerjakan Sekarang / Retake" : "Kerjakan Sekarang"}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{quiz.topic}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge
              variant={
                quiz.difficulty === "mudah"
                  ? "success"
                  : quiz.difficulty === "sedang"
                    ? "warning"
                    : "danger"
              }
            >
              {difficultyLabel[quiz.difficulty] ?? quiz.difficulty}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {quiz.mcCount} PG • {quiz.essayCount} Essay • Dibuat{" "}
              {formatDate(quiz.createdAt)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Paket ini berisi {qs.length} soal. Klik &quot;Lihat Pembahasan&quot;
          pada riwayat untuk mereview jawabanmu per soal.
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          Riwayat Percobaan ({attempts.length})
        </h2>
        {attempts.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Belum ada percobaan. Kerjakan kuis ini untuk melihat hasilnya di
              sini.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {attempts.map((a, i) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                  <div>
                    <p className="font-semibold">
                      Attempt #{attempts.length - i}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(a.completedAt)} • PG:{" "}
                      {a.mcScore === null ? "-" : a.mcScore} • Essay:{" "}
                      {a.essayScore === null ? "-" : a.essayScore} • Total:{" "}
                      {a.totalScore}
                    </p>
                  </div>
                  <Link href={`/quiz/${quizId}/attempt/${a.id}`}>
                    <Button variant="outline" size="sm">
                      Lihat Pembahasan
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
