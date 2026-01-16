# 基于 Block 结构的文档管理系统

## 概述

本系统采用类似 Notion 的设计理念，实现基于 Block（块）结构的文档管理系统。通过操作日志（OpLog）+ Block 树 + 定期快照的方式，实现高效的实时协同编辑、版本控制和历史回溯。支持 AI 内容块无缝集成，提供丰富的文档编辑体验。

## 核心设计理念

### 1. Block 结构设计

**Block（块）概念**：
Block 是文档的最小组成单位，每个 Block 都有唯一的 ID、类型和内容。整个文档是一个 Block 树结构，支持嵌套和层级关系。

**Block 类型**：
```typescript
type BlockType =
  | 'page'           // 页面根节点
  | 'heading_1'      // 一级标题
  | 'heading_2'      // 二级标题
  | 'heading_3'      // 三级标题
  | 'paragraph'      // 段落
  | 'code'           // 代码块
  | 'quote'          // 引用
  | 'list'           // 列表
  | 'todo'           // 待办事项
  | 'divider'        // 分割线
  | 'image'          // 图片
  | 'video'          // 视频
  | 'file'           // 文件
  | 'ai_generated'   // AI 生成内容
  | 'database'       // 数据库视图
  | 'table'          // 表格
  | 'kanban'         // 看板
  | 'calendar';      // 日历
```

**Block 数据结构**：
```typescript
interface Block {
  id: string;
  type: BlockType;
  parentId?: string;        // 父 Block ID，用于构建树结构
  children: string[];       // 子 Block ID 列表
  content: BlockContent;    // 具体内容，根据类型不同
  properties: Record<string, any>; // 额外属性
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: number;
}

interface BlockContent {
  // 文本类 Block
  text?: {
    content: string;
    annotations: TextAnnotation[];
  };

  // 媒体类 Block
  file?: {
    url: string;
    name: string;
    size: number;
    mimeType: string;
  };

  // AI 生成内容
  aiGenerated?: {
    prompt: string;
    model: string;
    response: string;
    metadata: Record<string, any>;
  };

  // 数据库/表格内容
  database?: {
    schema: DatabaseSchema;
    records: DatabaseRecord[];
  };
}
```

## 核心功能

### 1. Block 级协同模型概览

- **存储粒度**：每个 Block 对应 blocks 表中的一行记录，字段包括：
  - `id`: UUID，Block 唯一标识，支持跨文档引用
  - `document_id`: 所属文档
  - `parent_id`: 父 Block，实现树形结构
  - `type`: Block 类型（paragraph、heading 等）
  - `content`: JSONB，存储具体内容
  - `properties`: JSONB，存储额外属性（如样式、引用信息等）
  - `position`: 整数，同一父节点下的排序位置，配合批量重排 API 支持拖拽排序
  - `version`: Block 内部版本号
  - `created_by`/`created_at`/`updated_at`: 审计字段
- **引用能力**：
  - 通过在 `properties` 中约定结构（如 `{ reference: { blockId, documentId } }`）实现 Block 间 / 跨文档引用
  - 前端在渲染时根据引用信息发起 Block 详情查询并进行展示
- **协同基础**：
  - 所有对 Block 的结构和内容修改都会转换为 Operation，写入 `operations` 表
  - 操作日志 + Block 当前状态 + 快照共同构成协同编辑与历史回溯的基础

### 2. 操作日志（OpLog）同步

**操作类型定义**：
```typescript
type OperationType =
  | 'create_block'      // 创建 Block
  | 'update_block'      // 更新 Block 内容/属性
  | 'delete_block'      // 删除 Block
  | 'move_block'        // 移动 Block 位置
  | 'update_children';  // 更新子 Block 顺序

interface Operation {
  id: string;
  documentId: string;
  blockId: string;
  type: OperationType;
  payload: Record<string, any>;  // 操作的具体数据
  clientId: string;              // 操作发起者
  timestamp: Date;
  version: number;               // 文档版本号
}
```

**同步机制**：
- **本地编辑**：用户在前端 Block 编辑器中的操作（创建 / 更新 / 删除 / 拖拽移动）首先更新本地 UI 状态
- **增量同步**：前端将本次操作封装为 Operation，通过 TRPC / REST 写入 `operations` 表，同时更新 blocks 表
- **实时推送**：后端在记录 Operation 后，通过 WebSocket 将操作广播给同一文档房间的其他在线协作者
- **冲突解决**：基于时间戳、版本号以及后续引入的 CRDT / OT 规则合并冲突
- **离线支持**：客户端在离线时缓存本地 Operation，恢复连接后批量上报并进行重放

