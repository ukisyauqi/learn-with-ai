import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

export function scoreBadgeClass(score: number): string {
  if (score >= 80)
    return "bg-green-100 text-green-800 border-green-200";
  if (score >= 60)
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
}

export const difficultyLabel: Record<string, string> = {
  mudah: "Mudah",
  sedang: "Sedang",
  sulit: "Sulit",
};
