import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import {
  BookOpenText,
  ClockCounterClockwise,
  Target,
  Play,
  ListBullets,
} from "@phosphor-icons/react/dist/ssr";
import { db } from "@/db";
import { quizAttempts, quizzes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { difficultyLabel, formatDate } from "@/lib/utils";
import { CreateQuizForm } from "@/components/create-quiz-form";
import { DeleteQuizButton } from "@/components/delete-quiz-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const maxDuration = 60;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const myQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.userId, userId))
    .orderBy(desc(quizzes.createdAt));

  const myAttempts = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.userId, userId));

  const attemptsByQuiz = new Map<string, typeof myAttempts>();
  for (const a of myAttempts) {
    const list = attemptsByQuiz.get(a.quizId) ?? [];
    list.push(a);
    attemptsByQuiz.set(a.quizId, list);
  }

  const avgScore =
    myAttempts.length === 0
      ? null
      : Math.round(
          myAttempts.reduce((s, a) => s + a.totalScore, 0) / myAttempts.length
        );

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Belajar</h1>
        <p className="text-sm text-muted-foreground">
          Buat soal baru dengan AI, kerjakan, dan pantau progresmu.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <BookOpenText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{myQuizzes.length}</p>
              <p className="text-sm text-muted-foreground">Total Kuis Dibuat</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <ClockCounterClockwise className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{myAttempts.length}</p>
              <p className="text-sm text-muted-foreground">Total Pengerjaan</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">
                {avgScore === null ? "-" : `${avgScore}`}
              </p>
              <p className="text-sm text-muted-foreground">Rata-rata Skor</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <CreateQuizForm />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Kuis Saya</h2>
        {myQuizzes.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Belum ada kuis. Buat kuis pertamamu lewat form di atas.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {myQuizzes.map((q) => {
              const attempts = (attemptsByQuiz.get(q.id) ?? []).sort(
                (a, b) => +b.completedAt - +a.completedAt
              );
              const best =
                attempts.length === 0
                  ? null
                  : Math.max(...attempts.map((a) => a.totalScore));
              const last = attempts[0]?.totalScore ?? null;
              return (
                <Card key={q.id}>
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-base">
                      {q.topic}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge
                        variant={
                          q.difficulty === "mudah"
                            ? "success"
                            : q.difficulty === "sedang"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {difficultyLabel[q.difficulty] ?? q.difficulty}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {q.mcCount} PG • {q.essayCount} Essay
                      </span>
                      <span className="text-xs text-muted-foreground">
                        • {formatDate(q.createdAt)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <p className="text-xs text-muted-foreground">
                      {attempts.length === 0
                        ? "Belum pernah dikerjakan."
                        : `${attempts.length}x dikerjakan • Terbaik: ${best} • Terakhir: ${last}`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/quiz/${q.id}/take`}>
                        <Button size="sm">
                          <Play className="h-4 w-4" weight="fill" />
                          {attempts.length > 0 ? "Kerjakan Ulang" : "Kerjakan"}
                        </Button>
                      </Link>
                      <Link href={`/quiz/${q.id}`}>
                        <Button variant="outline" size="sm">
                          <ListBullets className="h-4 w-4" />
                          Riwayat &amp; Hasil
                        </Button>
                      </Link>
                      <DeleteQuizButton quizId={q.id} topic={q.topic} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
