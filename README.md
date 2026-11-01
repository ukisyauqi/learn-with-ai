# Learn with AI

Platform belajar interaktif: generate soal (PG & Essay) dengan AI, kerjakan kuis, dapatkan penilaian otomatis + pembahasan.

Monorepo (`npm workspaces`):

- `apps/web` — Next.js App Router fullstack (auth, DB Turso, logika kuis, prompt + validasi Zod).
- `apps/ai-worker` — Cloudflare Worker tipis sebagai LLM gateway (hanya forward `messages`/`response_format` ke OpenAI).

## Menjalankan lokal

1. `cp apps/web/.env.example apps/web/.env` lalu isi Turso + Google OAuth + `WORKER_URL`/`WORKER_SECRET`.
2. `cp apps/ai-worker/.dev.vars.example apps/ai-worker/.dev.vars` lalu isi `OPENAI_API_KEY` + `WORKER_SECRET` (sama dengan web).
3. Install & migrasi:

```bash
npm install
npm run db:push --workspace=@learn-with-ai/web
npm run dev:web
```

4. Worker (terminal lain):

```bash
cd apps/ai-worker
npx wrangler dev
# produksi: wrangler secret put OPENAI_API_KEY / WORKER_SECRET lalu wrangler deploy
```

Flow AI: `apps/web` (Server Actions) → `POST ${WORKER_URL}/chat` + `Bearer WORKER_SECRET` → Worker forward ke OpenAI → `{ content }` mentah → validasi Zod di web.
