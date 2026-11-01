"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, PaperPlaneTilt } from "@phosphor-icons/react";
import { submitQuizAttempt } from "@/actions/quiz";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { cn } from "@/lib/utils";

export type TakeQuestion = {
  id: string;
  orderIndex: number;
  type: "multiple_choice" | "essay";
  questionText: string;
  options: { label: string; text: string }[] | null;
};

export function QuizPlayer({
  quizId,
  userId,
  questions,
}: {
  quizId: string;
  userId: string;
  questions: TakeQuestion[];
}) {
  const router = useRouter();
  const storageKey = `quiz_draft_${userId}_${quizId}`;
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sorted = useMemo(
    () => [...questions].sort((a, b) => a.orderIndex - b.orderIndex),
    [questions]
  );
  const current = sorted[active];
  const unanswered = sorted.filter((q) => !(answers[q.id] ?? "").trim()).length;

  // Pulihkan draft dari localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        const filtered: Record<string, string> = {};
        for (const q of questions) {
          if (typeof parsed[q.id] === "string") {
            filtered[q.id] = parsed[q.id].slice(0, 5000);
          }
        }
        setAnswers(filtered);
      }
    } catch {
      // Abaikan draft rusak.
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Auto-save setiap perubahan.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {
      // Storage penuh / mode privat: abaikan.
    }
  }, [answers, loaded, storageKey]);

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value.slice(0, 5000) }));
  }

  function handleSubmit() {
    setError(null);
    setConfirmOpen(false);
    startTransition(async () => {
      const res = await submitQuizAttempt({
        quizId,
        answers: sorted.map((q) => ({
          questionId: q.id,
          userAnswer: answers[q.id] ?? "",
        })),
      });
      if (res.ok) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // abaikan
        }
        router.push(`/quiz/${quizId}/attempt/${res.attemptId}`);
      } else {
        setError(res.error);
      }
    });
  }

  if (!current) {
    return <p className="text-sm text-muted-foreground">Soal tidak tersedia.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
      <div className="grid gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Soal {active + 1} dari {sorted.length}
              </span>
              <Badge variant={current.type === "multiple_choice" ? "default" : "secondary"}>
                {current.type === "multiple_choice" ? "Pilihan Ganda" : "Essay"}
              </Badge>
            </div>
            <p className="whitespace-pre-wrap text-base font-medium leading-relaxed">
              {current.questionText}
            </p>

            {current.type === "multiple_choice" ? (
              <div className="mt-4 grid gap-2">
                {(current.options ?? []).map((opt) => {
                  const selected = (answers[current.id] ?? "") === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setAnswer(current.id, opt.label)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-primary/50 hover:bg-accent"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background"
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="text-sm">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Textarea
                className="mt-4 min-h-40"
                placeholder="Tulis jawaban uraianmu di sini..."
                value={answers[current.id] ?? ""}
                maxLength={5000}
                onChange={(e) => setAnswer(current.id, e.target.value)}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setActive((i) => Math.max(0, i - 1))}
            disabled={active === 0}
          >
            <ArrowLeft className="h-4 w-4" />
            Sebelumnya
          </Button>
          <span className="text-xs text-muted-foreground">
            Jawaban tersimpan otomatis di perangkat ini.
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setActive((i) => Math.min(sorted.length - 1, i + 1))
            }
            disabled={active === sorted.length - 1}
          >
            Selanjutnya
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button disabled={isPending}>
              <PaperPlaneTilt className="h-4 w-4" />
              {isPending ? "Menilai jawaban..." : "Kumpulkan Jawaban (Submit)"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kumpulkan jawaban?</DialogTitle>
              <DialogDescription>
                {unanswered === 0
                  ? "Semua soal sudah dijawab. Lanjutkan untuk dinilai?"
                  : `Masih ada ${unanswered} soal yang belum dijawab. Kamu tetap bisa mengumpulkan — soal kosong akan dinilai 0.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Periksa lagi
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Memproses..." : "Ya, kumpulkan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {isPending && (
          <p className="text-sm text-muted-foreground">
            AI sedang menilai jawaban essay-mu. Ini bisa memakan waktu hingga
            sekitar satu menit...
          </p>
        )}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 text-sm font-medium">Navigasi Soal</p>
            <div className="grid grid-cols-5 gap-2 lg:grid-cols-4">
              {sorted.map((q, i) => {
                const val = (answers[q.id] ?? "").trim();
                const isActive = i === active;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setActive(i)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : val
                          ? "border-green-300 bg-green-50 text-green-800"
                          : "bg-background hover:bg-accent"
                    )}
                    title={`Soal ${i + 1}${val ? " (sudah dijawab)" : " (belum dijawab)"}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />
                Soal aktif
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-400" />
                Sudah dijawab
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-gray-300" />
                Belum dijawab
              </span>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
