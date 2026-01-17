# 实时协同编辑模块

## 概述

实时协同编辑模块围绕「Block 结构 + Yjs」设计，目标是实现类似 Notion 的多人实时协作：

- 每个 Block 是独立的协同单元，拥有稳定 ID 和类型
- 多人可以同时编辑不同 Block，甚至同一个 Block
- 自动冲突解决、离线编辑与在线同步
- 支持光标和选区同步、在线状态展示

当前代码基于「操作日志 + WebSocket」实现增量同步，本模块文档在此基础上给出引入 Yjs 的完整方案。

## 技术实现

### 核心技术栈

- **协作算法**: Yjs（CRDT 实现）
- **实时通信**: 原生 WebSocket（服务端使用 `ws`，客户端使用 `WebSocket` API）
- **文档模型**: Block 列表 + Block 内容
- **状态同步**:
  - Block 列表与元信息：使用 `Y.Array<Y.Map>`
  - Block 文本内容：使用 `Y.Text` 或 `Y.XmlFragment`
  - 在线状态与光标：使用 Yjs Awareness 协议

### 数据结构设计：Block + Yjs

在 Yjs 中，为每个文档创建一个 `Y.Doc`，并在其中维护一个 Block 列表：

```ts
// 协同文档
const ydoc = new Y.Doc();

// Block 列表，保持顺序
const yBlocks = ydoc.getArray<Y.Map<unknown>>("blocks");

// Block 的通用结构
interface BlockSnapshot {
  id: string;
  type: "paragraph" | "heading" | "todo" | "code" | string;
  props: Record<string, unknown>;
  contentType: "text" | "richtext" | "none";
  children?: string[];
}

// 创建一个段落 Block
const yBlock = new Y.Map<unknown>();
yBlock.set("id", "blk_1");
yBlock.set("type", "paragraph");
yBlock.set("props", {});
yBlock.set("contentType", "text");
yBlock.set("content", new Y.Text("Hello world"));

yBlocks.push([yBlock]);
```

数据库中的 `blocks` 表仍然存在，负责：

- 存储 Block 的持久快照（便于查询和权限控制）
- 作为 Yjs 状态的初始快照来源
- 在需要时用于索引和统计（例如「查找所有待办项」）

## 核心功能

### 1. 多用户并发编辑

**房间模型**:
- 每个文档对应一个协同房间（documentId）
- 客户端通过 WebSocket 连接到对应房间，并加入 Yjs 文档

**客户端集成（示意）**:

```ts
// hooks/useYjsBlocksCollab.ts
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useEffect, useState } from "react";

type BlockView = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content: string;
};

export function useYjsBlocksCollab(documentId: string) {
  const [blocks, setBlocks] = useState<BlockView[]>([]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(
      "ws://localhost:1234", // Yjs WebSocket 服务地址
      documentId,
      ydoc
    );

    const yBlocks = ydoc.getArray<Y.Map<unknown>>("blocks");

    const updateBlocks = () => {
      const snapshots = yBlocks.toArray().map((yb) => {
        const content = yb.get("content");
        return {
          id: yb.get("id") as string,
          type: (yb.get("type") as string) ?? "paragraph",
          props: (yb.get("props") as Record<string, unknown>) ?? {},
          content: content instanceof Y.Text ? content.toString() : "",
        };
      });
      setBlocks(snapshots);
    };

    yBlocks.observe(updateBlocks);
    updateBlocks();

    return () => {
      yBlocks.unobserve(updateBlocks);
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId]);

  return { blocks };
}
```

Block 组件在编辑时，不再直接调用后端 API，而是直接修改对应的 Yjs 节点：

```ts
function updateBlockContent(yBlock: Y.Map<unknown>, text: string) {
  const yContent = yBlock.get("content");
  if (yContent instanceof Y.Text) {
    yContent.delete(0, yContent.length);
    yContent.insert(0, text);
  }
}
```

所有变更通过 Yjs 自动广播到其他协作者。

### 2. 冲突解决机制

**CRDT（Yjs）带来的能力**:
- 无需手写 OT 算法，所有并发写入自动合并
- 支持离线编辑，恢复网络后自动同步
- 操作顺序无关性，保证最终一致性

在本系统中：
- Block 顺序冲突由 `Y.Array` 层解决（插入/删除同一位置）
- Block 内容冲突由 `Y.Text` / `Y.XmlFragment` 解决
- Block 属性冲突由 `Y.Map` 字段级 CRDT 解决

### 3. 实时可视化反馈

**在线状态与光标**:

- 使用 Yjs Awareness 维护每个用户的 presence 信息
- 在本地设置当前用户状态：

```ts
const awareness = provider.awareness;

awareness.setLocalState({
  user: {
    id: currentUser.id,
    name: currentUser.username,
    color: "#ff0000",
  },
  cursor: {
    anchor: 5,
    head: 10,
    blockId: "blk_1",
  },
});
```

- 监听其他用户状态变化：

```ts
awareness.on("change", () => {
  const states = awareness.getStates();
  // 根据 states 渲染其他用户的光标和选区
});
```

**与现有在线状态模块的关系**:

- 现有的 `/scripts/ws-server.ts` 已实现：
  - 文档房间内的在线用户列表
  - `presence` 消息广播
- 引入 Yjs 后，可以逐步将在线状态统一到 Awareness 上，前端仍通过 WebSocket 获取在线用户信息，但数据来源改为 Yjs Provider。

### 4. 性能优化

**操作压缩**:
- 批量处理连续操作
- 压缩重复操作序列
- 智能合并相似操作

**网络优化**:
- WebSocket 连接复用
- 二进制数据传输
- 自适应心跳检测

**内存管理**:
- 定期清理历史操作
- 垃圾回收机制
- 内存使用监控

## API 接口设计

### WebSocket 事件

```typescript
// 加入文档编辑
socket.emit('join-document', { documentId, userId });

// 离开文档编辑
socket.emit('leave-document', { documentId, userId });

// 发送操作
socket.emit('operation', {
  documentId,
  operation: OperationData,
  version: number
});

// 接收操作
socket.on('operation', (data: { operation: OperationData, userId: string }));

// 用户状态更新
socket.on('user-status', (users: UserStatus[]));

// 文档锁定
socket.emit('lock-document', { documentId, reason: string });
```

### RESTful API

```typescript
// 获取文档当前状态
GET /api/documents/:id/state

// 获取文档版本历史
GET /api/documents/:id/versions

// 恢复到指定版本
POST /api/documents/:id/restore
```

## 安全考虑

### 操作验证
- 验证用户编辑权限
- 检查操作合法性
- 防止恶意操作注入

### 速率限制
- 限制单个用户的操作频率
- 防止 DoS 攻击
- 智能降级处理

### 数据加密
- WebSocket 连接使用 WSS
- 操作数据加密传输
- 敏感信息保护

## 监控与调试

### 性能指标
- 操作延迟统计
- 同步成功率
- 内存使用情况
- 连接稳定性

### 日志记录
- 操作审计日志
- 错误异常记录
- 性能监控日志

### 调试工具
- 开发模式下的操作追踪
- 状态同步调试面板
- 网络请求监控
