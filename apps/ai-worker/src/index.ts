/**
 * apps/ai-worker — Cloudflare Worker tipis sebagai LLM gateway.
 * Satu-satunya pihak yang memegang OPENAI_API_KEY.
 *
 * POST /chat
 *   Header: Authorization: Bearer <WORKER_SECRET>
 *   Body:   { model?, messages: [{role, content}...], response_format?, max_tokens? }
 *   Return: { content: string } (mentah dari OpenAI, tanpa validasi bisnis)
 *
 * Guardrail: cek Bearer, tanpa CORS browser, allowlist model, cap max_tokens
 * dan panjang messages, sanitasi error. Validasi Zod final ada di apps/web.
 */

export interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
  WORKER_SECRET: string;
  ALLOWED_MODELS?: string;
  MAX_TOKENS?: string;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatBody = {
  model?: unknown;
  messages?: unknown;
  response_format?: unknown;
  max_tokens?: unknown;
  temperature?: unknown;
  session_id?: unknown;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  // Perbandingan waktu-konstan sederhana untuk secret.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "learn-with-ai-worker" });
    }

    if (url.pathname !== "/chat" || request.method !== "POST") {
      return json({ error: "Not found" }, 404);
    }

    // --- Auth server-to-server ---
    const authHeader = request.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!env.WORKER_SECRET || !token || !safeEqual(token, env.WORKER_SECRET)) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "AI service misconfigured" }, 500);
    }

    let body: ChatBody;
    try {
      body = (await request.json()) as ChatBody;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // --- Guardrail: model allowlist ---
    const defaultModel = env.OPENAI_MODEL || "gpt-4o-mini";
    const allowed = (env.ALLOWED_MODELS || defaultModel)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const model =
      typeof body.model === "string" && body.model.length > 0
        ? body.model
        : defaultModel;
    if (!allowed.includes(model)) {
      return json({ error: "Model not allowed" }, 400);
    }

    // --- Guardrail: messages ---
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: "messages must be a non-empty array" }, 400);
    }
    if (body.messages.length > 20) {
      return json({ error: "Too many messages" }, 400);
    }
    const messages: ChatMessage[] = [];
    let totalChars = 0;
    for (const m of body.messages as unknown[]) {
      const msg = m as Partial<ChatMessage>;
      if (
        !msg ||
        (msg.role !== "system" && msg.role !== "user" && msg.role !== "assistant") ||
        typeof msg.content !== "string"
      ) {
        return json({ error: "Invalid message format" }, 400);
      }
      if (msg.content.length > 20000) {
        return json({ error: "Message too long" }, 400);
      }
      totalChars += msg.content.length;
      messages.push({ role: msg.role, content: msg.content });
    }
    if (totalChars > 60000) {
      return json({ error: "Payload too large" }, 400);
    }

    // --- Guardrail: max_tokens ---
    const hardCap = Number(env.MAX_TOKENS || "16000");
    let maxTokens = 4000;
    if (typeof body.max_tokens === "number" && Number.isFinite(body.max_tokens)) {
      maxTokens = Math.floor(body.max_tokens);
    }
    if (maxTokens < 1) maxTokens = 1;
    if (maxTokens > hardCap) maxTokens = hardCap;

    const baseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
      /\/$/,
      ""
    );

    // OpenCode Go mewajibkan header sesi stabil per percakapan.
    const sessionId =
      typeof body.session_id === "string" && body.session_id.length > 0
        ? body.session_id.slice(0, 128)
        : crypto.randomUUID();

    // --- Forward ke OpenAI Chat Completions ---
    let upstream: Response;
    try {
      upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "x-opencode-session": sessionId,
        },
        body: JSON.stringify({
          model,
          messages,
          ...(body.response_format !== undefined
            ? { response_format: body.response_format }
            : {}),
          max_tokens: maxTokens,
          ...(typeof body.temperature === "number"
            ? { temperature: body.temperature }
            : {}),
        }),
      });
    } catch {
      return json({ error: "AI provider unreachable" }, 502);
    }

    if (!upstream.ok) {
      // Sanitasi: jangan teruskan body mentah OpenAI (bisa memuat key/detail).
      return json({ error: "AI provider error" }, 502);
    }

    let data: unknown;
    try {
      data = await upstream.json();
    } catch {
      return json({ error: "Invalid AI provider response" }, 502);
    }

    const content = (data as { choices?: { message?: { content?: unknown } }[] })
      ?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      return json({ error: "Empty AI provider response" }, 502);
    }

    // Tanpa CORS browser: tidak ada Access-Control-Allow-Origin.
    return json({ content });
  },
};
