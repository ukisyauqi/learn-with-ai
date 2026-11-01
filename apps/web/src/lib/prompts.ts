import type { Difficulty } from "@/db/schema";

// ---------------------------------------------------------------------------
// Prompt #1: Generate soal. Disusun di apps/web, dieksekusi via ai-worker.
// ---------------------------------------------------------------------------

export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export function buildGenerateQuizMessages(
  topic: string,
  difficulty: Difficulty,
  mcCount: number,
  essayCount: number
): ChatMessage[] {
  const total = mcCount + essayCount;
  const system = [
    "Kamu adalah penyusun soal latihan yang teliti dan berbahasa Indonesia.",
    "Selalu jawab HANYA dengan JSON valid sesuai schema yang diminta, tanpa markdown, tanpa teks tambahan.",
  ].join(" ");

  const user = [
    `Buatkan paket soal latihan dengan ketentuan berikut:`,
    `- Topik: "${topic}"`,
    `- Tingkat kesulitan: "${difficulty}" (mudah = ingatan/pemahaman dasar, sedang = penerapan/analisis, sulit = analisis/evaluasi tingkat lanjut).`,
    `- Jumlah soal pilihan ganda: ${mcCount}`,
    `- Jumlah soal essay: ${essayCount}`,
    `- Total soal: ${total}. Urutkan soal pilihan ganda terlebih dahulu, diikuti soal essay.`,
    ``,
    `Bahasa soal: gunakan Bahasa Indonesia secara default. Jika topik secara eksplisit meminta bahasa lain (misalnya latihan grammar Bahasa Inggris/Jepang), sesuaikan bahasa soal dengan permintaan topik tersebut.`,
    ``,
    `Ketentuan soal pilihan ganda ("type": "multiple_choice"):`,
    `- Wajib memiliki tepat 4 opsi berlabel "A", "B", "C", "D" ("options": [{"label":"A","text":"..."}, ...]).`,
    `- Hanya ada 1 jawaban benar ("correctAnswer": "A"|"B"|"C"|"D").`,
    `- Opsi pengecoh (distractor) harus masuk akal sesuai tingkat kesulitan.`,
    `- "explanation" menjelaskan alasan jawaban benar dan mengapa opsi lain kurang tepat.`,
    ``,
    `Ketentuan soal essay ("type": "essay"):`,
    `- Pertanyaan menguji pemahaman konsep/analisis sesuai tingkat kesulitan.`,
    `- "options" bernilai null.`,
    `- "correctAnswer" berisi jawaban ideal beserta poin-poin kunci (rubrik) yang harus ada pada jawaban peserta.`,
    `- "explanation" berisi pembahasan lengkap topik yang ditanyakan.`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function generateQuizResponseFormat() {
  // JSON schema (Structured Outputs) untuk OpenAI Chat Completions.
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "quiz_generation",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["questions"],
        properties: {
          questions: {
            type: "array",
            minItems: 1,
            maxItems: 25,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "type",
                "questionText",
                "options",
                "correctAnswer",
                "explanation",
              ],
              properties: {
                type: {
                  type: "string",
                  enum: ["multiple_choice", "essay"],
                },
                questionText: { type: "string", minLength: 1 },
                options: {
                  type: ["array", "null"],
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["label", "text"],
                    properties: {
                      label: {
                        type: "string",
                        enum: ["A", "B", "C", "D"],
                      },
                      text: { type: "string", minLength: 1 },
                    },
                  },
                },
                correctAnswer: { type: "string", minLength: 1 },
                explanation: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Prompt #2: Grading essay batch (1 request untuk semua essay terisi)
// ---------------------------------------------------------------------------

export type EssayGradingItem = {
  questionId: string;
  questionText: string;
  idealAnswerAndRubric: string;
  userAnswer: string;
};

export function buildEssayGradingMessages(
  items: EssayGradingItem[]
): ChatMessage[] {
  const system = [
    "Kamu adalah penilai essay yang objektif dan konstruktif.",
    "Nilai berdasarkan ketepatan konsep, kelengkapan poin sesuai rubrik, dan kejelasan argumen.",
    "Selalu jawab HANYA dengan JSON valid sesuai schema yang diminta, tanpa markdown, tanpa teks tambahan.",
    "Gunakan Bahasa Indonesia untuk feedback.",
  ].join(" ");

  const payload = items.map((it) => ({
    questionId: it.questionId,
    questionText: it.questionText,
    idealAnswerAndRubric: it.idealAnswerAndRubric,
    userAnswer: it.userAnswer.slice(0, 5000),
  }));

  const user = [
    "Nilai jawaban essay berikut secara batch.",
    "Untuk setiap soal kembalikan: questionId (sama persis), score (bilangan bulat 0-100), feedback (Bahasa Indonesia: apa yang sudah tepat dan apa yang kurang/perlu diperbaiki).",
    "",
    "DATA SOAL & JAWABAN (JSON):",
    JSON.stringify(payload),
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function essayGradingResponseFormat() {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "essay_grading",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["grades"],
        properties: {
          grades: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["questionId", "score", "feedback"],
              properties: {
                questionId: { type: "string", minLength: 1 },
                score: {
                  type: "integer",
                  minimum: 0,
                  maximum: 100,
                },
                feedback: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
  };
}
