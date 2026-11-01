"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "@phosphor-icons/react";
import { generateQuiz } from "@/actions/quiz";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function CreateQuizForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [topic, setTopic] = useState("");
  const [generatingLabel, setGeneratingLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const t = String(formData.get("topic") ?? "");
    setGeneratingLabel(t);
    startTransition(async () => {
      const res = await generateQuiz(formData);
      if (res.ok) {
        router.push(`/quiz/${res.quizId}/take`);
      } else {
        setError(res.error);
        setGeneratingLabel("");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkle className="h-5 w-5 text-primary" weight="fill" />
          Buat Kuis Baru
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="topic">Topik Pembelajaran</Label>
            <Input
              id="topic"
              name="topic"
              placeholder='cth: Dasar React Hooks, Sejarah Kemerdekaan Indonesia, SPLDV'
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              minLength={3}
              maxLength={200}
              required
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="difficulty">Tingkat Kesulitan</Label>
            <select
              id="difficulty"
              name="difficulty"
              defaultValue="sedang"
              disabled={isPending}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="mudah">Mudah</option>
              <option value="sedang">Sedang</option>
              <option value="sulit">Sulit</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="mcCount">Soal Pilihan Ganda (0–20)</Label>
              <Input
                id="mcCount"
                name="mcCount"
                type="number"
                min={0}
                max={20}
                defaultValue={5}
                required
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="essayCount">Soal Essay (0–5)</Label>
              <Input
                id="essayCount"
                name="essayCount"
                type="number"
                min={0}
                max={5}
                defaultValue={2}
                required
                disabled={isPending}
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending
              ? `AI sedang menyusun soal untuk topik ${generatingLabel || "..."}...`
              : "Generate Soal dengan AI"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Minimal 1 soal (PG + Essay). Proses generate bisa memakan waktu 30–90
            detik untuk paket besar.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
