import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Saat build tanpa env (CI), pakai file lokal agar `next build` tidak crash.
// Saat runtime tanpa TURSO_DATABASE_URL, query akan gagal dengan pesan jelas.
const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const turso = createClient({ url, authToken });

export const db = drizzle(turso, { schema });

export type Db = typeof db;