### 3. 快照机制

**定期快照**：
- 每 5 分钟自动创建文档快照
- 手动创建重要版本快照
- 快照包含完整的 Block 树状态
- 支持快速加载和历史回溯

**快照数据结构**：
```typescript
interface DocumentSnapshot {
  id: string;
  documentId: string;
  version: number;
  blocks: Block[];           // 完整的 Block 树
  operations: Operation[];   // 从上次快照到现在的操作日志
  createdAt: Date;
  metadata: {
    reason: 'auto' | 'manual' | 'backup';
    size: number;
    blockCount: number;
  };
}
```

### 4. 实时协同编辑

**协同状态管理**：
- 使用 Yjs 或类似 CRDT 库管理本地状态
- WebSocket 连接实现实时同步
- 用户光标位置共享
- 操作冲突自动解决

**协作状态指示**：
- 在线用户列表
- 用户光标位置显示
- 编辑冲突提示
- 实时通知机制

### 5. 文档组织与导航

**工作区结构**：
- 支持多级文件夹组织
- 文档可以作为其他文档的子页面
- 灵活的导航树结构

**标签与分类**：
```typescript
interface Tag {
  id: string;
  name: string;
  color: string;
  category?: string;
  usage: number;
}

interface DocumentTag {
  documentId: string;
  tagId: string;
  addedBy: string;
  addedAt: Date;
}
```

**组织功能**：
- 智能文件夹管理
- 标签自动分类
- 文档模板系统
- 快速搜索和过滤

### 3. 文档关系图谱

**关系类型**:
- **引用关系**: 文档A引用了文档B
- **协作关系**: 用户共同编辑的文档
- **层级关系**: 父子文档关系
- **相似关系**: 内容相似的文档

**图谱可视化**:
```typescript
interface RelationNode {
  id: string;
  type: 'document' | 'folder' | 'user';
  label: string;
  position: { x: number; y: number };
  data: any;
}

interface RelationEdge {
  source: string;
  target: string;
  type: 'reference' | 'collaboration' | 'hierarchy' | 'similarity';
  weight: number;
}
```

## 前端架构设计

### Block 编辑器组件

**核心组件结构**：
```typescript
// Block 编辑器主组件
interface BlockEditorProps {
  documentId: string;
  initialBlocks: Block[];
  onBlockChange: (blockId: string, changes: Partial<Block>) => void;
  onBlockCreate: (block: Omit<Block, 'id'>) => void;
  onBlockDelete: (blockId: string) => void;
}

// 单个 Block 组件
interface BlockComponentProps {
  block: Block;
  isSelected: boolean;
  isEditing: boolean;
  collaborators: Collaborator[];
  onUpdate: (updates: Partial<Block>) => void;
  onSelect: () => void;
  onDelete: () => void;
}
```

**Block 类型组件**：
- **文本 Block**：支持富文本编辑、格式化
- **媒体 Block**：图片、视频、文件上传
- **列表 Block**：有序/无序列表、任务列表
- **代码 Block**：语法高亮、多语言支持
- **表格 Block**：可编辑表格、数据库视图
- **AI Block**：AI 生成内容、交互式编辑

### 协同编辑界面

**实时协作指示器**：
```typescript
interface CollaborationIndicatorProps {
  users: Array<{
    id: string;
    name: string;
    avatar: string;
    cursor: { blockId: string; offset: number };
    color: string;
  }>;
  documentId: string;
}
```

**编辑状态显示**：
- 用户光标位置实时显示
- 编辑冲突提示
- 离线状态指示
- 保存状态反馈

### 导航与组织界面

**侧边栏导航**：
```
📄 工作区
  📄 最近文档
  📁 私有文档
    📄 项目计划
    📄 会议记录
  📁 团队文档
    📄 API 文档
    📄 用户手册
  🏷️ 标签
    🏷️ 🚀 紧急
    🏷️ 📋 待办
  📝 模板
    📝 会议纪要
    📝 项目报告
```

