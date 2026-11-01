import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------------------------------------------------------------------------
// Tabel standar Auth.js (@auth/drizzle-adapter, SQLite)
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("sessionToken").primaryKey().notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ---------------------------------------------------------------------------
// Tabel aplikasi
// ---------------------------------------------------------------------------

export type Difficulty = "mudah" | "sedang" | "sulit";
export type QuestionType = "multiple_choice" | "essay";
export type McOptionLabel = "A" | "B" | "C" | "D";

export type McOption = {
  label: McOptionLabel;
  text: string;
};

export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey().notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  difficulty: text("difficulty").$type<Difficulty>().notNull(),
  mcCount: integer("mcCount").notNull(),
  essayCount: integer("essayCount").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey().notNull(),
  quizId: text("quizId")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  orderIndex: integer("orderIndex").notNull(),
  type: text("type").$type<QuestionType>().notNull(),
  questionText: text("questionText").notNull(),
  options: text("options", { mode: "json" }).$type<McOption[] | null>(),
  correctAnswer: text("correctAnswer").notNull(),
  explanation: text("explanation").notNull(),
});

export const quizAttempts = sqliteTable("quiz_attempts", {
  id: text("id").primaryKey().notNull(),
  quizId: text("quizId")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  totalScore: integer("totalScore").notNull(),
  mcScore: integer("mcScore"),
  essayScore: integer("essayScore"),
  completedAt: integer("completedAt", { mode: "timestamp_ms" }).notNull(),
});

export const attemptAnswers = sqliteTable("attempt_answers", {
  id: text("id").primaryKey().notNull(),
  attemptId: text("attemptId")
    .notNull()
    .references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: text("questionId")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  userAnswer: text("userAnswer").notNull(),
  isCorrect: integer("isCorrect", { mode: "boolean" }),
  score: integer("score").notNull(),
  aiFeedback: text("aiFeedback"),
});
