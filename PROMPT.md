# Prompt Spesifikasi Aplikasi: **Learn with AI** (AI-Powered Quiz & Study App)

Buatkan aplikasi web **Learn with AI** — sebuah platform belajar interaktif di mana pengguna dapat menghasilkan soal latihan (Pilihan Ganda & Essay) secara otomatis menggunakan AI berdasarkan topik dan tingkat kesulitan yang diinginkan, mengerjakan kuis tersebut, mendapatkan penilaian otomatis (termasuk koreksi jawaban Essay oleh AI beserta pembahasannya), serta mengerjakan ulang (*retake*) dan memantau riwayat hasil belajar mereka.

Arsitektur **monorepo (npm workspaces)** dengan 2 app:
- `apps/web` — Next.js App Router fullstack (auth, DB Turso, semua logika kuis, bangun prompt + validasi Zod).
- `apps/ai-worker` — Cloudflare Worker tipis sebagai **LLM gateway bodoh** (hanya teruskan `messages`/`response_format` ke OpenAI, kembalikan `content` mentah). Tidak pegang auth user, tidak pegang DB, tidak bangun prompt.

---

## 1. Tech Stack & Library Utama

Gunakan stack berikut secara ketat dan konsisten:

- **Monorepo**: `npm workspaces` dengan `apps/web` (Next.js) + `apps/ai-worker` (Cloudflare Worker). Tanpa Turborepo.
- **Framework (web)**: Next.js (App Router, Fullstack) dengan **TypeScript**
- **Styling & UI**: **Tailwind CSS** + **shadcn/ui** + **Phosphor Icons** (`@phosphor-icons/react`, antarmuka modern, bersih, responsif, menggunakan **Bahasa Indonesia**). Jangan pakai `lucide-react`.
- **Database**: **Turso** (libSQL / SQLite) menggunakan `@libsql/client`
- **ORM**: **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`)
- **Authentication**: **Auth.js / NextAuth v5** (`next-auth@beta`) + `@auth/drizzle-adapter` dengan provider **Google OAuth saja**
- **AI**: **`openai` Node.js SDK types** + **`zod`** di `apps/web` untuk menyusun prompt & Structured Outputs / JSON schema yang tervalidasi Zod; **`apps/ai-worker`** hanya mem-forward via `fetch` native ke OpenAI / OpenAI-compatible endpoint (tanpa logika prompt, tanpa validasi bisnis).
- **AI Gateway**: `apps/ai-worker` adalah satu-satunya pihak yang memegang `OPENAI_API_KEY`. `apps/web` TIDAK BOLEH menyimpan/membaca `OPENAI_API_KEY`. Komunikasi web → worker hanya **server-to-server** (dari Server Actions/Route Handler), tidak pernah langsung dari browser.

---

## 2. Konfigurasi Environment Variables

### A. `apps/web/.env.example` (Next.js — TANPA kunci OpenAI)

```env
# Database (Turso)
TURSO_DATABASE_URL="libsql://your-db-name.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"

# Auth.js (NextAuth v5 - Google OAuth)
AUTH_SECRET="your-auth-secret"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# AI Worker Gateway (server-to-server only, jangan expose ke client)
WORKER_URL="https://your-ai-worker.your-subdomain.workers.dev"
WORKER_SECRET="your-long-random-shared-secret"
```

### B. `apps/ai-worker/.dev.vars.example` + `wrangler secret` (Cloudflare Worker — satu-satunya pemegang kunci AI)

```env
# Wajib di-set via `wrangler secret put` untuk produksi, JANGAN commit
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
# Opsional: kosongkan untuk default OpenAI, atau isi endpoint OpenAI-compatible
OPENAI_BASE_URL=""
# Auth server-to-server, nilainya SAMA dengan WORKER_SECRET di apps/web
WORKER_SECRET="your-long-random-shared-secret"
# Guardrail (opsional tapi direkomendasikan)
ALLOWED_MODELS="gpt-4o-mini"
MAX_TOKENS="4000"
```

Aturan:
- `apps/web` membangun `messages` + `response_format` (JSON schema dari Zod) lalu `POST ${WORKER_URL}/chat` dengan header `Authorization: Bearer ${WORKER_SECRET}`.
- `apps/ai-worker` hanya: verifikasi Bearer → validasi batas (`max_tokens`, panjang `messages`, allowlist `model`) → tempel `OPENAI_API_KEY` → `fetch` ke `OPENAI_BASE_URL || https://api.openai.com/v1` → kembalikan `{ content }` mentah tanpa validasi bisnis. CORS browser dimatikan (tidak ada `Access-Control-Allow-Origin` untuk browser).
- Worker hanya menghitung CPU-time (nunggu OpenAI = I/O wait, tidak dihitung), jadi paket Free (10 ms CPU) cukup selama worker tetap tipis (tanpa Zod berat). Validasi Zod final tetap di `apps/web`.

