import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as Y from "yjs";

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

async function syncBlocksFromYjsState() {
  console.log("\n🔄 开始根据 Yjs 状态重建 blocks 表...");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const docsWithState = await client.query<{
      id: string;
      yjs_state: string | null;
    }>(
      `SELECT id, yjs_state FROM documents WHERE yjs_state IS NOT NULL`
    );

    console.log(`发现 ${docsWithState.rows.length} 个包含 yjs_state 的文档`);

    for (const row of docsWithState.rows) {
      const documentId = row.id;
      const state = row.yjs_state;
      if (!state) {
        continue;
      }

      console.log(`\n处理文档 ${documentId} ...`);

      const doc = new Y.Doc();
      try {
        const buffer = Buffer.from(state, "base64");
        const update = new Uint8Array(buffer);
        Y.applyUpdate(doc, update);
      } catch (error) {
        console.error(
          `无法解析文档 ${documentId} 的 yjs_state，已跳过:`,
          error
        );
        continue;
      }

      const yBlocks = doc.getArray<Y.Map<unknown>>("blocks");
      const items = yBlocks.toArray();

      console.log(`Y.Doc 中包含 ${items.length} 个 Block`);

      const existingBlocks = await client.query<{
        id: string;
      }>(
        `SELECT id FROM blocks WHERE document_id = $1`,
        [documentId]
      );

      const existingIds = new Set(existingBlocks.rows.map((b) => b.id));
      const yIds = new Set<string>();

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const id = item.get("id") as string | undefined;
        if (!id) {
          continue;
        }

        yIds.add(id);
        const type = (item.get("type") as string) || "paragraph";
        const position =
          (item.get("position") as number | undefined) ?? index;
        const content = item.get("content");

        let text = "";
        if (content instanceof Y.Text) {
          text = content.toString();
        } else if (typeof content === "string") {
          text = content;
        }

        let blockContent: unknown;
        if (type === "code") {
          blockContent = {
            code: {
              content: text,
              language: "javascript",
            },
          };
        } else {
          blockContent = {
            text: {
              content: text,
            },
          };
        }

        if (existingIds.has(id)) {
          await client.query(
            `
            UPDATE blocks
            SET type = $1,
                content = $2::jsonb,
                position = $3,
                updated_at = NOW()
            WHERE id = $4
          `,
            [type, JSON.stringify(blockContent), position, id]
          );
        } else {
          await client.query(
            `
            INSERT INTO blocks (id, document_id, parent_id, type, content, properties, position, version, created_by)
            VALUES ($1, $2, NULL, $3, $4::jsonb, '{}'::jsonb, $5, 1, NULL)
          `,
            [id, documentId, type, JSON.stringify(blockContent), position]
          );
        }
      }

      const idsToDelete = Array.from(existingIds).filter(
        (id) => !yIds.has(id)
      );

      if (idsToDelete.length > 0) {
        await client.query(
          `DELETE FROM blocks WHERE document_id = $1 AND id = ANY($2::uuid[])`,
          [documentId, idsToDelete]
        );
        console.log(
          `已删除在 Y.Doc 中不存在的 ${idsToDelete.length} 个 Block`
        );
      }

      console.log(`文档 ${documentId} 同步完成`);
    }

    await client.query("COMMIT");
    console.log("\n✅ blocks 表已根据 Yjs 状态完成重建");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ 重建 blocks 表时出错:", error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function setupDatabase() {
  try {
    console.log("\n正在连接数据库...");

    // 测试连接
    await pool.query("SELECT 1");
    console.log("✅ 数据库连接成功\n");

    // 检查命令行参数
    const arg = process.argv[2];

    if (arg === "sync-yjs-blocks") {
      await syncBlocksFromYjsState();
    } else if (arg) {
      // 运行指定的 SQL 文件
      const sqlPath = path.join(process.cwd(), "scripts", arg);
      if (!fs.existsSync(sqlPath)) {
        console.error(`❌ SQL 文件不存在: ${sqlPath}`);
        process.exit(1);
      }

      console.log(`📄 运行 SQL 文件: ${arg}`);
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

      // 分割 SQL 语句并执行
      const statements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pool.query(statement);
          } catch (error) {
            console.log(`⚠️  SQL 语句执行警告: ${error}`);
            // 继续执行，不中断
          }
        }
      }

      console.log("✅ SQL 文件执行完成\n");
    } else {
      // 原有的数据库设置逻辑
      console.log("🔧 执行标准数据库设置...");

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
        tables.rows.forEach((row: { table_name: string }) => {
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
    }

    // 最终检查表
    const finalTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`\n✅ 数据库设置完成！`);
    console.log(`\n当前数据库中的表 (${finalTables.rows.length} 个):`);
    finalTables.rows.forEach((row: { table_name: string }) => {
      console.log(`  - ${row.table_name}`);
    });

    // 检查数据（如果表存在）
    try {
      const userCount = await pool.query("SELECT COUNT(*) FROM users");
      const docCount = await pool.query("SELECT COUNT(*) FROM documents");
      console.log(`\n数据统计:`);
      console.log(`  - 用户数: ${userCount.rows[0].count}`);
      console.log(`  - 文档数: ${docCount.rows[0].count}`);
    } catch {
      console.log(`\n数据统计: 部分表可能不存在`);
    }

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
