# 快速修复数据库错误

## 问题
遇到错误：`Failed query: select "id", "username", "clerk_id"...`

这是因为数据库表结构还没有更新，缺少 `username` 字段。

## 解决方案

### 方法1: 使用 SQL 脚本（最简单）

```bash
# 确保 DATABASE_URL 环境变量已设置
psql $DATABASE_URL -f scripts/fix-users-table.sql
```

或者如果你有独立的数据库连接信息：

```bash
psql -h localhost -U your_username -d your_database -f scripts/fix-users-table.sql
```

### 方法2: 使用 Drizzle Push（推荐）

```bash
npm run db:push
```

这会自动同步 schema 到数据库。

### 方法3: 手动执行 SQL

连接到你的数据库，然后执行：

```sql
-- 添加 username 列
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

-- 为现有用户生成 username
UPDATE users
SET username = 'user_' || SUBSTRING(id::TEXT, 1, 8)
WHERE username IS NULL OR username = '';

-- 设置 NOT NULL
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS username_idx ON users(username);
```

## 验证

运行以下命令验证：

```bash
psql $DATABASE_URL -c "\d users"
```

你应该能看到 `username` 列存在。

## 如果表不存在

如果 `users` 表完全不存在，先运行：

```bash
psql $DATABASE_URL -f scripts/init-db.sql
```

然后再运行修复脚本。