---

## 3. Desain Skema Database (Drizzle ORM - SQLite/Turso)

Definisikan skema di `apps/web/src/db/schema.ts` menggunakan `drizzle-orm/sqlite-core`:

### A. Tabel Standar Auth.js
- `users`, `accounts`, `sessions`, `verificationTokens` sesuai spesifikasi `@auth/drizzle-adapter` untuk SQLite.

### B. Tabel Aplikasi (`quizzes`, `questions`, `quiz_attempts`, `attempt_answers`)

1. **`quizzes`** (Paket soal yang di-generate oleh user)
   - `id`: `text` (Primary Key, UUID / CUID / nanoid)
   - `userId`: `text` (Foreign Key -> `users.id`, `onDelete: "cascade"`, Not Null)
   - `topic`: `text` (Not Null) — topik yang diinput user
   - `difficulty`: `text` (`"mudah" | "sedang" | "sulit"`, Not Null)
   - `mcCount`: `integer` (Not Null) — jumlah soal Pilihan Ganda
   - `essayCount`: `integer` (Not Null) — jumlah soal Essay
   - `createdAt`: `integer` (timestamp mode, Not Null)

2. **`questions`** (Daftar butir soal dalam satu paket kuis)
   - `id`: `text` (Primary Key)
   - `quizId`: `text` (Foreign Key -> `quizzes.id`, `onDelete: "cascade"`, Not Null)
   - `orderIndex`: `integer` (Not Null) — urutan nomor soal (1, 2, 3, dst.)
   - `type`: `text` (`"multiple_choice" | "essay"`, Not Null)
   - `questionText`: `text` (Not Null) — teks pertanyaan
   - `options`: `text` (mode JSON: `Array<{ label: "A" | "B" | "C" | "D"; text: string }> | null`) — berisi 4 opsi (A-D) untuk soal PG, dan `null` untuk soal Essay
   - `correctAnswer`: `text` (Not Null) — untuk PG berisi `"A" | "B" | "C" | "D"`; untuk Essay berisi jawaban ideal / rubrik penilaian acuan
   - `explanation`: `text` (Not Null) — pembahasan konsep mengapa jawaban tersebut benar

3. **`quiz_attempts`** (Riwayat pengerjaan kuis; mendukung *multi-attempt* / *retake*)
   - `id`: `text` (Primary Key)
   - `quizId`: `text` (Foreign Key -> `quizzes.id`, `onDelete: "cascade"`, Not Null)
   - `userId`: `text` (Foreign Key -> `users.id`, `onDelete: "cascade"`, Not Null)
   - `totalScore`: `integer` (Not Null) — nilai akhir skala `0 - 100`
   - `mcScore`: `integer` (Nullable) — nilai rata-rata soal PG skala `0 - 100` (`null` jika `mcCount === 0`)
   - `essayScore`: `integer` (Nullable) — nilai rata-rata soal Essay skala `0 - 100` (`null` jika `essayCount === 0`)
   - `completedAt`: `integer` (timestamp mode, Not Null)

4. **`attempt_answers`** (Detail jawaban user per soal pada satu attempt)
   - `id`: `text` (Primary Key)
   - `attemptId`: `text` (Foreign Key -> `quiz_attempts.id`, `onDelete: "cascade"`, Not Null)
   - `questionId`: `text` (Foreign Key -> `questions.id`, `onDelete: "cascade"`, Not Null)
   - `userAnswer`: `text` (Not Null) — opsi yang dipilih (`"A"-"D"`) atau teks jawaban essay user (bisa string kosong jika tidak dijawab)
   - `isCorrect`: `integer` (boolean mode, Nullable) — `true`/`false` untuk PG, `null` untuk Essay
   - `score`: `integer` (Not Null) — skor butir soal skala `0 - 100` (untuk PG: `100` jika benar, `0` jika salah; untuk Essay: `0 - 100` hasil penilaian AI)
   - `aiFeedback`: `text` (Nullable) — umpan balik/evaluasi spesifik dari AI untuk jawaban Essay user (`null` untuk PG)

