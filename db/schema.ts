import { relations } from "drizzle-orm";
import {
  foreignKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
  jsonb,
  boolean
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

export const users = pgTable("users",{
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull().unique(),
    clerkId: text("clerk_id").notNull().unique(),
    imageUrl: text("image_url").notNull().default("https://ui-avatars.com/api/?name=John+Doe"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
},(table)=>({
    clerkIdIdx: uniqueIndex("clerk_id_idx").on(table.clerkId),
    usernameIdx: uniqueIndex("username_idx").on(table.username),
}));


// 工作区表（用于组织文档）
export const workspaces = pgTable("workspaces", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ownerId: uuid("owner_id").references(() => users.id).notNull(),
    isPersonal: boolean("is_personal").notNull().default(true),
    permissions: jsonb("permissions").notNull().default({
        public: false,
        team: true
    }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    role: text("role").notNull().default("admin"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    uniqueMember: uniqueIndex("idx_workspace_member_unique").on(table.workspaceId, table.userId),
}));

// 更新文档表结构
export const documents = pgTable("documents",{
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id),
    ownerId: uuid("owner_id").references(() => users.id).notNull(),
    isTemplate: boolean("is_template").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    permissions: jsonb("permissions").notNull().default({
        public: false,
        team: true
    }),
    metadata: jsonb("metadata").default({}),
    yjsState: text("yjs_state"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
},(table)=>({
    foreignKey: foreignKey({
        columns: [table.ownerId],
        foreignColumns: [users.id],
        name: "fk_documents_owner_id",
    }),
}));

export const documentCollaborators = pgTable("document_collaborators", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    uniqueCollaborator: uniqueIndex("idx_document_collaborator_unique").on(table.documentId, table.userId),
}));

// Block 表（核心）
export const blocks = pgTable("blocks", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: 'cascade' }).notNull(),
    parentId: uuid("parent_id"), // 父 Block（将在relations中处理外键）
    type: text("type", {
      enum: [
        'page', 'heading_1', 'heading_2', 'heading_3',
        'paragraph', 'code', 'quote', 'list', 'todo',
        'divider', 'image', 'video', 'file', 'ai_generated',
        'database', 'table', 'kanban', 'calendar'
      ]
    }).notNull(), // Block 类型
    content: jsonb("content").notNull().default({}), // Block 内容
    properties: jsonb("properties").default({}), // 额外属性
    position: integer("position").notNull().default(0), // 在父 Block 中的位置
    version: integer("version").notNull().default(1), // Block 版本号
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    // 为树结构查询优化
    documentParentIdx: uniqueIndex("idx_blocks_document_parent_position").on(table.documentId, table.parentId, table.position),
}));

// 操作日志表
export const operations = pgTable("operations", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: 'cascade' }).notNull(),
    blockId: uuid("block_id").references(() => blocks.id, { onDelete: 'cascade' }),
    type: text("type").notNull(), // 操作类型
    payload: jsonb("payload").notNull(), // 操作数据
    clientId: text("client_id").notNull(), // 操作客户端标识
    userId: uuid("user_id").references(() => users.id),
    version: integer("version").notNull(), // 文档版本号
    timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
    // 为同步查询优化
    documentVersionIdx: uniqueIndex("idx_operations_document_version").on(table.documentId, table.version),
    documentTimestampIdx: uniqueIndex("idx_operations_document_timestamp").on(table.documentId, table.timestamp),
}));

// 快照表
export const documentSnapshots = pgTable("document_snapshots", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: 'cascade' }).notNull(),
    version: integer("version").notNull(),
    blocksSnapshot: jsonb("blocks_snapshot").notNull(), // 完整的 Block 树快照
    operationsSinceLast: jsonb("operations_since_last").default([]), // 从上次快照到现在的操作
    reason: text("reason").default('auto'), // 快照原因：auto/manual/backup
    sizeBytes: integer("size_bytes"), // 快照大小
    blockCount: integer("block_count"), // Block 数量
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    // 为历史查询优化
    documentVersionIdx: uniqueIndex("idx_snapshots_document_version").on(table.documentId, table.version),
}));

// 标签表
export const tags = pgTable("tags", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6B7280"),
    category: text("category"),
    workspaceId: uuid("workspace_id").references(() => workspaces.id),
    usage: integer("usage").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 文档标签关联表
export const documentTags = pgTable("document_tags", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: 'cascade' }).notNull(),
    tagId: uuid("tag_id").references(() => tags.id, { onDelete: 'cascade' }).notNull(),
    addedBy: uuid("added_by").references(() => users.id).notNull(),
    addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => ({
    uniqueDocumentTag: uniqueIndex("idx_document_tags_unique").on(table.documentId, table.tagId),
}));