**文档列表视图**：
- 支持多种布局：列表、网格、卡片
- 实时协作状态显示
- 快速操作：重命名、移动、删除
- 智能排序和过滤

### Block 编辑交互

**键盘快捷键**：
- `Enter`: 创建新 Block 或换行
- `Tab`: 缩进 Block（创建子 Block）
- `Shift+Tab`: 减少缩进
- `Cmd/Ctrl+B`: 粗体
- `Cmd/Ctrl+I`: 斜体
- `Cmd/Ctrl+K`: 链接
- `/`: 快速创建 Block（Slash 命令）
 
**拖拽操作与排序**：
- Block 在同一父节点下支持拖拽调整顺序，前端在拖拽结束后计算新的 `position` 序列，并调用后端的批量重排接口：
  - `reorderBlocks(documentId, parentId, blockUpdates: Array<{ id, position }>)`
- 跨层级移动（改变父节点）通过 `moveBlock(id, newParentId, newPosition)` 实现
- 拖拽排序完成后，会同步写入 blocks 表并记录对应的 `reorder_blocks` / `move_block` 操作日志

**跨文档 Block 引用**：
- 用户可以在文档中插入“引用 Block”，引用其他文档中的 Block 内容
- 引用 Block 的 `type` 可以仍然使用文本类类型（如 `paragraph`），但在 `properties.reference` 中记录来源：
  - `properties.reference = { blockId: string, documentId: string }`
- 渲染时根据 `reference` 信息加载目标 Block 内容，保持展示同步
- 被引用 Block 更新后，通过实时协同机制（WebSocket + Operation）将变更推送到引用方，实现“跟随更新”的效果

**右键菜单**：
- 复制/粘贴 Block
- 转换为其他类型
- 添加评论
- 查看历史版本

## 搜索功能

### 全文搜索

**搜索类型**:
- **文档内容搜索**: 在文档内容中搜索关键词
- **文档标题搜索**: 在文档标题中搜索
- **标签搜索**: 按标签筛选文档
- **作者搜索**: 按创建者或修改者搜索

**搜索语法**:
```bash
# 基础搜索
keyword

# 精确匹配
"exact phrase"

# 标签搜索
tag:重要

# 作者搜索
author:张三

# 时间范围
modified:2024-01-01..2024-12-31

# 组合搜索
tag:项目A author:李四 "需求文档"
```

### 智能搜索

**搜索建议**:
- 自动补全
- 相关搜索推荐
- 搜索历史
- 热门搜索

**搜索结果排序**:
- 相关度排序
- 时间排序
- 访问频率排序

## 回收站功能

### 回收站管理

**软删除机制**:
```typescript
interface DeletedItem {
  id: string;
  type: 'document' | 'folder';
  originalPath: string;
  deletedAt: Date;
  deletedBy: string;
  restorePath?: string;
}
```

**回收站操作**:
- 查看已删除项目
- 恢复删除的项目
- 永久删除项目
- 清空回收站

### 自动清理

**清理策略**:
- 30天后自动清理
- 大文件优先清理
- 用户确认机制
- 批量清理功能

## 数据库设计

### 核心表结构

**1. 文档表（Documents）**：
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  workspace_id UUID REFERENCES workspaces(id),
  is_template BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  permissions JSONB DEFAULT '{"public": false, "team": true}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**2. Block 表（核心）**：
```sql
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blocks(id),  -- 父 Block，支持树结构
  type TEXT NOT NULL,                    -- Block 类型
  content JSONB NOT NULL DEFAULT '{}',   -- Block 内容
  properties JSONB DEFAULT '{}',         -- 额外属性
  position INTEGER DEFAULT 0,            -- 在父 Block 中的位置
  version INTEGER DEFAULT 1,             -- Block 版本号
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为树结构查询优化
CREATE INDEX idx_blocks_document_parent ON blocks(document_id, parent_id);
CREATE INDEX idx_blocks_position ON blocks(parent_id, position);
```

**3. 操作日志表（Operations）**：
```sql
CREATE TABLE operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                    -- 操作类型
  payload JSONB NOT NULL,                -- 操作数据
  client_id TEXT NOT NULL,               -- 操作客户端标识
  user_id UUID REFERENCES users(id),
  version INTEGER NOT NULL,              -- 文档版本号
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 为同步查询优化
CREATE INDEX idx_operations_document_version ON operations(document_id, version DESC);
CREATE INDEX idx_operations_timestamp ON operations(document_id, timestamp DESC);
```

