import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");

console.log("检查 .env.local 文件...\n");

if (!fs.existsSync(envPath)) {
  console.log("❌ .env.local 文件不存在");
  console.log("\n请创建 .env.local 文件并添加：");
  console.log("DATABASE_URL=postgresql://user:password@host:port/database");
  process.exit(1);
}

console.log("✅ .env.local 文件存在\n");

// 读取文件内容
const envContent = fs.readFileSync(envPath, "utf-8");
console.log("文件内容：");
console.log("---");
console.log(envContent);
console.log("---\n");

dotenv.config({ path: envPath });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log("❌ DATABASE_URL 未设置");
  process.exit(1);
}

console.log("DATABASE_URL 值：");
console.log(dbUrl);
console.log("\n");

// 检查格式
if (dbUrl.startsWith("psql ")) {
  console.log("⚠️  警告: DATABASE_URL 包含 'psql ' 前缀，这可能导致连接失败");
  console.log("正确的格式应该是：");
  console.log("DATABASE_URL=postgresql://user:password@host:port/database");
  console.log("\n请从 .env.local 文件中移除 'psql ' 前缀");
}

// 解析连接字符串
try {
  const url = new URL(dbUrl.replace(/^psql\s+/, "").replace(/^'|'$/g, ""));
  console.log("✅ 连接字符串格式正确");
  console.log(`   协议: ${url.protocol}`);
  console.log(`   主机: ${url.hostname}`);
  console.log(`   端口: ${url.port || "默认"}`);
  console.log(`   数据库: ${url.pathname.slice(1)}`);
  console.log(`   用户: ${url.username}`);
} catch (error) {
  console.log("❌ 连接字符串格式错误:", error);
}

