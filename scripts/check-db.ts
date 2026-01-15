import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabase() {
  try {
    console.log("检查数据库表结构...\n");

    // 检查 users 表是否存在
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log("❌ users 表不存在！");
      console.log("请先运行初始化脚本：");
      console.log("  psql $DATABASE_URL -f scripts/init-db.sql");
      await pool.end();
      return;
    }

    console.log("✅ users 表存在\n");

    // 检查列
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    console.log("当前表结构：");
    columns.rows.forEach((col: any) => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    const columnNames = columns.rows.map((col: any) => col.column_name);

    console.log("\n");

    // 检查是否有 username 列
    if (!columnNames.includes('username')) {
      console.log("❌ username 列不存在！");
      console.log("请运行更新脚本：");
      console.log("  psql $DATABASE_URL -f scripts/update-users-table.sql");
      console.log("  或");
      console.log("  npm run db:update-users");
    } else {
      console.log("✅ username 列存在");
    }

    // 检查是否有旧列
    if (columnNames.includes('first_name') || columnNames.includes('last_name')) {
      console.log("⚠️  检测到旧的 first_name 或 last_name 列");
      console.log("建议运行迁移脚本更新表结构");
    }

    // 检查索引
    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'users';
    `);

    console.log("\n索引：");
    indexes.rows.forEach((idx: any) => {
      console.log(`  - ${idx.indexname}`);
    });

    if (!indexes.rows.some((idx: any) => idx.indexname === 'username_idx')) {
      console.log("\n⚠️  username_idx 索引不存在");
    } else {
      console.log("\n✅ username_idx 索引存在");
    }

    // 检查数据
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`\n用户数量: ${userCount.rows[0].count}`);

    const usersWithoutUsername = await pool.query(`
      SELECT COUNT(*) FROM users WHERE username IS NULL OR username = ''
    `);
    if (parseInt(usersWithoutUsername.rows[0].count) > 0) {
      console.log(`⚠️  有 ${usersWithoutUsername.rows[0].count} 个用户没有 username`);
    }

  } catch (error) {
    console.error("检查失败:", error);
  } finally {
    await pool.end();
  }
}

checkDatabase();