---

## 4. Spesifikasi Alur & Fitur Aplikasi

### A. Autentikasi & Keamanan Data
1. **Google OAuth Only**: Halaman publik (`/`) menampilkan landing page singkat tentang **Learn with AI** dan tombol **"Masuk dengan Google"**.
2. **Proteksi Route**: Semua halaman di dalam `/dashboard` dan `/quiz/...` wajib login. Jika belum login, redirect ke `/`.
3. **Isolasi Data per User**: Setiap query dan mutasi (melihat kuis, mengambil soal, submit jawaban, melihat hasil attempt, menghapus kuis) **wajib** memverifikasi bahwa `quiz.userId === session.user.id`.

### B. Dashboard & Form Generate Soal (`/dashboard`)
1. **Ringkasan Statistik**: Tampilkan kartu ringkasan singkat milik user (Total Kuis Dibuat, Total Pengerjaan/Attempt, Rata-rata Skor).
2. **Form Buat Kuis Baru**:
   - **Topik Pembelajaran** (`topic`): Input teks (contoh: *"Dasar React Hooks"*, *"Sejarah Kemerdekaan Indonesia"*, *"Sistem Persamaan Linear Dua Variabel"*). Minimal 3 karakter, maksimal 200 karakter.
   - **Tingkat Kesulitan** (`difficulty`): Pilihan `"mudah"` (Mudah), `"sedang"` (Sedang), `"sulit"` (Sulit).
   - **Jumlah Soal Pilihan Ganda** (`mcCount`): Input angka `0` s/d `20` (default: `5`).
   - **Jumlah Soal Essay** (`essayCount`): Input angka `0` s/d `5` (default: `2`).
   - **Validasi**: `mcCount + essayCount` minimal `1`.
   - Saat proses generate berlangsung, tampilkan *loading state* yang jelas (misal: *"AI sedang menyusun soal untuk topik [Topik]..."*) dan disable tombol submit agar tidak terjadi double-request.
   - Setelah soal berhasil di-generate dan disimpan ke database, arahkan user langsung ke halaman pengerjaan kuis (`/quiz/[quizId]/take`).
3. **Daftar Kuis Saya (Quiz Library)**:
   - Menampilkan daftar kuis yang pernah dibuat oleh user (diurutkan dari yang terbaru).
   - Setiap kartu kuis menampilkan:
     - Judul Topik & Badge Tingkat Kesulitan (Mudah / Sedang / Sulit)
     - Informasi jumlah soal (misal: `5 PG • 2 Essay`) & tanggal dibuat
     - Jumlah attempt yang sudah dilakukan & Skor Terbaik / Skor Terakhir (jika sudah pernah dikerjakan)
     - Tombol **"Kerjakan"** (atau **"Kerjakan Ulang"** jika sudah pernah dikerjakan) -> menuju `/quiz/[quizId]/take`
     - Tombol **"Riwayat & Hasil"** -> menuju `/quiz/[quizId]` (melihat daftar semua attempt dan pembahasannya)
     - Tombol **"Hapus"** (dengan dialog konfirmasi) untuk menghapus paket kuis.