export const integrationAccounts = pgTable("integration_accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    platform: text("platform").notNull(), // 'wordpress', 'ghost', 'medium', etc.
    siteUrl: text("site_url"),
    displayName: text("display_name").notNull(),
    authType: text("auth_type").notNull(),
    identifier: text("identifier"), // Replaces username
    credentials: jsonb("credentials").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiShorthandRecords = pgTable("ai_shorthand_records", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    title: text("title").notNull(),
    date: timestamp("date").notNull(),
    duration: integer("duration").notNull().default(0),
    status: text("status", { enum: ['recording', 'processing', 'completed'] }).notNull().default('recording'),
    transcript: text("transcript"),
    summary: text("summary"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 关系定义
export const usersRelations = relations(users, ({ many }) => ({
    documents: many(documents),
    workspaces: many(workspaces),
    workspaceMembers: many(workspaceMembers),
    documentCollaborators: many(documentCollaborators),
    createdBlocks: many(blocks),
    operations: many(operations),
    documentTags: many(documentTags),
    integrationAccounts: many(integrationAccounts),
    aiShorthandRecords: many(aiShorthandRecords),
}));

export const aiShorthandRecordsRelations = relations(aiShorthandRecords, ({ one }) => ({
    user: one(users, { fields: [aiShorthandRecords.userId], references: [users.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
    owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
    documents: many(documents),
    tags: many(tags),
    members: many(workspaceMembers),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
    workspace: one(workspaces, { fields: [documents.workspaceId], references: [workspaces.id] }),
    owner: one(users, { fields: [documents.ownerId], references: [users.id] }),
    blocks: many(blocks),
    operations: many(operations),
    snapshots: many(documentSnapshots),
    tags: many(documentTags),
    collaborators: many(documentCollaborators),
}));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
    document: one(documents, { fields: [blocks.documentId], references: [documents.id] }),
    parent: one(blocks, { fields: [blocks.parentId], references: [blocks.id] }),
    children: many(blocks),
    creator: one(users, { fields: [blocks.createdBy], references: [users.id] }),
}));

export const operationsRelations = relations(operations, ({ one }) => ({
    document: one(documents, { fields: [operations.documentId], references: [documents.id] }),
    block: one(blocks, { fields: [operations.blockId], references: [blocks.id] }),
    user: one(users, { fields: [operations.userId], references: [users.id] }),
}));

export const documentSnapshotsRelations = relations(documentSnapshots, ({ one }) => ({
    document: one(documents, { fields: [documentSnapshots.documentId], references: [documents.id] }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
    workspace: one(workspaces, { fields: [tags.workspaceId], references: [workspaces.id] }),
    documents: many(documentTags),
}));

export const documentTagsRelations = relations(documentTags, ({ one }) => ({
    document: one(documents, { fields: [documentTags.documentId], references: [documents.id] }),
    tag: one(tags, { fields: [documentTags.tagId], references: [tags.id] }),
    addedBy: one(users, { fields: [documentTags.addedBy], references: [users.id] }),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
    workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
    user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const documentCollaboratorsRelations = relations(documentCollaborators, ({ one }) => ({
    document: one(documents, { fields: [documentCollaborators.documentId], references: [documents.id] }),
    user: one(users, { fields: [documentCollaborators.userId], references: [users.id] }),
}));

export const integrationAccountsRelations = relations(integrationAccounts, ({ one }) => ({
    owner: one(users, { fields: [integrationAccounts.ownerId], references: [users.id] }),
}));

// Schema definitions
export const insertUserSchema = createInsertSchema(users)
export const selectUserSchema = createSelectSchema(users)
export const updateUserSchema = createUpdateSchema(users)

export const insertWorkspaceSchema = createInsertSchema(workspaces)
export const selectWorkspaceSchema = createSelectSchema(workspaces)
export const updateWorkspaceSchema = createUpdateSchema(workspaces)

export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers)
export const selectWorkspaceMemberSchema = createSelectSchema(workspaceMembers)
export const updateWorkspaceMemberSchema = createUpdateSchema(workspaceMembers)

export const insertDocumentSchema = createInsertSchema(documents)
export const selectDocumentSchema = createSelectSchema(documents)
export const updateDocumentSchema = createUpdateSchema(documents)

export const insertDocumentCollaboratorSchema = createInsertSchema(documentCollaborators)
export const selectDocumentCollaboratorSchema = createSelectSchema(documentCollaborators)
export const updateDocumentCollaboratorSchema = createUpdateSchema(documentCollaborators)

export const insertBlockSchema = createInsertSchema(blocks)
export const selectBlockSchema = createSelectSchema(blocks)
export const updateBlockSchema = createUpdateSchema(blocks)

export const insertOperationSchema = createInsertSchema(operations)
export const selectOperationSchema = createSelectSchema(operations)
export const updateOperationSchema = createUpdateSchema(operations)

export const insertDocumentSnapshotSchema = createInsertSchema(documentSnapshots)
export const selectDocumentSnapshotSchema = createSelectSchema(documentSnapshots)
export const updateDocumentSnapshotSchema = createUpdateSchema(documentSnapshots)

export const insertTagSchema = createInsertSchema(tags)
export const selectTagSchema = createSelectSchema(tags)
export const updateTagSchema = createUpdateSchema(tags)

export const insertDocumentTagSchema = createInsertSchema(documentTags)
export const selectDocumentTagSchema = createSelectSchema(documentTags)
export const updateDocumentTagSchema = createUpdateSchema(documentTags)

export const insertIntegrationAccountSchema = createInsertSchema(integrationAccounts)
export const selectIntegrationAccountSchema = createSelectSchema(integrationAccounts)
export const updateIntegrationAccountSchema = createUpdateSchema(integrationAccounts)
