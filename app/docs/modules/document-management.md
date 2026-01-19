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

### 6. 文档共享与共享工作区

> 说明：本节重点描述文档共享的业务模型与前端交互设计。关于“谁可以发起分享、修改他人权限、撤回分享”等具体权限规则，请参考[用户权限与安全控制模块](./permissions.md)中的“文档共享权限控制”小节。

#### 6.1 数据模型与状态

在文档共享场景中，不复制文档实体，而是通过“共享邀请 + 权限记录”来描述“哪份文档被分享给了谁、处于什么状态、拥有何种权限”：

```typescript
// 文档共享邀请 / 权限记录
interface DocumentShare {
  id: string;
  documentId: string;
  fromUserId: string;
  toUserId: string;
  level: PermissionLevel; // VIEWER/COMMENTER/EDITOR/ADMIN
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
  viewedAt?: Date;     // 被分享者首次查看时间
  acceptedAt?: Date;   // 被分享者确认接收时间
}

// 分享统计视图（供前端“共享文档”页面使用）
interface SharedDocumentSummary {
  documentId: string;
  title: string;
  fromUserId: string;
  shares: Array<{
    toUserId: string;
    level: PermissionLevel;
    status: 'pending' | 'accepted' | 'declined' | 'revoked';
    viewedAt?: Date;
    acceptedAt?: Date;
  }>;
}
```

- 同一份文档可以对应多条 DocumentShare 记录，每条记录表示一次“分享给某个用户”的行为。
- `status='pending'` 表示被分享用户尚未在系统中明确“接受”这份文档；`accepted` 表示已加入对方工作区。
- `level` 字段与权限模块的五级权限体系对齐，用于控制被分享用户在该文档上的操作能力。

#### 6.2 分享者视角：共享文档管理入口

在侧边栏或顶部导航中增加一个“共享文档”入口，点击后进入“文档分享管理页”，主要职责：

- 展示当前用户作为分享发起人的所有共享记录（fromUserId = currentUserId）。
- 按文档聚合，列表项包含：
  - 文档标题、位置、创建时间等基础信息
  - 每个被分享用户的状态：
    - 是否查看（viewedAt 是否存在）
    - 是否接受（status 是否为 accepted）
    - 当前权限等级（level）
- 支持常见操作：
  - 修改某个被分享用户的权限等级（例如从 VIEWER 升级为 EDITOR）
  - 撤回对某个用户的分享（status 变更为 revoked）
  - 批量撤回整份文档的所有分享记录

典型页面结构：

- 左侧：文档列表（仅展示当前用户发起分享的文档）
- 右侧：选中文档的分享详情，包括：
  - 已分享给哪些用户
  - 每个用户的查看状态/接受状态/权限等级
  - 修改权限、撤回分享的操作入口

为支撑上述功能，后端需要提供：

- `GET /documents/shared-by-me`：返回 SharedDocumentSummary 列表
- `PATCH /documents/:id/shares/:shareId`：允许 OWNER/ADMIN 修改 `level` 或撤回分享
- 在权限模块中约束：只有 OWNER/ADMIN 才能调整他人权限或撤回分享

#### 6.3 被分享者视角：共享文档加入工作区

被分享的用户通常通过“分享链接”进入文档。当系统识别到当前登录用户为分享目标（存在 `toUserId = currentUserId` 的 DocumentShare 记录）时，需要弹出确认对话框：

- 文案示例：
  - “X 邀请你协作编辑文档《XXX》，是否将该文档添加到你的工作区？”
- 行为选项：
  - “接受并加入我的文档”
  - “暂不加入”/“拒绝”

接受行为效果：

- 将对应的 DocumentShare 记录状态更新为 `accepted`，记录 `acceptedAt`。
- 将该文档加入当前用户的文档工作区视图中，常见实现方式：
  - 直接归入“我的文档”工作区，并在元数据中标记 `source: 'shared'`，前端可用于筛选/展示；或
  - 为每个用户维护一个虚拟/实体的“共享文档”工作区，专门聚合所有 `status='accepted'` 的共享文档。
- 更新权限缓存，使后续访问该文档时，后端根据 DocumentShare 记录授予相应的权限级别。

拒绝行为效果：

- 将 DocumentShare 状态更新为 `declined`，可选地仍允许通过原始链接只读访问，也可以直接收回访问能力，视产品策略而定。
- 不将文档加入任何工作区列表。

对应后端接口示例：

- `POST /documents/shares/:shareId/accept`
- `POST /documents/shares/:shareId/decline`

#### 6.4 共享文档的可见性与权限校验

所有文档读取接口在权限校验时需要统一考虑共享场景：

- 当前用户为文档所有者（ownerId = currentUserId）；或
- 存在 DocumentShare 记录：`documentId = id AND toUserId = currentUserId AND status = 'accepted'`。

对于编辑、评论等操作，则需要进一步对比 DocumentShare.level 与权限映射表（见权限模块文档），例如：

- `level >= EDITOR` 才允许内容编辑；
- `level >= COMMENTER` 才允许发表评论；
- 仅 OWNER/ADMIN 可以修改其他用户的 DocumentShare.level 或撤回分享。

在前端导航中，“我的文档”与“共享文档”可以共存：

- “我的文档”：展示当前用户为所有者的文档集合。
- “共享文档”：展示当前用户通过 DocumentShare.accepted 获得访问权限的文档集合。
- 如果希望简化初始实现，也可以暂时只保留“我的文档”入口，将共享文档混合展示，并通过标签/筛选条件区分来源。

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

## 性能优化：Redis 缓存与 Block 分页加载

### 1. 目标与整体思路

