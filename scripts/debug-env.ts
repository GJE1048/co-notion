#!/usr/bin/env tsx

/**
 * 调试环境变量加载
 */

function debugEnvironment() {
  console.log("🐛 环境变量调试\n");

  console.log("1️⃣ 直接检查环境变量:");
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '已设置' : '未设置'}`);
  console.log(`长度: ${process.env.DATABASE_URL?.length || 0}`);

  if (process.env.DATABASE_URL) {
    // 显示部分信息（脱敏）
    const url = process.env.DATABASE_URL;
    const masked = url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
    console.log(`内容: ${masked}`);
  }

  console.log("\n2️⃣ 检查 .env.local 文件:");
  const fs = require('fs');
  const path = require('path');

  const envPath = path.join(process.cwd(), '.env.local');
  console.log(`文件路径: ${envPath}`);
  console.log(`文件存在: ${fs.existsSync(envPath)}`);

  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      console.log("文件内容:");
      content.split('\n').forEach((line, index) => {
        if (line.trim() && !line.startsWith('#')) {
          console.log(`  ${index + 1}: ${line}`);
        }
      });
    } catch (error) {
      console.log(`读取文件失败: ${error.message}`);
    }
  }

  console.log("\n3️⃣ 检查进程环境:");
  console.log(`当前工作目录: ${process.cwd()}`);
  console.log(`Node.js 版本: ${process.version}`);
  console.log(`脚本执行方式: ${process.argv.join(' ')}`);

  console.log("\n4️⃣ 建议:");
  console.log("• 如果是开发服务器: 重启 'npm run dev'");
  console.log("• 如果是脚本运行: 确保 .env.local 在正确位置");
  console.log("• 检查文件权限和编码");
}

// 运行调试
debugEnvironment();
