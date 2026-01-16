#!/usr/bin/env tsx

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

/**
 * 比较直接连接和 Drizzle ORM 连接的区别
 */

async function compareConnections() {
  console.log("🔍 比较连接方式\n");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("❌ DATABASE_URL 未设置");
    return;
  }

  console.log("1️⃣ 测试直接 Node.js 连接...");
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: dbUrl,
      connectionTimeoutMillis: 10000,
      query_timeout: 5000,
    });

    await client.connect();
    console.log("✅ 直接连接成功");

    const result = await client.query('SELECT 1 as test');
    console.log(`📄 直接查询结果: ${result.rows[0].test}`);

    await client.end();
    console.log("🔌 直接连接已关闭");
  } catch (error: any) {
    console.log("❌ 直接连接失败:", error.message);
  }

  console.log("\n2️⃣ 测试 Drizzle ORM 连接...");
  try {
    const { db } = require('../db/index.js');
    const result = await db.execute("SELECT 1 as test" as any);
    console.log("✅ Drizzle 连接成功");
    console.log("📄 Drizzle 查询结果:", result.rows[0]);
  } catch (error: any) {
    console.log("❌ Drizzle 连接失败:", error.message);
    console.log("🔍 错误详情:");
    console.log(`   类型: ${error.constructor.name}`);
    console.log(`   代码: ${error.code || '无'}`);

    if (error.cause) {
      console.log("   原因:", error.cause.message);
    }
  }

  console.log("\n3️⃣ 检查连接池配置...");
  try {
    const { Pool } = require('pg');

    // 使用和 Drizzle 相同的配置
    const pool = new Pool({
      connectionString: dbUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: dbUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
    });

    console.log("🔧 连接池配置:");
    console.log(`   最大连接数: ${pool.options.max}`);
    console.log(`   空闲超时: ${pool.options.idleTimeoutMillis}ms`);
    console.log(`   连接超时: ${pool.options.connectionTimeoutMillis}ms`);
    console.log(`   SSL 配置: ${pool.options.ssl ? '启用' : '禁用'}`);

    const client = await pool.connect();
    console.log("✅ 连接池连接成功");

    const result = await client.query('SELECT 1 as test');
    console.log(`📄 连接池查询结果: ${result.rows[0].test}`);

    client.release();
    await pool.end();
    console.log("🔌 连接池已关闭");
  } catch (error: any) {
    console.log("❌ 连接池连接失败:", error.message);
  }

  console.log("\n4️⃣ 建议的解决方案:");

  if (dbUrl.includes('neon.tech')) {
    console.log("🌐 Neon 数据库特殊配置:");
    console.log("   • SSL 配置可能需要调整");
    console.log("   • 连接池参数可能需要优化");
    console.log("   • 尝试禁用连接池: max: 1");
    console.log("   • 增加连接超时时间");
  } else {
    console.log("🏠 本地数据库配置:");
    console.log("   • 检查 PostgreSQL 服务状态");
    console.log("   • 验证连接字符串");
    console.log("   • 检查防火墙设置");
  }

  console.log("\n🔧 通用解决方案:");
  console.log("   • 尝试重启 Neon 数据库");
  console.log("   • 检查 Neon 控制台的连接限制");
  console.log("   • 验证网络连接稳定性");
}

// 运行比较测试
if (require.main === module) {
  compareConnections().catch((error) => {
    console.error("💥 比较测试失败:", error);
    process.exit(1);
  });
}