- 典型慢场景: 打开大文档时一次性加载大量 Block, 首次响应时间可能达到 5～10 秒。
- 优化目标: 通过后端 Redis 缓存和 Block 分页加载, 将 TTFB 压到 100ms 级别, 让大文档的首次渲染可控、可渐进。
- 技术选型: 使用 Upstash 提供的 serverless Redis 服务 (`@upstash/redis`), 结合 TRPC 文档接口实现缓存层。

整体思路:
- 后端在读取文档和 Block 列表时优先查询 Redis, 未命中再访问 Postgres。
- 为大文档只加载首屏前若干个 Block, 后续通过分页或增量加载补齐。
- 文档更新后同步清理对应缓存 key, 保证数据一致性。

### 2. Upstash Redis 集成方案

#### 2.1 环境配置

1. 在 Upstash 控制台创建 Redis 数据库, 获取:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
2. 在 `.env.local` 中添加或更新:

```env
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
```

项目已经在 `package.json` 中引入了 `@upstash/redis` 依赖, 一般不需要额外安装。如果需要单独安装, 可以执行:

```bash
pnpm add @upstash/redis
```

#### 2.2 Redis 客户端封装

在 `lib/redis.ts` 中封装单例 Redis 客户端, 供 TRPC 过程调用:

```typescript
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

在服务端代码中统一从 `lib/redis` 引入, 避免重复初始化。

### 3. 文档读取接口的缓存设计

#### 3.1 文档元数据缓存

适用接口: 单文档查询, 如 `documents.getDocument`.

缓存策略:
- key 设计: `doc:{documentId}`
- value 内容: 文档元数据和必要的权限信息 (不包含大块内容)
- TTL: 30～60 秒, 在保证新鲜度的前提下提升命中率

伪代码示例:

```typescript
const cacheKey = `doc:${input.id}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return cached;
}

const document = await db.query.documents.findFirst({
  where: eq(documents.id, input.id),
});

if (!document) {
  throw new TRPCError({ code: "NOT_FOUND" });
}

await redis.setex(cacheKey, 60, document);

return document;
```

集成方式:
- 在 TRPC `documents` 路由中, 为只读查询接口增加缓存逻辑。
- 所有涉及文档基础信息的页面 (主页最近文档列表、文档详情入口) 都会自然受益。

#### 3.2 Block 列表缓存 (首屏)

适用接口: 文档 Block 列表查询, 如 `documents.getDocumentBlocks`.

首屏缓存策略:
- 只缓存第 1 页 Block 数据 (例如前 30 条)。
- key 设计: `blocks:${documentId}:page:1`
- value 内容: 排序后的 Block 列表 JSON。
- TTL: 30～60 秒。

伪代码示例:

```typescript
const cacheKey = `blocks:${input.documentId}:page:1`;
const cached = await redis.get(cacheKey);

if (cached) {
  return cached;
}

const blocks = await db.query.blocks.findMany({
  where: eq(blocks.documentId, input.documentId),
  orderBy: asc(blocks.position),
  limit: 30,
});

await redis.setex(cacheKey, 60, blocks);

return blocks;
```

这样在用户频繁打开同一文档时, 后端可以直接从 Redis 返回首屏 Block, 避免每次都访问数据库并进行排序。

### 4. Block 分页加载设计

Block 分页的目标是让首屏渲染成本与文档总大小解耦, 保证大文档的可用性。

#### 4.1 API 设计

在 Block 查询接口中增加分页参数, 建议使用基于游标的分页:

```typescript
interface GetBlocksInput {
  documentId: string;
  cursor?: number;
  limit?: number;
}
```

后端查询示例:

```typescript
const limit = input.limit ?? 30;

const rows = await db.query.blocks.findMany({
  where: eq(blocks.documentId, input.documentId),
  orderBy: asc(blocks.position),
  limit,
  offset: input.cursor ?? 0,
});
```

前端使用方式:
- 初次打开文档时仅请求 `{ documentId, cursor: 0, limit: 30 }`, 渲染首屏内容。
- 监听滚动或用户交互, 在需要时请求下一页 `{ cursor: 30 }`, 依次追加到本地 Block 树。
- 可以结合 Yjs 或本地状态对 Block 列表进行增量更新。

#### 4.2 Redis 与分页的组合

推荐策略:
- 只为第 1 页 Block 开启 Redis 缓存, 后续页直接查数据库。
- 若文档体量极大并且访问非常频繁, 可以按页缓存前几页:
  - `blocks:${documentId}:page:1`
  - `blocks:${documentId}:page:2`
  - `blocks:${documentId}:page:3`

这样既能显著降低 TTFB, 又不会在 Redis 中存放过多冷数据。

### 5. 缓存失效与一致性策略

任何会改变文档结构或内容的写操作, 都需要同步清理相关缓存 key。

典型场景:
- 文档标题、权限、元信息更新。
- Block 内容更新。
- Block 新增或删除。
- Block 位置调整。

失效策略示例:

```typescript
await redis.del(`doc:${documentId}`);
await redis.del(`blocks:${documentId}:page:1`);
```

如果为多页 Block 启用了缓存, 可以使用模式匹配或在业务代码中维护需要删除的 key 列表。

### 6. 预期效果与监控建议

预期效果:
- 首次打开某个大文档: 仍然需要访问数据库, 但配合索引和分页, 延迟显著降低。
- 随后 30～60 秒内再次打开同一文档: TTFB 下降到 100ms 左右, 主要耗时来自网络和 JSON 解码。

监控建议:
- 在文档读取和 Block 查询接口中记录耗时日志, 对比开启 Redis 前后的请求分布。
- 对慢查询增加简单的统计, 定期审查是否需要扩展缓存范围或调整 TTL。

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