**4. 快照表（Snapshots）**：
```sql
CREATE TABLE document_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  blocks_snapshot JSONB NOT NULL,        -- 完整的 Block 树快照
  operations_since_last JSONB DEFAULT '[]', -- 从上次快照到现在的操作
  reason TEXT DEFAULT 'auto',            -- 快照原因：auto/manual/backup
  size_bytes INTEGER,                    -- 快照大小
  block_count INTEGER,                   -- Block 数量
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为历史查询优化
CREATE INDEX idx_snapshots_document_version ON document_snapshots(document_id, version DESC);
```

## 权限管理

### 文档权限

**权限级别**:
- **公开**: 所有人可见
- **团队**: 团队成员可见
- **私有**: 仅创建者可见
- **自定义**: 自定义用户列表

**操作权限**:
- 查看权限
- 编辑权限
- 删除权限
- 分享权限
- 管理权限

### 协作设置

**协作选项**:
- 允许评论
- 允许编辑
- 需要审批
- 实时通知

## API 接口设计

### 文档管理 API

```typescript
// 获取文档基本信息
GET /api/documents/:id

// 创建新文档
POST /api/documents
{
  "title": "新文档",
  "workspaceId": "workspace-id",
  "templateId": "template-id"  // 可选
}

// 更新文档元信息
PATCH /api/documents/:id
{
  "title": "新标题",
  "isArchived": false,
  "permissions": {...}
}
```

### Block 操作 API

```typescript
// 获取文档的完整 Block 树
GET /api/documents/:id/blocks

// 创建新 Block
POST /api/documents/:id/blocks
{
  "type": "paragraph",
  "parentId": "parent-block-id",
  "content": {"text": {"content": "Hello World"}},
  "position": 0
}

// 更新 Block
PATCH /api/blocks/:blockId
{
  "content": {"text": {"content": "Updated content"}},
  "properties": {"bold": true}
}

// 删除 Block
DELETE /api/blocks/:blockId

// 移动 Block
PUT /api/blocks/:blockId/move
{
  "newParentId": "new-parent-id",
  "newPosition": 1
}
```

### 协同同步 API

```typescript
// WebSocket 连接用于实时同步
WebSocket: /api/documents/:id/sync

// 批量提交操作
POST /api/documents/:id/operations
{
  "operations": [
    {
      "blockId": "block-1",
      "type": "update_block",
      "payload": {"content": "new content"},
      "version": 42
    }
  ]
}

// 获取最新操作
GET /api/documents/:id/operations?since=:version

// 获取文档当前状态
GET /api/documents/:id/state
```

### 版本管理 API

```typescript
// 获取版本历史
GET /api/documents/:id/versions

// 获取特定版本快照
GET /api/documents/:id/versions/:version

// 恢复到指定版本
POST /api/documents/:id/restore
{
  "version": 42,
  "createSnapshot": true
}

// 创建手动快照
POST /api/documents/:id/snapshot
{
  "reason": "manual",
  "description": "重要版本"
}
```

### 搜索 API

```typescript
// 全文搜索
GET /api/search?q=keyword&type=blocks

// Block 内搜索
GET /api/documents/:id/search?q=keyword

// 高级搜索
POST /api/search/advanced
{
  "query": "machine learning",
  "filters": {
    "types": ["paragraph", "heading"],
    "authors": ["user-1", "user-2"],
    "dateRange": {"start": "2024-01-01", "end": "2024-12-31"}
  }
}
```

## 性能优化

### 数据缓存

**缓存策略**:
- 文件夹结构缓存
- 搜索结果缓存
- 关系图谱缓存
- 用户权限缓存

### 懒加载

**加载优化**:
- 分页加载文档列表
- 按需加载文件夹内容
- 虚拟滚动大列表
- 预加载相邻内容

### 索引优化

**数据库索引**:
- 文档标题索引
- 标签索引
- 修改时间索引
- 全文搜索索引

## 监控与统计

### 使用统计

**统计指标**:
- 文档数量趋势
- 存储使用情况
- 协作活跃度
- 搜索使用频率

### 性能监控

**监控指标**:
- API响应时间
- 搜索查询性能
- 缓存命中率
- 存储操作延迟

