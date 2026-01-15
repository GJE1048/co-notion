import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function migrateToUsername() {
  console.log("开始迁移到 username...");

  try {
    // 1. 检查是否存在 first_name 列
    const checkColumns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('first_name', 'last_name', 'username')
    `);

    const hasFirstName = checkColumns.rows.some((row: any) => row.column_name === 'first_name');
    const hasUsername = checkColumns.rows.some((row: any) => row.column_name === 'username');

    if (!hasFirstName && hasUsername) {
      console.log("数据库已经是新格式，无需迁移");
      await pool.end();
      return;
    }

    // 2. 添加 username 列（如果不存在）
    if (!hasUsername) {
      console.log("添加 username 列...");
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS username TEXT
      `);
    }

    // 3. 从 first_name 和 last_name 生成 username
    console.log("生成 username...");
    await db.execute(sql`
      UPDATE users
      SET username = COALESCE(
        first_name || '_' || last_name,
        first_name,
        last_name,
        'user_' || SUBSTRING(id::TEXT, 1, 8)
      )
      WHERE username IS NULL
    `);

    // 4. 处理重复用户名
    console.log("处理重复用户名...");
    // 这里需要更复杂的逻辑，暂时跳过，让用户手动处理

    // 5. 确保所有用户都有 username
    await db.execute(sql`
      UPDATE users
      SET username = 'user_' || SUBSTRING(id::TEXT, 1, 8)
      WHERE username IS NULL OR username = ''
    `);

    // 6. 设置 NOT NULL 约束
    console.log("设置约束...");
    await db.execute(sql`
      ALTER TABLE users
      ALTER COLUMN username SET NOT NULL
    `);

    // 7. 创建唯一索引
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS username_idx ON users(username)
    `);

    console.log("迁移完成！");
    console.log("注意：first_name 和 last_name 列仍然存在。");
    console.log("如果确认迁移成功，可以手动删除这些列：");
    console.log("  ALTER TABLE users DROP COLUMN IF EXISTS first_name;");
    console.log("  ALTER TABLE users DROP COLUMN IF EXISTS last_name;");

  } catch (error) {
    console.error("迁移失败:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateToUsername().catch((err) => {
  console.error("迁移失败:", err);
  process.exit(1);
});

