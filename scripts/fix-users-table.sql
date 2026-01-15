-- 快速修复：更新 users 表以添加 username 字段
-- 这个脚本会安全地更新表结构，即使表已经存在

-- 1. 如果表不存在，创建它
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT,
    clerk_id TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=John+Doe',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. 添加 username 列（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'username'
    ) THEN
        ALTER TABLE users ADD COLUMN username TEXT;
    END IF;
END $$;

-- 3. 为现有用户生成 username（如果还没有）
UPDATE users
SET username = 'user_' || SUBSTRING(id::TEXT, 1, 8)
WHERE username IS NULL OR username = '';

-- 4. 处理重复的用户名
DO $$
DECLARE
    rec RECORD;
    counter INTEGER;
    new_username TEXT;
BEGIN
    FOR rec IN
        SELECT id, username
        FROM users
        WHERE username IN (
            SELECT username
            FROM users
            GROUP BY username
            HAVING COUNT(*) > 1
        )
    LOOP
        counter := 1;
        new_username := rec.username || '_' || counter;
        
        WHILE EXISTS (SELECT 1 FROM users WHERE username = new_username AND id != rec.id) LOOP
            counter := counter + 1;
            new_username := rec.username || '_' || counter;
        END LOOP;
        
        UPDATE users
        SET username = new_username
        WHERE id = rec.id;
    END LOOP;
END $$;

-- 5. 设置 username 为 NOT NULL
ALTER TABLE users
ALTER COLUMN username SET NOT NULL;

-- 6. 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS clerk_id_idx ON users(clerk_id);
CREATE UNIQUE INDEX IF NOT EXISTS username_idx ON users(username);

-- 7. 删除旧列（如果存在且不再需要）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users DROP COLUMN first_name;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users DROP COLUMN last_name;
    END IF;
END $$;

