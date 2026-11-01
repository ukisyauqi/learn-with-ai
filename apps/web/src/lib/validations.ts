import { z } from "zod";

export const difficultySchema = z.enum(["mudah", "sedang", "sulit"]);

export const createQuizInputSchema = z
  .object({
    topic: z
      .string()
      .trim()
      .min(3, "Topik minimal 3 karakter.")
      .max(200, "Topik maksimal 200 karakter."),
    difficulty: difficultySchema,
    mcCount: z.coerce.number().int().min(0).max(20),
    essayCount: z.coerce.number().int().min(0).max(5),
  })
  .refine((v) => v.mcCount + v.essayCount >= 1, {
    message: "Jumlah soal minimal 1 (PG + Essay).",
    path: ["mcCount"],
  });

export type CreateQuizInput = z.infer<typeof createQuizInputSchema>;

const mcAnswerSchema = z.enum(["A", "B", "C", "D"]);

export const submitAttemptInputSchema = z.object({
  quizId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        // PG: "A"-"D" atau "" (kosong). Essay: teks bebas max 5000 char.
        userAnswer: z.string().max(5000, "Jawaban essay maksimal 5000 karakter."),
      })
    )
    .min(1),
});

export type SubmitAttemptInput = z.infer<typeof submitAttemptInputSchema>;

export function validateMcAnswer(value: string): value is "A" | "B" | "C" | "D" {
  return mcAnswerSchema.safeParse(value).success;
}

// --- Skema output AI (generate soal) ---

export const mcOptionSchema = z.object({
  label: z.enum(["A", "B", "C", "D"]),
  text: z.string().min(1),
});

export const generatedQuestionSchema = z.object({
  type: z.enum(["multiple_choice", "essay"]),
  questionText: z.string().min(1),
  options: z.array(mcOptionSchema).length(4).nullable(),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(1),
});

export const generatedQuizSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1).max(25),
});

export type GeneratedQuiz = z.infer<typeof generatedQuizSchema>;

// --- Skema output AI (grading essay batch) ---

export const essayGradeSchema = z.object({
  questionId: z.string().min(1),
  score: z.number().int().min(0).max(100),
  feedback: z.string().min(1),
});

export const essayGradingResultSchema = z.object({
  grades: z.array(essayGradeSchema).min(1),
});

export type EssayGradingResult = z.infer<typeof essayGradingResultSchema>;
