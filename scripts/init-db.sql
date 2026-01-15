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

-- 创建外键
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