### C. Integrasi AI #1: Generate Soal (prompt di Next, eksekusi via Worker)
1. `apps/web` menyusun prompt + JSON schema (Zod) lalu memanggil `POST ${WORKER_URL}/chat` (server-to-server, header `Authorization: Bearer ${WORKER_SECRET}`) dengan body `{ messages, response_format, max_tokens }`.
2. `apps/ai-worker` (`POST /chat`) hanya mem-forward ke OpenAI Chat Completions dan mengembalikan `{ content }` mentah. Semua aturan prompt, jumlah soal, dan validasi Zod ada di `apps/web`.
3. Pasang `export const maxDuration = 60;` pada page/route yang memanggil generate (generate 20 PG + 5 essay bisa 30-90 detik; streaming tidak membebaskan timeout, hanya mempercepat first-byte).
2. **Aturan Prompt Generate Soal**:
   - Buat tepat sejumlah `mcCount` soal Pilihan Ganda dan `essayCount` soal Essay sesuai `topic` dan `difficulty`.
   - Urutkan soal Pilihan Ganda terlebih dahulu, diikuti soal Essay.
   - **Bahasa Soal**: Gunakan Bahasa Indonesia secara default, namun otomatis sesuaikan bila topik secara eksplisit meminta bahasa lain (misal latihan grammar Bahasa Inggris/Jepang).
   - **Ketentuan Soal Pilihan Ganda (`multiple_choice`)**:
     - Wajib memiliki tepat **4 opsi** berlabel `"A"`, `"B"`, `"C"`, dan `"D"`.
     - Hanya ada 1 jawaban yang benar (`correctAnswer`: `"A" | "B" | "C" | "D"`).
     - Opsi pengecoh (*distractor*) harus masuk akal sesuai tingkat kesulitan.
     - Sertakan `explanation` yang menjelaskan alasan jawaban benar dan mengapa opsi lain kurang tepat.
   - **Ketentuan Soal Essay (`essay`)**:
     - Pertanyaan harus menguji pemahaman konsep/analisis sesuai tingkat kesulitan.
     - `options` bernilai `null`.
     - `correctAnswer` berisi jawaban ideal beserta poin-poin kunci (rubrik) yang harus ada pada jawaban user.
     - `explanation` berisi pembahasan lengkap mengenai topik yang ditanyakan.

### D. Halaman Pengerjaan Kuis (`/quiz/[quizId]/take`)
1. **Keamanan Payload**: Saat memuat daftar soal untuk dikerjakan di client, **JANGAN** kirim field `correctAnswer` dan `explanation` ke browser agar user tidak bisa mengintip kunci jawaban lewat inspect/network tab.
2. **Tampilan Satu Soal per Halaman (Tanpa Timer)**:
   - Tampilkan **1 soal aktif** pada satu waktu (tanpa batas waktu/timer).
   - Tampilkan nomor soal saat ini, badge tipe soal (`Pilihan Ganda` atau `Essay`), dan teks pertanyaan.
   - Jika soal **Pilihan Ganda**: tampilkan 4 kartu radio interaktif (A, B, C, D) yang nyaman diklik.
   - Jika soal **Essay**: tampilkan `Textarea` yang lega untuk mengetik jawaban uraian.
3. **Navigasi & Panel Nomor Soal**:
   - Tombol **"Sebelumnya"** dan **"Selanjutnya"** di bawah soal.
   - **Panel / Grid Nomor Soal** (di sidebar pada layar desktop atau drawer/bar di mobile):
     - Menampilkan seluruh nomor soal (`1..N`).
     - Indikator visual yang berbeda untuk: **Soal Aktif**, **Sudah Dijawab**, dan **Belum Dijawab**.
     - User bisa klik nomor mana saja untuk langsung melompat ke soal tersebut.
4. **Auto-Save Jawaban Sementara di `localStorage`**:
   - Simpan state jawaban sementara ke `localStorage` dengan key unik `quiz_draft_${userId}_${quizId}` setiap kali user memilih opsi atau mengetik jawaban essay.
   - Jika halaman tidak sengaja ter-refresh, pulihkan jawaban dari `localStorage`.
   - Tampilkan tombol **"Kumpulkan Jawaban (Submit)"** (dengan dialog konfirmasi, terutama bila masih ada soal yang belum dijawab).
   - Setelah submit berhasil, bersihkan draft di `localStorage` dan redirect ke halaman hasil `/quiz/[quizId]/attempt/[attemptId]`.

### E. Integrasi AI #2: Sistem Penilaian (Grading) & Koreksi Essay
Saat user menekan tombol Submit, jalankan proses penilaian di server `apps/web` (tulis `quiz_attempts` + `attempt_answers` dalam **satu transaksi Drizzle**; gunakan `maxDuration = 60` karena grading batch menunggu AI):

