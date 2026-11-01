import type { ChatMessage } from "./prompts";

type CallWorkerArgs = {
  messages: ChatMessage[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response_format?: any;
  max_tokens?: number;
  model?: string;
  /** ID sesi stabil per percakapan (diteruskan sebagai x-opencode-session). */
  sessionId?: string;
};

export class AiWorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiWorkerError";
  }
}

/**
 * Server-to-server call ke apps/ai-worker (POST /chat).
 * TIDAK PERNAH dipanggil dari browser. WORKER_URL & WORKER_SECRET hanya ada di server.
 */
export async function callAiWorker({
  messages,
  response_format,
  max_tokens = 4000,
  model,
  sessionId,
}: CallWorkerArgs): Promise<string> {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;

  if (!workerUrl || !workerSecret) {
    throw new AiWorkerError(
      "Konfigurasi AI belum lengkap (WORKER_URL / WORKER_SECRET)."
    );
  }

  let res: Response;
  try {
    res = await fetch(`${workerUrl.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        messages,
        response_format,
        max_tokens,
        model,
        session_id: sessionId ?? crypto.randomUUID(),
      }),
    });
  } catch {
    throw new AiWorkerError(
      "Tidak dapat menghubungi layanan AI. Periksa koneksi lalu coba lagi."
    );
  }

  if (!res.ok) {
    // Jangan teruskan error mentah ke client; petakan ke pesan ramah.
    if (res.status === 401 || res.status === 403) {
      throw new AiWorkerError("Konfigurasi layanan AI tidak valid.");
    }
    if (res.status === 429) {
      throw new AiWorkerError(
        "Layanan AI sedang sibuk (rate limit). Coba lagi beberapa saat."
      );
    }
    throw new AiWorkerError(
      "Layanan AI gagal memproses permintaan. Coba lagi beberapa saat."
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AiWorkerError("Respons layanan AI tidak valid.");
  }

  const content = (data as { content?: unknown })?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new AiWorkerError("Respons layanan AI kosong.");
  }
  return content;
}

/** Ambil JSON dari content mentah (toleran terhadap ```json fence). */
export function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : trimmed;
  return JSON.parse(raw);
}
