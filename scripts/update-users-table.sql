-- 更新 users 表结构：添加 username 字段并迁移数据

-- 1. 检查并添加 username 列（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'username'
    ) THEN
        ALTER TABLE users ADD COLUMN username TEXT;
        RAISE NOTICE 'Added username column';
    ELSE
        RAISE NOTICE 'username column already exists';
    END IF;
END $$;

-- 2. 从 first_name 和 last_name 生成 username（如果这些列存在）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        UPDATE users
        SET username = COALESCE(
            first_name || '_' || last_name,
            first_name,
            last_name,
            'user_' || SUBSTRING(id::TEXT, 1, 8)
        )
        WHERE username IS NULL OR username = '';
        RAISE NOTICE 'Migrated data from first_name/last_name to username';
    END IF;
END $$;

-- 3. 为所有没有 username 的记录生成默认值
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

-- 6. 创建唯一索引（如果不存在）
CREATE UNIQUE INDEX IF NOT EXISTS username_idx ON users(username);

-- 7. 删除旧的列（可选 - 取消注释以执行）
-- ALTER TABLE users DROP COLUMN IF EXISTS first_name;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_name;

