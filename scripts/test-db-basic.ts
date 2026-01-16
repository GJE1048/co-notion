#!/usr/bin/env tsx

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

/**
 * 基础数据库连接测试
 * 检查环境变量和数据库连接
 */

async function testBasicConnection() {
  console.log("🧪 基础数据库连接测试\n");

  try {
    // 检查环境变量
    console.log("1️⃣ 检查环境变量...");
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      console.log("❌ DATABASE_URL 环境变量未设置");
      console.log("\n📝 请配置环境变量:");
      console.log("   创建 .env.local 文件并添加:");
      console.log('   DATABASE_URL="postgresql://username:password@localhost:5432/database"');
      console.log("\n🔗 数据库选项:");
      console.log("   • 本地 PostgreSQL: postgresql://postgres@localhost:5432/dbname");
      console.log("   • Neon: 从 neon.tech 获取连接字符串");
      console.log("   • Supabase: 从 supabase.com 获取连接字符串");
      return;
    }

    console.log("✅ DATABASE_URL 已配置");
    console.log(`   连接字符串: ${dbUrl.replace(/:[^:]*@/, ':***@')}\n`);

    // 尝试导入数据库模块
    console.log("2️⃣ 测试数据库模块导入...");
    const { db } = await import("../db/index.js");
    console.log("✅ 数据库模块导入成功\n");

    // 测试基本连接
    console.log("3️⃣ 测试数据库连接...");
    await db.execute("SELECT 1 as test" as any);
    console.log("✅ 数据库连接成功\n");

    // 测试表结构
    console.log("4️⃣ 检查表结构...");
    const tables = await db.execute(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'documents')
      ORDER BY table_name
    ` as any);

    const tableNames = tables.rows.map((row: any) => row.table_name);
    console.log("✅ 数据库表检查完成");
    console.log(`   找到的表: ${tableNames.join(', ') || '无'}\n`);

    // 检查用户表结构
    if (tableNames.includes('users')) {
      console.log("5️⃣ 检查用户表结构...");
      const columns = await db.execute(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      ` as any);

      console.log("✅ 用户表结构:");
      columns.rows.forEach((col: any) => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
        console.log(`   ${col.column_name} (${col.data_type}) ${nullable} ${defaultVal}`.trim());
      });
      console.log();
    }

    // 统计数据
    console.log("6️⃣ 统计数据...");
    try {
      const { users } = await import("../db/schema.js");
      const userCount = await db.$count(users);
      console.log(`✅ 数据统计完成`);
      console.log(`   用户数量: ${userCount}`);
    } catch (error) {
      console.log("⚠️ 无法获取用户统计，可能缺少权限或表不存在");
    }

    console.log("\n🎉 基础数据库测试完成！");
    console.log("\n💡 接下来可以运行:");
    console.log("   npm run test:db-write    # 完整写入测试");
    console.log("   npm run db:check         # 数据库结构检查");

  } catch (error: any) {
    console.error("❌ 数据库测试失败:", error.message);

    // 提供具体的错误解决方案
    if (error.message.includes('connect ECONNREFUSED')) {
      console.log("\n🔧 解决方案:");
      console.log("   • 检查 PostgreSQL 服务是否运行");
      console.log("   • 验证端口号是否正确 (默认 5432)");
      console.log("   • 检查防火墙设置");
    } else if (error.message.includes('password authentication failed')) {
      console.log("\n🔧 解决方案:");
      console.log("   • 检查数据库用户名和密码");
      console.log("   • 确保用户有连接权限");
    } else if (error.message.includes('does not exist')) {
      console.log("\n🔧 解决方案:");
      console.log("   • 创建数据库: createdb database_name");
      console.log("   • 或修改连接字符串指向现有数据库");
    }

    process.exit(1);
  }
}

// 运行测试
testBasicConnection().catch((error) => {
  console.error("💥 测试脚本执行失败:", error);
  process.exit(1);
});
