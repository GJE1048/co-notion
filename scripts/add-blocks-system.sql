-- 添加基于 Block 的文档系统
-- 执行时间：紧跟 init-db.sql 之后

-- 添加 workspaces 表（工作区）
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_personal BOOLEAN NOT NULL DEFAULT TRUE,
    permissions JSONB NOT NULL DEFAULT '{"public": false, "team": true}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 更新 documents 表结构
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id),
ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"public": false, "team": true}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 重命名 user_id 为 owner_id 以保持一致性
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'user_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE documents RENAME COLUMN user_id TO owner_id;
    END IF;
END $$;

-- 创建 blocks 表（核心）
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    parent_id UUID,  -- 父 Block，支持树结构
    type TEXT NOT NULL,  -- Block 类型
    content JSONB NOT NULL DEFAULT '{}',  -- Block 内容
    properties JSONB DEFAULT '{}',  -- 额外属性
    position INTEGER NOT NULL DEFAULT 0,  -- 在父 Block 中的位置
    version INTEGER NOT NULL DEFAULT 1,  -- Block 版本号
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建操作日志表
CREATE TABLE IF NOT EXISTS operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
    type TEXT NOT NULL,  -- 操作类型
    payload JSONB NOT NULL,  -- 操作数据
    client_id TEXT NOT NULL,  -- 操作客户端标识
    user_id UUID REFERENCES users(id),
    version INTEGER NOT NULL,  -- 文档版本号
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 创建快照表
CREATE TABLE IF NOT EXISTS document_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    blocks_snapshot JSONB NOT NULL,  -- 完整的 Block 树快照
    operations_since_last JSONB DEFAULT '[]',  -- 从上次快照到现在的操作
    reason TEXT DEFAULT 'auto',  -- 快照原因：auto/manual/backup
    size_bytes INTEGER,  -- 快照大小
    block_count INTEGER,  -- Block 数量
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建标签表
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6B7280',
    category TEXT,
    workspace_id UUID REFERENCES workspaces(id),
    usage INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建文档标签关联表
CREATE TABLE IF NOT EXISTS document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES users(id),
    added_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加索引以优化查询性能

-- Blocks 表索引
CREATE INDEX IF NOT EXISTS idx_blocks_document_parent_position
ON blocks(document_id, parent_id, position);

CREATE INDEX IF NOT EXISTS idx_blocks_document_id ON blocks(document_id);
CREATE INDEX IF NOT EXISTS idx_blocks_parent_id ON blocks(parent_id);

-- Operations 表索引
CREATE INDEX IF NOT EXISTS idx_operations_document_version
ON operations(document_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_operations_document_timestamp
ON operations(document_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_operations_document_id ON operations(document_id);

-- Snapshots 表索引
CREATE INDEX IF NOT EXISTS idx_snapshots_document_version
ON document_snapshots(document_id, version DESC);

-- Tags 表索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_tags_unique
ON document_tags(document_id, tag_id);

-- 为 Block 自引用添加外键约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_blocks_parent_id'
    ) THEN
        ALTER TABLE blocks
        ADD CONSTRAINT fk_blocks_parent_id
        FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 添加默认工作区（个人工作区）
INSERT INTO workspaces (name, owner_id, is_personal)
SELECT '我的文档', id, TRUE
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM workspaces WHERE owner_id = users.id AND is_personal = TRUE
);

-- 将现有文档关联到用户的个人工作区
UPDATE documents
SET workspace_id = (
    SELECT id FROM workspaces
    WHERE owner_id = documents.owner_id AND is_personal = TRUE
    LIMIT 1
)
WHERE workspace_id IS NULL;

-- 为现有文档创建初始的标题 Block（如果还没有）
INSERT INTO blocks (document_id, type, content, position, created_by)
SELECT
    d.id,
    'heading_1',
    jsonb_build_object('text', jsonb_build_object('content', d.title)),
    0,
    d.owner_id
FROM documents d
WHERE NOT EXISTS (
    SELECT 1 FROM blocks b WHERE b.document_id = d.id
);

-- 添加工作区成员表
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT idx_workspace_member_unique UNIQUE (workspace_id, user_id)
);

-- 添加文档协作者表
CREATE TABLE IF NOT EXISTS document_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT idx_document_collaborator_unique UNIQUE (document_id, user_id)
);

-- 输出执行结果
DO $$
BEGIN
    RAISE NOTICE 'Blocks system migration completed successfully';
    RAISE NOTICE 'Created tables: workspaces, blocks, operations, document_snapshots, tags, document_tags, workspace_members, document_collaborators';
    RAISE NOTICE 'Updated table: documents (added workspace_id, is_template, is_archived, permissions, metadata, collaborators)';
    RAISE NOTICE 'Created indexes for performance optimization';
    RAISE NOTICE 'Created default personal workspaces for existing users';
    RAISE NOTICE 'Created initial title blocks for existing documents';
END $$;
