CREATE INDEX IF NOT EXISTS idx_documents_owner_updated_at
ON documents (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_personal
ON workspaces (owner_id, is_personal);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
ON workspace_members (user_id);

CREATE INDEX IF NOT EXISTS idx_blocks_document_position
ON blocks (document_id, position);