1. **Penilaian Soal Pilihan Ganda (Otomatis/Deterministik)**:
   - Bandingkan jawaban user (`"A" | "B" | "C" | "D"`) dengan `question.correctAnswer`.
   - Jika sama: `isCorrect = true`, `score = 100`.
   - Jika berbeda atau kosong: `isCorrect = false`, `score = 0`.
2. **Penilaian Soal Essay (AI Grading secara Batch via Worker)**:
   - Untuk soal Essay yang jawabannya **kosong** (hanya spasi / tidak diisi): langsung beri `score = 0` dan `aiFeedback = "Tidak ada jawaban yang diberikan."` tanpa memanggil AI.
   - Untuk soal Essay yang **diisi oleh user**: kumpulkan semuanya dan kirim dalam **1 kali request (batch)** ke `POST ${WORKER_URL}/chat` (`messages` berisi `questionId`, `questionText`, `idealAnswerAndRubric` (`correctAnswer`), `userAnswer`; `response_format` = JSON schema Zod) lalu validasi respons dengan Zod di `apps/web`.
   - Berikan konteks ke AI untuk setiap soal: `questionId`, `questionText`, `idealAnswerAndRubric` (`correctAnswer`), dan `userAnswer`.
   - Minta AI mengevaluasi setiap jawaban secara objektif dan mengembalikan:
     - `questionId`: ID soal
     - `score`: Bilangan bulat `0 - 100` berdasarkan ketepatan konsep, kelengkapan poin sesuai rubrik, dan kejelasan argumen.
     - `feedback`: Umpan balik konstruktif dalam Bahasa Indonesia (apa yang sudah tepat dari jawaban user dan apa yang masih kurang/perlu diperbaiki).
3. **Perhitungan Skor Akhir (`0 - 100`)**:
   - Setiap butir soal (baik PG maupun Essay) memiliki skor `0 - 100`.
   - `mcScore`: Rata-rata skor dari seluruh soal PG (dibulatkan ke integer terdekat, atau `null` jika tidak ada soal PG).
   - `essayScore`: Rata-rata skor dari seluruh soal Essay (dibulatkan ke integer terdekat, atau `null` jika tidak ada soal Essay).
   - `totalScore`: Rata-rata skor dari **seluruh** soal pada kuis tersebut (`Math.round(sumAllQuestionScores / totalQuestions)`), menghasilkan nilai akhir dalam skala `0 - 100`.
4. Simpan record ke `quiz_attempts` dan `attempt_answers` di dalam database, lalu arahkan user ke `/quiz/[quizId]/attempt/[attemptId]`.

### F. Halaman Hasil, Pembahasan, & Riwayat Attempt
1. **Halaman Detail Hasil Attempt (`/quiz/[quizId]/attempt/[attemptId]`)**:
   - **Header Skor**: Tampilkan Nilai Akhir (`totalScore` / 100) dengan indikator visual (misal warna hijau `>= 80`, kuning `60 - 79`, merah `< 60`), rincian Skor Pilihan Ganda (`mcScore`), Skor Essay (`essayScore`), serta waktu pengerjaan.
   - **Tombol Aksi**: **"Kerjakan Ulang Kuis Ini"** (`/quiz/[quizId]/take`), **"Riwayat Attempt"** (`/quiz/[quizId]`), dan **"Kembali ke Dashboard"** (`/dashboard`).
   - **Review & Pembahasan Per Soal**:
     - Tampilkan seluruh soal berurutan dari nomor 1 s/d selesai.
     - **Untuk Soal Pilihan Ganda**:
       - Tampilkan badge **Benar (+100)** atau **Salah (0)**.
       - Tampilkan ke-4 opsi (A-D) dengan penanda jelas mana **Jawaban Kamu** dan mana **Kunci Jawaban yang Benar**.
       - Tampilkan kotak **Pembahasan** (`explanation`).
     - **Untuk Soal Essay**:
       - Tampilkan badge **Skor AI: `[score]/100`**.
       - Tampilkan **Jawaban Kamu**.
       - Tampilkan kotak **Evaluasi & Feedback AI** (`aiFeedback`).
       - Tampilkan kotak **Jawaban Ideal / Rubrik** (`correctAnswer`) dan **Pembahasan** (`explanation`).
