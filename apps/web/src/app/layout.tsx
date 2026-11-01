import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learn with AI — Kuis & Latihan Belajar",
  description:
    "Platform belajar interaktif: generate soal dengan AI, kerjakan kuis, dan dapatkan penilaian otomatis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <Navbar />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
