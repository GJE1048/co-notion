import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { users, documents } from "../db/schema";

// 加载 .env.local 文件
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✅ 找到 .env.local 文件");
} else {
  console.log("⚠️  .env.local 文件不存在，尝试使用环境变量");
  dotenv.config();
}

if (!process.env.DATABASE_URL) {
  console.error("❌ 错误: DATABASE_URL 环境变量未设置");
  console.log("\n请创建 .env.local 文件并添加：");
  console.log("DATABASE_URL=postgresql://user:password@host:port/database");
  console.log("\n对于 Neon 数据库，格式通常是：");
  console.log("DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require");
  process.exit(1);
}

console.log("✅ DATABASE_URL 已设置");

// 清理 DATABASE_URL（移除可能的 psql 前缀和引号）
let cleanDbUrl = process.env.DATABASE_URL.trim();
if (cleanDbUrl.startsWith("psql ")) {
  console.log("⚠️  警告: 检测到 'psql' 前缀，将自动移除");
  cleanDbUrl = cleanDbUrl.replace(/^psql\s+/, "");
}
cleanDbUrl = cleanDbUrl.replace(/^['"]|['"]$/g, "");

console.log(`   连接字符串: ${cleanDbUrl.replace(/:[^:@]+@/, ':****@')}`);

const pool = new Pool({
  connectionString: cleanDbUrl,
  ssl: cleanDbUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

const db = drizzle(pool);

async function setupDatabase() {
  try {
    console.log("\n正在连接数据库...");

    // 测试连接
    await pool.query("SELECT 1");
    console.log("✅ 数据库连接成功\n");

    // 检查表是否存在
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`当前数据库中的表 (${tables.rows.length} 个):`);
    if (tables.rows.length === 0) {
      console.log("  (无表)");
    } else {
      tables.rows.forEach((row: any) => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // 创建表
    console.log("\n开始创建表...");

    // 创建 users 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        clerk_id TEXT NOT NULL UNIQUE,
        image_url TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=John+Doe',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ users 表已创建/已存在");

    // 创建索引
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS clerk_id_idx ON users(clerk_id);
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS username_idx ON users(username);
    `);
    console.log("✅ users 表索引已创建");

    // 创建 documents 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ documents 表已创建/已存在");

    // 创建外键约束
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'fk_documents_user_id'
        ) THEN
          ALTER TABLE documents
          ADD CONSTRAINT fk_documents_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    console.log("✅ documents 表外键已创建");

    // 再次检查表
    const finalTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`\n✅ 数据库设置完成！`);
    console.log(`\n当前数据库中的表 (${finalTables.rows.length} 个):`);
    finalTables.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });

    // 检查数据
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    const docCount = await pool.query("SELECT COUNT(*) FROM documents");
    console.log(`\n数据统计:`);
    console.log(`  - 用户数: ${userCount.rows[0].count}`);
    console.log(`  - 文档数: ${docCount.rows[0].count}`);

  } catch (error) {
    console.error("\n❌ 错误:", error);
    if (error instanceof Error) {
      console.error("错误信息:", error.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();

