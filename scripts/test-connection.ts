#!/usr/bin/env tsx

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

/**
 * 使用 Node.js 直接测试数据库连接
 */

async function testDirectConnection() {
  console.log("🔌 使用 Node.js 直接测试数据库连接\n");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("❌ DATABASE_URL 未设置");
    return;
  }

  console.log("1️⃣ 解析连接信息...");
  const url = new URL(dbUrl);
  console.log(`🏠 主机: ${url.hostname}`);
  console.log(`🔌 端口: ${url.port || '5432'}`);
  console.log(`👤 用户: ${url.username}`);
  console.log(`💾 数据库: ${url.pathname.slice(1)}`);
  console.log(`🔒 SSL: ${url.searchParams.get('sslmode') || '未指定'}`);

  console.log("\n2️⃣ 尝试直接连接...");

  try {
    const { Client } = require('pg');

    // 创建客户端，使用和应用相同的配置
    const client = new Client({
      connectionString: dbUrl,
      connectionTimeoutMillis: 10000, // 10秒超时
      query_timeout: 5000, // 5秒查询超时
    });

    console.log("🔌 正在连接到数据库...");
    await client.connect();
    console.log("✅ 数据库连接成功!");

    // 测试基本查询
    console.log("\n3️⃣ 测试基本查询...");
    const result = await client.query('SELECT 1 as test, version() as version, current_timestamp as now');
    console.log("✅ 查询执行成功!");
    console.log("📄 查询结果:");
    console.log(`   测试值: ${result.rows[0].test}`);
    console.log(`   数据库版本: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    console.log(`   当前时间: ${result.rows[0].now}`);

    // 测试表查询
    console.log("\n4️⃣ 检查数据库表...");
    const tablesResult = await client.query(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log("✅ 表查询成功!");
    console.log(`📊 找到 ${tablesResult.rows.length} 个表:`);
    tablesResult.rows.forEach((row: any, index: number) => {
      console.log(`   ${index + 1}. ${row.tablename}`);
    });

    // 检查我们的表
    const ourTables = ['users', 'documents'];
    const existingTables = tablesResult.rows
      .filter((row: any) => ourTables.includes(row.tablename))
      .map((row: any) => row.tablename);

    console.log(`\n🏗️ 应用相关表状态:`);
    ourTables.forEach(table => {
      const exists = existingTables.includes(table);
      console.log(`   ${table}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
    });

    if (!existingTables.includes('users')) {
      console.log("\n⚠️  'users' 表不存在，需要创建表结构");
      console.log("💡 运行: npm run db:push");
    }

    // 关闭连接
    await client.end();
    console.log("\n🔌 连接已关闭");

    console.log("\n🎉 所有连接测试通过!");

  } catch (error: any) {
    console.log("❌ 数据库连接失败");
    console.log(`错误类型: ${error.constructor.name}`);
    console.log(`错误信息: ${error.message}`);

    // 详细的错误分析
    if (error.message.includes('timeout')) {
      console.log("\n⏱️  连接超时问题:");
      console.log("   • 检查网络连接稳定性");
      console.log("   • 验证 Neon 服务状态");
      console.log("   • 检查防火墙设置");
      console.log("   • 尝试更换网络环境");
    } else if (error.message.includes('authentication failed')) {
      console.log("\n🔐 认证失败:");
      console.log("   • 检查用户名和密码");
      console.log("   • 重置 Neon 数据库密码");
      console.log("   • 验证连接字符串格式");
    } else if (error.message.includes('does not exist')) {
      console.log("\n💾 数据库不存在:");
      console.log("   • 检查数据库名称");
      console.log("   • 确认 Neon 项目设置");
    } else if (error.message.includes('SSL')) {
      console.log("\n🔒 SSL 连接问题:");
      console.log("   • 检查 SSL 配置");
      console.log("   • 验证 SSL 证书");
    } else {
      console.log("\n❓ 其他错误:");
      console.log(`   错误代码: ${error.code || '未知'}`);
      console.log(`   错误详情: ${error.detail || '无'}`);
    }

    console.log("\n💡 通用解决方案:");
    console.log("   1. 检查 Neon 控制台的连接设置");
    console.log("   2. 验证网络连接和防火墙");
    console.log("   3. 尝试重启 Neon 数据库");
    console.log("   4. 检查 Neon 服务状态页面");

    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testDirectConnection().catch((error) => {
    console.error("💥 测试脚本执行失败:", error);
    process.exit(1);
  });
}
