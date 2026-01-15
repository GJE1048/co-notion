# 开发环境搭建指南

## 系统要求

### 最低系统要求

- **操作系统**: macOS 10.15+ / Windows 10+ / Ubuntu 18.04+
- **Node.js**: v18.0.0 或更高版本
- **npm/yarn/pnpm**: 支持包管理器
- **Git**: v2.20.0 或更高版本
- **内存**: 至少 8GB RAM
- **磁盘空间**: 至少 5GB 可用空间

### 推荐配置

- **操作系统**: macOS 12.0+ / Windows 11 / Ubuntu 20.04+
- **Node.js**: v20 LTS
- **包管理器**: pnpm (推荐) 或 yarn
- **IDE**: VS Code with TypeScript, Prettier, ESLint extensions
- **内存**: 16GB RAM 或更多
- **磁盘空间**: 20GB+ 可用空间

## 环境安装

### 1. Node.js 安装

**使用 nvm (推荐)**:
```bash
# 安装 nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载 shell
source ~/.bashrc

# 安装 Node.js LTS
nvm install --lts
nvm use --lts

# 验证安装
node --version
npm --version
```

**使用官方安装包**:
- 访问 [Node.js 官网](https://nodejs.org/)
- 下载 LTS 版本
- 运行安装程序

### 2. 包管理器安装

**安装 pnpm (推荐)**:
```bash
npm install -g pnpm

# 验证安装
pnpm --version
```

**安装 yarn**:
```bash
npm install -g yarn

# 验证安装
yarn --version
```

### 3. Git 配置

```bash
# 配置用户信息
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 配置 SSH 密钥 (推荐)
ssh-keygen -t ed25519 -C "your.email@example.com"

# 验证配置
git config --list
```

## 项目克隆与初始化

### 1. 克隆项目

```bash
# 使用 HTTPS
git clone https://github.com/your-org/document-platform.git

# 或使用 SSH (如果配置了 SSH 密钥)
git clone git@github.com:your-org/document-platform.git

# 进入项目目录
cd document-platform
```

### 2. 安装依赖

```bash
# 使用 pnpm (推荐)
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

### 3. 环境变量配置

**复制环境变量模板**:
```bash
cp .env.example .env.local
```

**编辑 .env.local 文件**:
```env
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/document_platform"

# Redis 配置
REDIS_URL="redis://localhost:6379"

# JWT 密钥
JWT_SECRET="your-super-secret-jwt-key-here"

# AI API 密钥
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"

# 邮件配置
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# 应用配置
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WS_URL="ws://localhost:3001"
```

### 4. 数据库设置

**安装 PostgreSQL**:

**macOS (使用 Homebrew)**:
```bash
brew install postgresql
brew services start postgresql

# 创建数据库
createdb document_platform
```

**Ubuntu**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建数据库
sudo -u postgres createdb document_platform
```

**Windows**:
- 下载并安装 [PostgreSQL for Windows](https://www.postgresql.org/download/windows/)
- 使用 pgAdmin 创建数据库

**数据库迁移**:
```bash
# 生成 Prisma 客户端
pnpm prisma generate

# 运行数据库迁移
pnpm prisma db push

# (可选) 查看数据库
pnpm prisma studio
```

### 5. Redis 设置

**安装 Redis**:

**macOS**:
```bash
brew install redis
brew services start redis
```

**Ubuntu**:
```bash
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Windows**:
- 下载 [Redis for Windows](https://redis.io/download)
- 运行 redis-server.exe

**验证 Redis**:
```bash
redis-cli ping
# 应该返回 PONG
```

## 开发工具配置

### 1. VS Code 配置

**推荐扩展**:
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "christian-kohler.path-intuitive",
    "ms-vscode-remote.remote-containers"
  ]
}
```

**工作区设置** (.vscode/settings.json):
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
  ]
}
```

### 2. Prettier 配置

**.prettierrc**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

### 3. ESLint 配置

**eslint.config.mjs**:
```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "error",
    },
  },
];

export default eslintConfig;
```

## 运行项目

### 1. 开发服务器

```bash
# 启动 Next.js 开发服务器
pnpm dev

# 或使用 npm
npm run dev

# 或使用 yarn
yarn dev
```

**服务器将在 http://localhost:3000 启动**

### 2. WebSocket 服务器 (如果分离部署)

```bash
# 在另一个终端窗口运行
pnpm run ws-server

# 或
npm run ws-server
```

### 3. 数据库可视化

```bash
# 启动 Prisma Studio
pnpm prisma studio

