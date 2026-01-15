# 数据库设置指南

## 问题说明

如果遇到 `Failed query` 错误，通常是因为数据库表还没有创建。

## 解决方案

### 方法1: 使用SQL脚本初始化（推荐）

1. 确保你的 `.env.local` 文件中配置了 `DATABASE_URL`：
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/database_name
   ```

2. 连接到你的PostgreSQL数据库并运行初始化脚本：
   ```bash
   psql $DATABASE_URL -f scripts/init-db.sql
   ```

   或者如果你有独立的数据库连接信息：
   ```bash
   psql -h localhost -U your_username -d your_database -f scripts/init-db.sql
   ```

### 方法2: 使用Drizzle Kit（推荐用于开发）

1. 生成迁移文件：
   ```bash
   npm run db:generate
   ```

2. 推送schema到数据库：
   ```bash
   npm run db:push
   ```

### 方法3: 手动创建表

如果你更喜欢手动操作，可以直接在数据库中执行以下SQL：

```sql
-- 创建users表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    clerk_id TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=John+Doe',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建clerk_id索引
CREATE UNIQUE INDEX IF NOT EXISTS clerk_id_idx ON users(clerk_id);

-- 创建username索引
CREATE UNIQUE INDEX IF NOT EXISTS username_idx ON users(username);

-- 创建documents表
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建外键约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_documents_user_id'
    ) THEN
        ALTER TABLE documents 
        ADD CONSTRAINT fk_documents_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
```

## 验证

运行以下命令验证表是否创建成功：

```bash
psql $DATABASE_URL -c "\dt"
```

你应该能看到 `users` 和 `documents` 两个表。

## 从旧版本迁移

如果你之前使用的是 `first_name` 和 `last_name` 字段，需要迁移到新的 `username` 字段：

### 方法1: 使用迁移脚本（推荐）

```bash
npm run db:migrate-username
```

### 方法2: 使用SQL脚本

```bash
psql $DATABASE_URL -f scripts/migrate-to-username.sql
```

### 方法3: 手动迁移

如果你有现有数据，可以手动执行：

```sql
-- 添加 username 列
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

-- 从 first_name 和 last_name 生成 username
UPDATE users
SET username = COALESCE(
    first_name || '_' || last_name,
    first_name,
    last_name,
    'user_' || SUBSTRING(id::TEXT, 1, 8)
)
WHERE username IS NULL;

-- 设置约束
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS username_idx ON users(username);

-- 删除旧列（可选）
ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
```

## 常见问题

### 1. "relation does not exist" 错误
- 确保已经运行了初始化脚本
- 检查 `DATABASE_URL` 是否指向正确的数据库

### 2. "permission denied" 错误
- 确保数据库用户有创建表的权限
- 检查数据库连接字符串中的用户名和密码

### 3. 连接超时
- 检查数据库服务是否运行
- 验证 `DATABASE_URL` 中的主机和端口是否正确
- 检查防火墙设置

### 4. "duplicate key value violates unique constraint" 错误（迁移时）
- 迁移脚本会自动处理重复的用户名
- 如果仍有问题，手动检查并修复重复的 username

