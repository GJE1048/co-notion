#!/usr/bin/env tsx

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

/**
 * 数据库连接诊断脚本
 */

async function diagnoseDatabase() {
  console.log("🔍 数据库连接诊断\n");

  // 1. 检查环境变量
  console.log("1️⃣ 检查环境变量配置...");
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.log("❌ DATABASE_URL 未设置");
    return;
  }

  console.log("✅ DATABASE_URL 已设置");

  // 解析连接字符串
  console.log("\n2️⃣ 解析连接字符串...");
  try {
    const url = new URL(dbUrl);
    console.log(`📍 协议: ${url.protocol}`);
    console.log(`🏠 主机: ${url.hostname}`);
    console.log(`🔌 端口: ${url.port || '5432 (默认)'}`);
    console.log(`👤 用户: ${url.username || '未指定'}`);
    console.log(`💾 数据库: ${url.pathname.slice(1) || '未指定'}`);
    console.log(`🔒 有密码: ${url.password ? '是' : '否'}`);

    // 检查常见问题
    const issues = [];

    if (!url.hostname || url.hostname === 'localhost') {
      console.log("\n3️⃣ 检查本地 PostgreSQL 服务...");

      // 检查进程
      const { execSync } = require('child_process');
      try {
        const result = execSync('pgrep -f postgres', { encoding: 'utf8' });
        if (result.trim()) {
          console.log("✅ PostgreSQL 进程正在运行");
        } else {
          console.log("❌ PostgreSQL 进程未运行");
          issues.push("PostgreSQL 服务未启动");
        }
      } catch (error) {
        console.log("❌ 无法检查 PostgreSQL 进程");
        issues.push("无法检测 PostgreSQL 服务状态");
      }

      // 检查端口
      try {
        execSync('nc -z localhost 5432', { stdio: 'ignore' });
        console.log("✅ 端口 5432 可访问");
      } catch (error) {
        console.log("❌ 端口 5432 不可访问");
        issues.push("PostgreSQL 端口 5432 未监听");
      }

      // 检查数据库是否存在
      if (url.pathname.slice(1)) {
        console.log(`\n4️⃣ 检查数据库 "${url.pathname.slice(1)}" 存在性...`);
        try {
          // 尝试连接到 postgres 数据库来检查
          const { Client } = require('pg');
          const client = new Client({
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            user: url.username,
            password: url.password,
            database: 'postgres', // 连接到默认数据库
            connectionTimeoutMillis: 5000,
          });

          await client.connect();
          console.log("✅ 可以连接到 PostgreSQL 服务器");

          // 检查目标数据库是否存在
          const result = await client.query(
            "SELECT datname FROM pg_database WHERE datname = $1",
            [url.pathname.slice(1)]
          );

          if (result.rows.length > 0) {
            console.log(`✅ 数据库 "${url.pathname.slice(1)}" 存在`);
          } else {
            console.log(`❌ 数据库 "${url.pathname.slice(1)}" 不存在`);
            issues.push(`数据库 "${url.pathname.slice(1)}" 不存在`);
          }

          await client.end();
        } catch (error: any) {
          console.log("❌ 无法连接到 PostgreSQL 服务器");
          console.log(`   错误: ${error.message}`);
          issues.push("无法连接到 PostgreSQL 服务器");
        }
      }
    } else {
      console.log("\n3️⃣ 远程数据库连接检查...");
      console.log("📡 检测到远程数据库连接");
      console.log("💡 可能的原因:");
      console.log("   • 网络连接问题");
      console.log("   • 防火墙阻止连接");
      console.log("   • 数据库服务未运行");
      console.log("   • 连接字符串错误");
      console.log("   • 云服务防火墙设置");
    }

    // 提供解决方案
    console.log("\n5️⃣ 诊断结果和解决方案:");

    if (issues.length === 0) {
      console.log("✅ 未发现明显问题，尝试直接连接测试...");
    } else {
      console.log("❌ 发现以下问题:");
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      console.log();
    }

    // 提供通用解决方案
    console.log("💡 通用解决方案:");

    if (dbUrl.includes('localhost')) {
      console.log("🔧 本地 PostgreSQL 解决方案:");
      console.log("   1. 启动 PostgreSQL 服务:");
      console.log("      macOS: brew services start postgresql");
      console.log("      Linux: sudo systemctl start postgresql");
      console.log("   2. 创建数据库:");
      console.log(`      createdb ${url.pathname.slice(1) || 'your_database'}`);
      console.log("   3. 验证连接:");
      console.log(`      psql "${dbUrl}" -c "SELECT 1"`);
    } else {
      console.log("🔧 远程数据库解决方案:");
      console.log("   1. 检查网络连接");
      console.log("   2. 验证连接字符串");
      console.log("   3. 检查云服务防火墙设置");
      console.log("   4. 确认数据库服务正在运行");
    }

    console.log("\n🔧 其他故障排除:");
    console.log("   • 检查用户名和密码是否正确");
    console.log("   • 确认用户有连接权限");
    console.log("   • 尝试使用 psql 直接连接测试");
    console.log("   • 检查系统防火墙设置");

  } catch (error: any) {
    console.log("❌ 无法解析连接字符串");
    console.log(`   错误: ${error.message}`);
    console.log("💡 确保连接字符串格式正确:");
    console.log('   postgresql://username:password@host:port/database');
    console.log('   示例: postgresql://user:pass@localhost:5432/myapp');
  }
}

// 运行诊断
if (require.main === module) {
  diagnoseDatabase().catch((error) => {
    console.error("💥 诊断脚本执行失败:", error);
    process.exit(1);
  });
}
