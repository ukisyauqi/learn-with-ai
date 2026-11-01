import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Play,
  ListBullets,
  House,
} from "@phosphor-icons/react/dist/ssr";
import { db } from "@/db";
import { attemptAnswers, questions, quizAttempts, quizzes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { formatDate, scoreBadgeClass } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const maxDuration = 60;

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ quizId: string; attemptId: string }>;
}) {
  const { quizId, attemptId } = await params;
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

  const attemptRows = await db
    .select()
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.id, attemptId),
        eq(quizAttempts.quizId, quizId),
        eq(quizAttempts.userId, userId)
      )
    )
    .limit(1);
  const attempt = attemptRows[0];
  if (!attempt) notFound();

  const [qs, ans] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .orderBy(asc(questions.orderIndex)),
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)),
  ]);
  const ansByQ = new Map(ans.map((a) => [a.questionId, a]));

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Hasil: {quiz.topic}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Dikerjakan pada {formatDate(attempt.completedAt)}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nilai Akhir</p>
              <p className={cn("text-4xl font-bold", scoreColor(attempt.totalScore))}>
                {attempt.totalScore}
                <span className="text-lg text-muted-foreground">/100</span>
              </p>
            </div>
            <div className="grid gap-1 text-sm">
              <span>
                Skor Pilihan Ganda:{" "}
                <strong>{attempt.mcScore === null ? "-" : `${attempt.mcScore}/100`}</strong>
              </span>
              <span>
                Skor Essay:{" "}
                <strong>
                  {attempt.essayScore === null ? "-" : `${attempt.essayScore}/100`}
                </strong>
              </span>
            </div>
            <Badge className={cn("border", scoreBadgeClass(attempt.totalScore))}>
              {attempt.totalScore >= 80
                ? "Sangat Baik"
                : attempt.totalScore >= 60
                  ? "Cukup"
                  : "Perlu Belajar Lagi"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/quiz/${quizId}/take`}>
              <Button size="sm">
                <Play className="h-4 w-4" weight="fill" />
                Kerjakan Ulang Kuis Ini
              </Button>
            </Link>
            <Link href={`/quiz/${quizId}`}>
              <Button variant="outline" size="sm">
                <ListBullets className="h-4 w-4" />
                Riwayat Attempt
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <House className="h-4 w-4" />
                Kembali ke Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">Review &amp; Pembahasan</h2>
        {qs.map((q, idx) => {
          const a = ansByQ.get(q.id);
          return (
            <Card key={q.id}>
              <CardContent className="grid gap-3 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">
                    {idx + 1}. {q.questionText}
                  </p>
                  <Badge variant={q.type === "multiple_choice" ? "default" : "secondary"}>
                    {q.type === "multiple_choice" ? "Pilihan Ganda" : "Essay"}
                  </Badge>
                </div>

                {q.type === "multiple_choice" ? (
                  <>
                    <div>
                      {a?.isCorrect ? (
                        <Badge variant="success">
                          <CheckCircle className="mr-1 h-3 w-3" weight="fill" />
                          Benar (+100)
                        </Badge>
                      ) : (
                        <Badge variant="danger">
                          <XCircle className="mr-1 h-3 w-3" weight="fill" />
                          Salah (0)
                        </Badge>
                      )}
                    </div>
                    <div className="grid gap-2">
                      {(q.options ?? []).map((opt) => {
                        const isUser = (a?.userAnswer ?? "") === opt.label;
                        const isKey = q.correctAnswer === opt.label;
                        return (
                          <div
                            key={opt.label}
                            className={cn(
                              "flex items-start gap-3 rounded-lg border p-3 text-sm",
                              isKey
                                ? "border-green-400 bg-green-50"
                                : isUser
                                  ? "border-red-300 bg-red-50"
                                  : "bg-background"
                            )}
                          >
                            <span className="font-bold">{opt.label}.</span>
                            <span className="flex-1">{opt.text}</span>
                            {isUser && (
                              <Badge variant="outline">Jawaban Kamu</Badge>
                            )}
                            {isKey && (
                              <Badge variant="success">Kunci Jawaban</Badge>
                            )}
                          </div>
                        );
                      })}
                      {!(a?.userAnswer) && (
                        <p className="text-xs text-muted-foreground">
                          Kamu tidak menjawab soal ini.
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p className="font-semibold">Pembahasan</p>
                      <p className="mt-1 whitespace-pre-wrap">{q.explanation}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Badge className={cn("w-fit border", scoreBadgeClass(a?.score ?? 0))}>
                      Skor AI: {a?.score ?? 0}/100
                    </Badge>
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="font-semibold">Jawaban Kamu</p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {a?.userAnswer ? a.userAnswer : "(kosong)"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3 text-sm">
                      <p className="font-semibold">Evaluasi &amp; Feedback AI</p>
                      <p className="mt-1 whitespace-pre-wrap">{a?.aiFeedback ?? "-"}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="font-semibold">Jawaban Ideal / Rubrik</p>
                      <p className="mt-1 whitespace-pre-wrap">{q.correctAnswer}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p className="font-semibold">Pembahasan</p>
                      <p className="mt-1 whitespace-pre-wrap">{q.explanation}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Link href="/dashboard" className="w-fit">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Button>
      </Link>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}
