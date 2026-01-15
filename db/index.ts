import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// 清理 DATABASE_URL（移除可能的 psql 前缀和引号）
let cleanDbUrl = process.env.DATABASE_URL.trim();
if (cleanDbUrl.startsWith("psql ")) {
  cleanDbUrl = cleanDbUrl.replace(/^psql\s+/, "");
}
cleanDbUrl = cleanDbUrl.replace(/^['"]|['"]$/g, "");

const pool = new Pool({
  connectionString: cleanDbUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: cleanDbUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
