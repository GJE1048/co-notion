-- 迁移脚本：将 first_name 和 last_name 合并为 username
-- 注意：此脚本会删除 first_name 和 last_name 列

-- 1. 添加 username 列（如果不存在）
ALTER TABLE users
ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. 从 first_name 和 last_name 生成 username
-- 如果 first_name 和 last_name 存在，则合并它们
UPDATE users
SET username = COALESCE(
    first_name || '_' || last_name,
    first_name,
    last_name,
    'user_' || SUBSTRING(id::TEXT, 1, 8)
)
WHERE username IS NULL;

-- 3. 处理可能的重复用户名（添加后缀）
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
        
        WHILE EXISTS (SELECT 1 FROM users WHERE username = new_username) LOOP
            counter := counter + 1;
            new_username := rec.username || '_' || counter;
        END LOOP;
        
        UPDATE users
        SET username = new_username
        WHERE id = rec.id;
    END LOOP;
END $$;

-- 4. 确保所有用户都有 username
UPDATE users
SET username = 'user_' || SUBSTRING(id::TEXT, 1, 8)
WHERE username IS NULL OR username = '';

-- 5. 设置 username 为 NOT NULL
ALTER TABLE users
ALTER COLUMN username SET NOT NULL;

-- 6. 添加唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS username_idx ON users(username);

-- 7. 删除旧的列（可选，取消注释以执行）
-- ALTER TABLE users DROP COLUMN IF EXISTS first_name;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_name;

