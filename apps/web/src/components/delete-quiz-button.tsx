"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { deleteQuiz } from "@/actions/quiz";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export function DeleteQuizButton({
  quizId,
  topic,
}: {
  quizId: string;
  topic: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await deleteQuiz(quizId);
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600">
          <Trash className="h-4 w-4" />
          Hapus
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus kuis?</DialogTitle>
          <DialogDescription>
            Paket kuis &quot;{topic}&quot; beserta seluruh riwayat pengerjaannya
            akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Menghapus..." : "Ya, hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