2. **Halaman Detail Kuis & Riwayat Attempt (`/quiz/[quizId]`)**:
   - Menampilkan informasi paket kuis (Topik, Kesulitan, Jumlah PG & Essay).
   - Menampilkan tabel/daftar seluruh riwayat percobaan (*attempts*) yang pernah dilakukan user pada kuis ini (Attempt #1, #2, dst. beserta tanggal, skor PG, skor Essay, skor Total, dan tombol **"Lihat Pembahasan"**).
   - Menyediakan tombol **"Kerjakan Sekarang / Retake"**.

---

## 5. Struktur Direktori (Monorepo)

```text
learn-with-ai/
├── package.json                 # npm workspaces: ["apps/*"]
├── apps/
│   ├── web/                     # Next.js fullstack (semua fitur PROMPT ini)
│   │   ├── drizzle.config.ts
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/auth/[...nextauth]/route.ts
│   │   │   │   ├── dashboard/page.tsx         # export const maxDuration = 60
│   │   │   │   ├── quiz/[quizId]/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── take/page.tsx
│   │   │   │   │   └── attempt/[attemptId]/page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── actions/quiz.ts                # generateQuiz, submitQuizAttempt, deleteQuiz (transaksi)
│   │   │   ├── components/ui/ + navbar.tsx + create-quiz-form.tsx + quiz-player.tsx + delete-quiz-button.tsx
│   │   │   ├── db/index.ts + schema.ts
│   │   │   └── lib/auth.ts + ai-client.ts     # fetch WORKER_URL/chat + Bearer WORKER_SECRET
│   │   │       + prompts.ts + validations.ts + utils.ts
│   │   └── .env.example
│   └── ai-worker/               # Cloudflare Worker — LLM gateway bodoh (1 route)
│       ├── src/index.ts         # POST /chat: cek Bearer → cap guardrail → fetch OpenAI → { content }
│       ├── wrangler.toml
│       └── .dev.vars.example
```

---

## 6. Kriteria Kualitas & Edge Cases yang Wajib Ditangani

1. **Type Safety & Validasi**: Gunakan Zod di `apps/web` untuk memvalidasi input form di Server Actions serta memvalidasi `content` yang dikembalikan Worker. Worker tidak melakukan validasi bisnis.
2. **Error Handling AI & Jaringan**: Jika Worker/OpenAI gagal merespons atau mengembalikan format tidak valid, tangkap error dengan rapi dan tampilkan pesan error yang ramah kepada pengguna (menggunakan toast atau alert di form) tanpa membuat aplikasi crash. Jangan teruskan error mentah OpenAI ke client.
3. **Keamanan Worker (wajib)**: `POST /chat` wajib cek `Authorization: Bearer WORKER_SECRET`, tanpa CORS browser, hanya dipanggil server-to-server dari `apps/web`. Terapkan guardrail: allowlist `model`, cap `max_tokens` dan panjang `messages`, sanitasi error. Tanpa auth = kuota OpenAI bisa dikuras publik.
4. **Timeout**: Pasang `export const maxDuration = 60;` pada route generate/submit. Streaming tidak membebaskan timeout Vercel; limit Worker dihitung dari CPU-time (nunggu OpenAI = I/O, tidak dihitung) sehingga Worker boleh tetap tipis di paket Free.
5. **Transaksional**: Insert `quizzes + questions` (generate) dan `quiz_attempts + attempt_answers` (submit) masing-masing dalam satu transaksi Drizzle. Validasi juga `userAnswer` PG (`A`-`D`), batasi panjang essay (misal max 5000 char), dan verifikasi `attempt.userId === session.user.id` di halaman hasil.
6. **Zero-Question Type Case**:
   - Jika user meminta `5 PG` dan `0 Essay`, sistem tidak perlu memanggil AI saat proses *submit* (cukup nilai PG secara instan di server).
   - Jika user meminta `0 PG` dan `3 Essay`, perhitungan skor akhir sepenuhnya diambil dari rata-rata skor Essay.
7. **Konfigurasi Drizzle**: Sertakan `drizzle.config.ts` dan script di `package.json` (`db:push`, `db:generate`, `db:studio`) agar mudah dihubungkan ke database Turso milik user.
