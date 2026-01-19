import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as Y from "yjs";
import { randomUUID } from "crypto";
import { syncBlocksFromYjsState } from "./setup-db";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

if (!process.env.DATABASE_URL) {
  console.error("❌ 错误: DATABASE_URL 环境变量未设置，无法运行测试");
  process.exit(1);
}

let cleanDbUrl = process.env.DATABASE_URL.trim();
if (cleanDbUrl.startsWith("psql ")) {
  cleanDbUrl = cleanDbUrl.replace(/^psql\s+/, "");
}
cleanDbUrl = cleanDbUrl.replace(/^['"]|['"]$/g, "");

const pool = new Pool({
  connectionString: cleanDbUrl,
  ssl: cleanDbUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

async function createTestDocument() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query<{ id: string }>(
      "SELECT id FROM users LIMIT 1"
    );
    if (userResult.rows.length === 0) {
      throw new Error("测试失败: 数据库中没有用户记录");
    }
    const ownerId = userResult.rows[0].id;

    const workspaceResult = await client.query<{ id: string }>(
      "SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1",
      [ownerId]
    );

    let workspaceId: string;
    if (workspaceResult.rows.length === 0) {
      const wsInsert = await client.query<{ id: string }>(
        `
        INSERT INTO workspaces (name, owner_id, is_personal)
        VALUES ($1, $2, TRUE)
        RETURNING id
      `,
        ["Yjs Sync Test Workspace", ownerId]
      );
      workspaceId = wsInsert.rows[0].id;
    } else {
      workspaceId = workspaceResult.rows[0].id;
    }

    const docInsert = await client.query<{ id: string }>(
      `
      INSERT INTO documents (title, workspace_id, owner_id, is_template, is_archived, permissions, metadata)
      VALUES ($1, $2, $3, FALSE, FALSE, '{"public": false, "team": true}'::jsonb, '{}'::jsonb)
      RETURNING id
    `,
      ["Yjs Sync Test Document", workspaceId, ownerId]
    );

    const documentId = docInsert.rows[0].id;

    const ydoc = new Y.Doc();
    const yBlocks = ydoc.getArray<Y.Map<unknown>>("blocks");

    const makeBlock = (id: string, type: string, position: number, text: string) => {
      const yBlock = new Y.Map<unknown>();
      yBlock.set("id", id);
      yBlock.set("type", type);
      yBlock.set("position", position);
      const yText = new Y.Text(text);
      yBlock.set("content", yText);
      return yBlock;
    };

    const paragraph = makeBlock(
      randomUUID(),
      "paragraph",
      0,
      "段落内容"
    );
    const code = makeBlock(
      randomUUID(),
      "code",
      1,
      "console.log('hello');"
    );
    const list = makeBlock(
      randomUUID(),
      "list",
      2,
      ["项目一", "项目二"].join("\n")
    );
    const todo = makeBlock(
      randomUUID(),
      "todo",
      3,
      ["[ ] 待办一", "[x] 已完成待办"].join("\n")
    );

    yBlocks.push([paragraph, code, list, todo]);

    const update = Y.encodeStateAsUpdate(ydoc);
    const base64State = Buffer.from(update).toString("base64");

    await client.query(
      "UPDATE documents SET yjs_state = $1 WHERE id = $2",
      [base64State, documentId]
    );

    await client.query("DELETE FROM blocks WHERE document_id = $1", [documentId]);

    await client.query("COMMIT");

    return documentId;
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  try {
    console.log("🔍 开始测试 syncBlocksFromYjsState...");
    const documentId = await createTestDocument();

    await syncBlocksFromYjsState();

    const result = await pool.query<{
      id: string;
      type: string;
      content: unknown;
      position: number;
    }>(
      `
      SELECT id, type, content, position
      FROM blocks
      WHERE document_id = $1
      ORDER BY position
    `,
      [documentId]
    );

    console.log("✅ 同步后的 Blocks:");
    for (const row of result.rows) {
      console.log(
        `- ${row.type} @${row.position}: ${JSON.stringify(row.content)}`
      );
    }

    if (result.rows.length !== 4) {
      throw new Error(`预期 4 个 Block，实际为 ${result.rows.length}`);
    }

    const paragraph = result.rows[0] as {
      id: string;
      type: string;
      content: { text?: { content?: string } } | unknown;
      position: number;
    };
    const code = result.rows[1] as {
      id: string;
      type: string;
      content: { code?: { content?: string } } | unknown;
      position: number;
    };
    const list = result.rows[2] as {
      id: string;
      type: string;
      content: { list?: { items?: string[] } } | unknown;
      position: number;
    };
    const todo = result.rows[3] as {
      id: string;
      type: string;
      content: { todo?: { items?: { text?: string; checked?: boolean }[] } } | unknown;
      position: number;
    };

    if (
      paragraph.type !== "paragraph" ||
      paragraph.content?.text?.content !== "段落内容"
    ) {
      throw new Error("段落 Block 内容不匹配");
    }

    if (
      code.type !== "code" ||
      code.content?.code?.content !== "console.log('hello');"
    ) {
      throw new Error("代码 Block 内容不匹配");
    }

    if (
      list.type !== "list" ||
      !Array.isArray(list.content?.list?.items) ||
      list.content.list.items.length !== 2
    ) {
      throw new Error("列表 Block 内容不匹配");
    }

    if (
      todo.type !== "todo" ||
      !Array.isArray(todo.content?.todo?.items) ||
      todo.content.todo.items.length !== 2
    ) {
      throw new Error("待办 Block 内容不匹配");
    }

    console.log("✅ syncBlocksFromYjsState 测试通过");
  } catch (error) {
    console.error("❌ syncBlocksFromYjsState 测试失败:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
