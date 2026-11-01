"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  attemptAnswers,
  questions,
  quizAttempts,
  quizzes,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { AiWorkerError, callAiWorker, extractJson } from "@/lib/ai-client";
import {
  buildEssayGradingMessages,
  buildGenerateQuizMessages,
  essayGradingResponseFormat,
  generateQuizResponseFormat,
} from "@/lib/prompts";
import {
  createQuizInputSchema,
  essayGradingResultSchema,
  generatedQuizSchema,
  submitAttemptInputSchema,
  validateMcAnswer,
} from "@/lib/validations";

function friendlyError(e: unknown): string {
  if (e instanceof AiWorkerError) return e.message;
  if (e instanceof Error) {
    // Sembunyikan detail internal / OpenAI mentah.
    if (/OPENAI|api\.openai|status \d{3}/i.test(e.message)) {
      return "Layanan AI gagal memproses permintaan. Coba lagi beberapa saat.";
    }
    // Error validasi Zod dari AI: sampaikan ringkas.
    if (/invalid|JSON|schema|parse/i.test(e.message)) {
      return "AI mengembalikan format yang tidak valid. Silakan coba lagi.";
    }
    return e.message;
  }
  return "Terjadi kesalahan. Silakan coba lagi.";
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Anda harus masuk terlebih dahulu.");
  return id;
}

// ---------------------------------------------------------------------------
// generateQuiz
// ---------------------------------------------------------------------------

export async function generateQuiz(
  formData: FormData
): Promise<{ ok: true; quizId: string } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();

    const parsed = createQuizInputSchema.safeParse({
      topic: formData.get("topic"),
      difficulty: formData.get("difficulty"),
      mcCount: formData.get("mcCount"),
      essayCount: formData.get("essayCount"),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, error: first?.message ?? "Input tidak valid." };
    }
    const { topic, difficulty, mcCount, essayCount } = parsed.data;
    const total = mcCount + essayCount;

    const messages = buildGenerateQuizMessages(
      topic,
      difficulty,
      mcCount,
      essayCount
    );

    const quizId = nanoid();

    const content = await callAiWorker({
      messages,
      response_format: generateQuizResponseFormat(),
      max_tokens: 8000,
      sessionId: `quiz-gen-${quizId}`,
    });

    let json: unknown;
    try {
      json = extractJson(content);
    } catch {
      return {
        ok: false,
        error: "AI mengembalikan format yang tidak valid. Silakan coba lagi.",
      };
    }

    const validated = generatedQuizSchema.safeParse(json);
    if (!validated.success) {
      return {
        ok: false,
        error: "AI mengembalikan format soal yang tidak valid. Silakan coba lagi.",
      };
    }

    let qs = validated.data.questions;

    // Normalisasi: urutkan PG dulu lalu essay, dan paksa jumlah sesuai permintaan.
    const mcs = qs.filter((q) => q.type === "multiple_choice");
    const essays = qs.filter((q) => q.type === "essay");
    if (mcs.length !== mcCount || essays.length !== essayCount) {
      // Jika AI meleset sedikit, terima selama total benar; kalau tidak, tolak.
      if (mcs.length + essays.length !== total) {
        return {
          ok: false,
          error:
            "AI mengembalikan jumlah soal yang tidak sesuai. Silakan coba lagi.",
        };
      }
    }
    qs = [...mcs, ...essays];

    // Validasi ketat per butir.
    for (const q of qs) {
      if (q.type === "multiple_choice") {
        if (!q.options || q.options.length !== 4) {
          return {
            ok: false,
            error: "Soal PG dari AI tidak memiliki 4 opsi. Silakan coba lagi.",
          };
        }
        const labels = q.options.map((o) => o.label).sort().join(",");
        if (labels !== "A,B,C,D") {
          return {
            ok: false,
            error: "Label opsi PG dari AI tidak valid. Silakan coba lagi.",
          };
        }
        if (!["A", "B", "C", "D"].includes(q.correctAnswer.trim())) {
          return {
            ok: false,
            error: "Kunci jawaban PG dari AI tidak valid. Silakan coba lagi.",
          };
        }
      } else {
        if (q.options !== null) {
          return {
            ok: false,
            error: "Format soal essay dari AI tidak valid. Silakan coba lagi.",
          };
        }
      }
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(quizzes).values({
        id: quizId,
        userId,
        topic: topic.trim(),
        difficulty,
        mcCount,
        essayCount,
        createdAt: now,
      });
      await tx.insert(questions).values(
        qs.map((q, i) => ({
          id: nanoid(),
          quizId,
          orderIndex: i + 1,
          type: q.type,
          questionText: q.questionText,
          options:
            q.type === "multiple_choice"
              ? [...(q.options ?? [])].sort((a, b) =>
                  a.label.localeCompare(b.label)
                )
              : null,
          correctAnswer: q.correctAnswer.trim(),
          explanation: q.explanation,
        }))
      );
    });

    revalidatePath("/dashboard");
    return { ok: true, quizId };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

// ---------------------------------------------------------------------------
// submitQuizAttempt
// ---------------------------------------------------------------------------

