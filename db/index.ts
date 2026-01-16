import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// 在非 Next.js 环境中加载环境变量（例如脚本执行时）
if (!process.env.DATABASE_URL && typeof window === 'undefined') {
  try {
    require('dotenv').config({ path: '.env.local' });
  } catch (error) {
    // 如果 dotenv 不可用，继续执行
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// 清理 DATABASE_URL（移除可能的 psql 前缀和引号）
let cleanDbUrl = process.env.DATABASE_URL!.trim();
if (cleanDbUrl.startsWith("psql ")) {
  cleanDbUrl = cleanDbUrl.replace(/^psql\s+/, "");
}
cleanDbUrl = cleanDbUrl.replace(/^['"]|['"]$/g, "");

const pool = new Pool({
  connectionString: cleanDbUrl,
  max: cleanDbUrl.includes("neon.tech") ? 5 : 20, // Neon 使用较小的连接池
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: cleanDbUrl.includes("neon.tech") ? 10000 : 2000, // Neon 使用更长的超时
  query_timeout: 10000, // 查询超时 10秒
  ssl: cleanDbUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
