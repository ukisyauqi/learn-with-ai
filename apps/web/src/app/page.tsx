import { redirect } from "next/navigation";
import { Brain, Robot, ChartLineUp, PencilLine } from "@phosphor-icons/react/dist/ssr";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl py-10 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Brain className="h-9 w-9" weight="bold" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight">
        Learn with AI
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
        Platform belajar interaktif: buat soal latihan (Pilihan Ganda &amp;
        Essay) otomatis dengan AI berdasarkan topik dan tingkat kesulitan,
        kerjakan kuisnya, dan dapatkan penilaian serta pembahasan langsung.
      </p>

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <Button size="lg" type="submit">
          Masuk dengan Google
        </Button>
      </form>

      <div className="mt-12 grid gap-4 text-left sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <Robot className="mb-2 h-6 w-6 text-primary" weight="bold" />
            <p className="font-semibold">Generate soal otomatis</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pilih topik, kesulitan, dan jumlah soal. AI menyusun PG + Essay
              lengkap dengan kunci &amp; pembahasan.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <PencilLine className="mb-2 h-6 w-6 text-primary" weight="bold" />
            <p className="font-semibold">Kerjakan &amp; retake</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Kerjakan satu soal per layar, jawaban tersimpan otomatis, dan bisa
              mengerjakan ulang kapan saja.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <ChartLineUp className="mb-2 h-6 w-6 text-primary" weight="bold" />
            <p className="font-semibold">Nilai &amp; pembahasan AI</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Essay dikoreksi AI dengan feedback konstruktif. Pantau skor dan
              riwayat belajarmu.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
