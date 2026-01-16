#!/usr/bin/env tsx

/**
 * 检查环境变量配置
 */

function checkEnvironment() {
  console.log("🔍 检查环境变量配置\n");

  // 检查 .env.local 文件是否存在
  console.log("1️⃣ 检查 .env.local 文件...");
  const fs = require('fs');
  const path = require('path');

  const envPath = path.join(process.cwd(), '.env.local');
  const envExists = fs.existsSync(envPath);

  if (envExists) {
    console.log("✅ .env.local 文件存在");
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      console.log("📄 文件内容预览:");
      const lines = content.split('\n').filter((line: string) => line.trim());
      lines.forEach((line: string, index: number) => {
        if (line.includes('DATABASE_URL')) {
          const masked = line.replace(/DATABASE_URL=.*/, 'DATABASE_URL=[已配置]');
          console.log(`   ${index + 1}. ${masked}`);
        } else if (line.includes('=')) {
          const [key] = line.split('=');
          console.log(`   ${index + 1}. ${key}=[已配置]`);
        } else if (line.trim()) {
          console.log(`   ${index + 1}. ${line.trim()}`);
        }
      });
      console.log();
    } catch (error) {
      console.log("⚠️ 无法读取文件内容:", error.message);
    }
  } else {
    console.log("❌ .env.local 文件不存在");
    console.log(`   期望路径: ${envPath}`);
    console.log();
  }

  // 检查环境变量
  console.log("2️⃣ 检查运行时环境变量...");
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    console.log("✅ DATABASE_URL 环境变量已设置");
    console.log(`   长度: ${dbUrl.length} 字符`);

    // 检查格式
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      console.log("✅ 格式正确 (PostgreSQL 连接字符串)");
    } else {
      console.log("⚠️ 格式可能有问题，期望以 'postgresql://' 或 'postgres://' 开头");
      console.log(`   当前前缀: ${dbUrl.substring(0, 20)}...`);
    }

    // 检查是否包含敏感信息（不应该在日志中显示）
    if (dbUrl.includes('password') || dbUrl.includes(':')) {
      console.log("✅ 包含认证信息");
    }

    // 显示连接信息（脱敏）
    const masked = dbUrl.replace(/:([^:@]{4})[^:@]*@/, ':$1****@');
    console.log(`   连接字符串: ${masked}`);
    console.log();
  } else {
    console.log("❌ DATABASE_URL 环境变量未设置");
    console.log();
  }

  // 检查其他相关环境变量
  console.log("3️⃣ 检查其他环境变量...");
  const envVars = [
    'NODE_ENV',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'REDIS_URL'
  ];

  envVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      const display = varName.includes('SECRET') || varName.includes('KEY')
        ? '[已设置 - 已隐藏]'
        : value.length > 50 ? `${value.substring(0, 50)}...` : value;
      console.log(`✅ ${varName}: ${display}`);
    } else {
      console.log(`❌ ${varName}: 未设置`);
    }
  });
  console.log();

  // 提供解决方案
  console.log("4️⃣ 诊断结果和解决方案:");

  if (!envExists) {
    console.log("❌ 问题: .env.local 文件不存在");
    console.log("💡 解决方案:");
    console.log("   1. 在项目根目录创建 .env.local 文件");
    console.log("   2. 添加数据库配置:");
    console.log('      DATABASE_URL="postgresql://username:password@localhost:5432/database"');
    console.log();
  } else if (!dbUrl) {
    console.log("❌ 问题: DATABASE_URL 环境变量未加载");
    console.log("💡 解决方案:");
    console.log("   1. 检查 .env.local 文件格式是否正确");
    console.log("   2. 确保没有多余的空格或特殊字符");
    console.log("   3. 重启开发服务器: npm run dev");
    console.log("   4. 如果使用 IDE，尝试重启 IDE");
    console.log();
  } else {
    console.log("✅ 配置看起来正确");
    console.log("💡 如果仍有问题，尝试:");
    console.log("   1. 重启开发服务器: npm run dev");
    console.log("   2. 清除 Next.js 缓存: rm -rf .next");
    console.log("   3. 检查数据库服务是否运行");
    console.log();
  }

  // 显示当前工作目录
  console.log("5️⃣ 环境信息:");
  console.log(`📁 当前目录: ${process.cwd()}`);
  console.log(`🔧 Node.js 版本: ${process.version}`);
  console.log(`📦 包管理器: ${process.env.npm_config_user_agent || '未知'}`);
}

// 运行检查
if (require.main === module) {
  checkEnvironment();
}