export async function submitQuizAttempt(
  input: { quizId: string; answers: { questionId: string; userAnswer: string }[] }
): Promise<{ ok: true; attemptId: string } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();

    const parsed = submitAttemptInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Data jawaban tidak valid." };
    }
    const { quizId, answers } = parsed.data;

    const quizRows = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .limit(1);
    const quiz = quizRows[0];
    if (!quiz) return { ok: false, error: "Kuis tidak ditemukan." };

    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId));
    if (qs.length === 0) return { ok: false, error: "Kuis belum memiliki soal." };

    const byId = new Map(qs.map((q) => [q.id, q]));
    const answerByQ = new Map(answers.map((a) => [a.questionId, a.userAnswer]));

    // Validasi: semua questionId harus milik kuis ini.
    for (const a of answers) {
      if (!byId.has(a.questionId)) {
        return { ok: false, error: "Terdapat jawaban untuk soal yang tidak dikenal." };
      }
    }

    // Nilai PG deterministik + siapkan batch essay.
    type Pending = {
      questionId: string;
      userAnswer: string;
      isCorrect: boolean | null;
      score: number;
      aiFeedback: string | null;
    };
    const pending = new Map<string, Pending>();
    const essayBatch: {
      questionId: string;
      questionText: string;
      idealAnswerAndRubric: string;
      userAnswer: string;
    }[] = [];

    for (const q of qs) {
      const raw = (answerByQ.get(q.id) ?? "").toString();
      if (q.type === "multiple_choice") {
        const ans = raw.trim().toUpperCase();
        if (ans !== "" && !validateMcAnswer(ans)) {
          return {
            ok: false,
            error: "Jawaban pilihan ganda harus A, B, C, atau D.",
          };
        }
        const correct = ans !== "" && ans === q.correctAnswer.trim().toUpperCase();
        pending.set(q.id, {
          questionId: q.id,
          userAnswer: ans,
          isCorrect: correct,
          score: correct ? 100 : 0,
          aiFeedback: null,
        });
      } else {
        const essay = raw.slice(0, 5000);
        if (essay.trim() === "") {
          pending.set(q.id, {
            questionId: q.id,
            userAnswer: "",
            isCorrect: null,
            score: 0,
            aiFeedback: "Tidak ada jawaban yang diberikan.",
          });
        } else {
          // Placeholder, diisi setelah grading AI.
          pending.set(q.id, {
            questionId: q.id,
            userAnswer: essay,
            isCorrect: null,
            score: 0,
            aiFeedback: "",
          });
          essayBatch.push({
            questionId: q.id,
            questionText: q.questionText,
            idealAnswerAndRubric: q.correctAnswer,
            userAnswer: essay,
          });
        }
      }
    }

    // Grading essay batch: 1 request.
    if (essayBatch.length > 0) {
      const messages = buildEssayGradingMessages(essayBatch);
      const content = await callAiWorker({
        messages,
        response_format: essayGradingResponseFormat(),
        max_tokens: 4000,
        sessionId: `quiz-grade-${quizId}-${nanoid()}`,
      });
      let json: unknown;
      try {
        json = extractJson(content);
      } catch {
        return {
          ok: false,
          error: "Penilaian AI gagal (format tidak valid). Silakan coba lagi.",
        };
      }
      const graded = essayGradingResultSchema.safeParse(json);
      if (!graded.success) {
        return {
          ok: false,
          error: "Penilaian AI gagal (format tidak valid). Silakan coba lagi.",
        };
      }
      const gradeByQ = new Map(graded.data.grades.map((g) => [g.questionId, g]));
      for (const item of essayBatch) {
        const g = gradeByQ.get(item.questionId);
        const p = pending.get(item.questionId)!;
        if (!g) {
          p.score = 0;
          p.aiFeedback = "Penilaian AI tidak tersedia untuk soal ini.";
        } else {
          p.score = Math.max(0, Math.min(100, Math.round(g.score)));
          p.aiFeedback = g.feedback;
        }
      }
    }

    // Hitung skor.
    const allScores = Array.from(pending.values()).map((p) => p.score);
    const mcScores = qs
      .filter((q) => q.type === "multiple_choice")
      .map((q) => pending.get(q.id)!.score);
    const essayScores = qs
      .filter((q) => q.type === "essay")
      .map((q) => pending.get(q.id)!.score);

    const avg = (arr: number[]) =>
      arr.length === 0
        ? null
        : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

    const totalScore = Math.round(
      allScores.reduce((a, b) => a + b, 0) / allScores.length
    );
    const mcScore = avg(mcScores);
    const essayScore = avg(essayScores);

    const attemptId = nanoid();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(quizAttempts).values({
        id: attemptId,
        quizId,
        userId,
        totalScore,
        mcScore,
        essayScore,
        completedAt: now,
      });
      await tx.insert(attemptAnswers).values(
        Array.from(pending.values()).map((p) => ({
          id: nanoid(),
          attemptId,
          questionId: p.questionId,
          userAnswer: p.userAnswer,
          isCorrect: p.isCorrect,
          score: p.score,
          aiFeedback: p.aiFeedback,
        }))
      );
    });

    revalidatePath("/dashboard");
    revalidatePath(`/quiz/${quizId}`);
    return { ok: true, attemptId };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

// ---------------------------------------------------------------------------
// deleteQuiz
// ---------------------------------------------------------------------------

export async function deleteQuiz(
  quizId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();
    const rows = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .limit(1);
    if (!rows[0]) return { ok: false, error: "Kuis tidak ditemukan." };

    await db
      .delete(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)));

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
