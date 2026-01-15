# Neon 数据库设置指南

## 问题诊断

如果你在 Neon 数据库中看不到任何表，可能是以下原因：

1. **DATABASE_URL 格式不正确**
2. **表还没有创建**
3. **连接到了错误的数据库**

## 快速修复步骤

### 1. 检查 .env.local 文件

确保 `.env.local` 文件中的 `DATABASE_URL` 格式正确：

```bash
# 正确的格式（Neon 数据库）
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require

# ❌ 错误的格式（不要包含 'psql' 前缀）
# DATABASE_URL=psql 'postgresql://...'
```

### 2. 使用 Drizzle Push 创建表（推荐）

这是最简单的方法，会自动根据 schema 创建表：

```bash
npm run db:push
```

### 3. 使用设置脚本

```bash
npm run db:setup
```

这个脚本会：
- 检查 .env.local 文件
- 验证 DATABASE_URL
- 创建所有必需的表
- 显示当前数据库状态

### 4. 手动运行 SQL 脚本

如果上述方法都不行，可以手动运行：

```bash
# 使用 psql 连接并运行脚本
psql "你的DATABASE_URL" -f scripts/init-db.sql
```

或者直接在 Neon 控制台的 SQL Editor 中运行 `scripts/init-db.sql` 的内容。

## 验证表是否创建成功

### 方法1: 在 Neon 控制台查看

1. 登录 Neon 控制台
2. 选择你的项目
3. 点击 "Tables" 标签
4. 应该能看到 `users` 和 `documents` 两个表

### 方法2: 使用 SQL 查询

在 Neon SQL Editor 中运行：

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';
```

应该返回：
- users
- documents

## 常见问题

### 问题1: "getaddrinfo ENOTFOUND base"

**原因**: DATABASE_URL 格式不正确，可能包含了 `psql` 前缀或其他无效字符。

**解决**: 
1. 打开 `.env.local` 文件
2. 确保 `DATABASE_URL` 行格式正确：
   ```
   DATABASE_URL=postgresql://user:password@host/database
   ```
3. 不要包含 `psql` 命令前缀
4. 不要包含单引号或双引号（除非值本身需要）

### 问题2: "relation does not exist"

**原因**: 表还没有创建。

**解决**: 运行 `npm run db:push` 或 `npm run db:setup`

### 问题3: 连接超时

**原因**: 
- DATABASE_URL 中的主机名或端口错误
- 网络连接问题
- Neon 数据库可能暂停了（免费计划）

**解决**:
1. 检查 Neon 控制台，确保数据库处于运行状态
2. 验证 DATABASE_URL 中的主机名是否正确
3. 确保网络可以访问 Neon 服务器

## 正确的 .env.local 格式示例

```env
# Neon 数据库连接字符串
DATABASE_URL=postgresql://neondb_owner:your_password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Clerk 配置
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_SIGNING_SECRET=whsec_...
```

## 下一步

表创建成功后：
1. 重启开发服务器：`npm run dev`
2. 访问应用，应该不再出现数据库错误
3. 注册/登录用户，webhook 会自动创建用户记录