# 将在浏览器中打开数据库管理界面
```

## 常用开发命令

### 包管理
```bash
# 安装依赖
pnpm add <package-name>

# 安装开发依赖
pnpm add -D <package-name>

# 移除依赖
pnpm remove <package-name>

# 更新依赖
pnpm update
```

### 数据库操作
```bash
# 生成 Prisma 客户端
pnpm prisma generate

# 创建迁移
pnpm prisma migrate dev --name <migration-name>

# 推送数据库更改
pnpm prisma db push

# 重置数据库
pnpm prisma migrate reset

# 查看数据库
pnpm prisma studio
```

### 代码质量
```bash
# 运行 ESLint
pnpm lint

# 修复 ESLint 错误
pnpm lint:fix

# 运行 Prettier
pnpm format

# 类型检查
pnpm type-check

# 构建项目
pnpm build
```

### 测试
```bash
# 运行所有测试
pnpm test

# 运行测试并监听文件变化
pnpm test:watch

# 运行测试覆盖率
pnpm test:coverage

# 运行 E2E 测试
pnpm test:e2e
```

## 故障排除

### 常见问题

**端口被占用**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程 (macOS/Linux)
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

**Node.js 版本问题**:
```bash
# 检查当前版本
node --version

# 切换 Node.js 版本 (使用 nvm)
nvm use 20

# 重新安装依赖
rm -rf node_modules package-lock.json
pnpm install
```

**数据库连接问题**:
```bash
# 检查 PostgreSQL 服务状态
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# 检查数据库是否存在
psql -l

# 测试连接
psql -d document_platform -c "SELECT 1;"
```

**Redis 连接问题**:
```bash
# 检查 Redis 服务
redis-cli ping

# 查看 Redis 日志
brew services logs redis  # macOS
sudo journalctl -u redis  # Linux
```

### 调试技巧

**启用调试模式**:
```bash
# Next.js 调试
DEBUG=* pnpm dev

# 特定模块调试
DEBUG=app:* pnpm dev
```

**查看应用日志**:
```bash
# 开发模式日志会显示在终端
pnpm dev

# 生产模式日志位置
tail -f logs/app.log
```

**浏览器开发者工具**:
- 打开 Chrome DevTools
- 检查 Network 标签页的 API 请求
- 查看 Console 标签页的错误信息
- 使用 React DevTools 检查组件状态

## 贡献指南

### 代码规范

1. **提交前检查**:
   ```bash
   pnpm lint
   pnpm type-check
   pnpm test
   ```

2. **提交信息格式**:
   ```
   type(scope): description

   [optional body]

   [optional footer]
   ```

   类型包括: feat, fix, docs, style, refactor, test, chore

3. **分支命名**:
   - `feature/xxx`: 新功能
   - `fix/xxx`: 修复
   - `docs/xxx`: 文档
   - `refactor/xxx`: 重构

### 代码审查

- 所有代码都需要通过代码审查
- 至少需要一个 approve
- CI/CD 检查必须全部通过
- 涉及安全相关的更改需要额外审查

## 部署到生产环境

### 环境准备

1. **服务器配置**:
   - Ubuntu 20.04+ 或 CentOS 8+
   - 至少 2GB RAM, 20GB 存储
   - 配置防火墙和安全组

2. **生产环境变量**:
   ```env
   NODE_ENV=production
   DATABASE_URL="postgresql://..."
   REDIS_URL="redis://..."
   JWT_SECRET="production-secret"
   ```

### 部署步骤

```bash
# 1. 克隆代码
git clone https://github.com/your-org/document-platform.git
cd document-platform

# 2. 安装依赖
pnpm install --frozen-lockfile

# 3. 构建应用
pnpm build

# 4. 启动服务
pnpm start

# 或使用 PM2
pm2 start ecosystem.config.js
```

### 监控配置

- 设置日志轮转
- 配置监控告警
- 定期备份数据
- 设置自动更新

## 获取帮助

### 社区支持

- **GitHub Issues**: 提交 bug 报告或功能请求
- **讨论区**: 加入项目讨论
- **邮件列表**: 订阅更新通知

### 文档资源

- [Next.js 文档](https://nextjs.org/docs)
- [Prisma 文档](https://www.prisma.io/docs)
- [Socket.io 文档](https://socket.io/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)

---

如果在设置过程中遇到问题，请查看项目的 GitHub Issues 或联系开发团队。