## AI 集成设计

### AI Block 类型

**AI 生成内容 Block**：
```typescript
interface AIContentBlock extends Block {
  type: 'ai_generated';
  content: {
    aiGenerated: {
      prompt: string;
      model: string;           // 'gpt-4', 'claude', etc.
      response: string;
      tokens: number;
      generationTime: number;
      metadata: {
        temperature?: number;
        maxTokens?: number;
        modelVersion?: string;
      };
    };
  };
}
```

**AI 交互功能**：
- **智能续写**：基于上下文自动生成内容
- **内容改写**：优化现有内容的表达
- **翻译**：多语言翻译支持
- **摘要生成**：自动生成文档摘要
- **问答**：基于文档内容回答问题

### AI 增强编辑

**智能建议**：
- 文本纠错和语法检查
- 写作风格优化建议
- 内容结构化建议
- 相关内容推荐

**自动化工作流**：
- 会议记录自动整理
- 代码注释自动生成
- 文档模板智能填充
- 重复内容检测和合并

### AI 数据管理

**AI 生成追踪**：
```typescript
interface AIGenerationRecord {
  id: string;
  documentId: string;
  blockId: string;
  prompt: string;
  response: string;
  model: string;
  tokensUsed: number;
  cost: number;              // API 调用费用
  quality: number;           // 用户评价 1-5
  timestamp: Date;
}
```

**AI 性能监控**：
- 响应时间统计
- 生成质量评估
- 用户满意度分析
- 成本效益分析

## 性能优化

### Block 级缓存策略

**多层缓存架构**：
```typescript
interface CacheLayers {
  // L1: 内存缓存（当前编辑的文档）
  memory: Map<string, Block[]>;

  // L2: IndexedDB（离线文档）
  indexedDB: IDBDatabase;

  // L3: Redis（热门文档）
  redis: RedisClient;

  // L4: 数据库查询缓存
  database: QueryCache;
}
```

**智能预加载**：
- 预测用户访问模式
- 预加载相关 Block
- 渐进式内容加载
- 按需加载媒体内容

### 协同编辑优化

**操作批处理**：
- 批量提交操作减少网络请求
- 操作压缩和去重
- 智能合并连续操作
- 延迟同步优化

**冲突解决算法**：
```typescript
// 基于时间戳和操作类型的冲突解决
function resolveConflict(localOp: Operation, remoteOp: Operation): Operation {
  // 1. 时间戳比较
  if (localOp.timestamp > remoteOp.timestamp) return localOp;

  // 2. 操作类型优先级
  const priority = {
    'delete_block': 1,
    'update_block': 2,
    'create_block': 3,
    'move_block': 4
  };

  // 3. 业务规则处理
  // ...
}
```

## 扩展性设计

### 插件系统

**Block 插件接口**：
```typescript
interface BlockPlugin {
  type: string;              // 插件支持的 Block 类型
  name: string;
  version: string;

  // 渲染组件
  render: (block: Block, props: BlockProps) => ReactElement;

  // 编辑器组件
  editor: (block: Block, onChange: (block: Block) => void) => ReactElement;

  // 操作处理
  operations: {
    create?: (data: any) => Partial<Block>;
    update?: (block: Block, data: any) => Partial<Block>;
    validate?: (block: Block) => ValidationResult;
  };

  // 导出支持
  exporters: {
    markdown?: (block: Block) => string;
    html?: (block: Block) => string;
    pdf?: (block: Block) => Buffer;
  };
}
```

### 第三方集成

**集成框架**：
```typescript
interface IntegrationProvider {
  name: string;
  type: 'storage' | 'collaboration' | 'ai' | 'export';

  // 认证配置
  auth: {
    oauth?: OAuthConfig;
    apiKey?: APIKeyConfig;
  };

  // 功能接口
  api: {
    import?: (source: string) => Promise<Block[]>;
    export?: (blocks: Block[]) => Promise<string>;
    sync?: (documentId: string) => Promise<void>;
  };
}
```

**支持的集成类型**：
- **云存储**：Google Drive, OneDrive, Dropbox
- **协同工具**：Slack, Microsoft Teams, Figma
- **项目管理**：Jira, Trello, Asana
- **版本控制**：Git, GitHub, GitLab
- **知识库**：Confluence, Notion, Roam Research
