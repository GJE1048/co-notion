# 实时协同编辑模块

## 概述

实时协同编辑模块是平台的核心功能之一，基于 WebSocket 实现多用户并发编辑，采用 CRDT (Conflict-free Replicated Data Types) 算法保证操作一致性，提供在线状态、光标位置等实时可视化反馈。

## 技术实现

### 核心技术栈

- **实时通信**: Socket.io
- **协作算法**: Yjs (CRDT 实现)
- **富文本编辑器**: Slate.js + Yjs 绑定
- **状态同步**: WebSocket + Operational Transformation

### 数据结构设计

```typescript
interface DocumentState {
  id: string;
  version: number;
  content: Y.XmlFragment;
  cursors: Map<string, CursorPosition>;
  selections: Map<string, SelectionRange>;
}

interface CursorPosition {
  userId: string;
  position: number;
  color: string;
  timestamp: number;
}

interface Operation {
  type: 'insert' | 'delete' | 'update';
  position: number;
  content?: string;
  userId: string;
  timestamp: number;
  version: number;
}
```

## 核心功能

### 1. 多用户并发编辑

**实现机制**:
- 每个用户连接到 WebSocket 房间 (以文档ID为房间标识)
- 本地编辑操作通过 Yjs 转换为 CRDT 操作
- 操作通过 WebSocket 广播给其他协作者
- 接收到的操作在本地应用，保持状态一致性

**代码示例**:
```typescript
// 初始化 Yjs 文档
const ydoc = new Y.Doc();
const ytext = ydoc.getText('content');

// 连接 WebSocket
const socket = io('/document/' + documentId);

// 监听远程操作
socket.on('operation', (operation) => {
  Y.applyUpdate(ydoc, operation.data);
});

// 发送本地操作
ytext.observe(() => {
  const update = Y.encodeStateAsUpdate(ydoc);
  socket.emit('operation', { data: update });
});
```

### 2. 冲突解决机制

**CRDT 算法优势**:
- **强一致性**: 保证所有副本最终一致
- **无中心化**: 不依赖中央服务器决策
- **离线支持**: 支持离线编辑后同步
- **操作可交换**: 操作顺序不影响最终结果

**冲突类型及解决**:
- **插入冲突**: 基于位置向量自动解决
- **删除冲突**: 基于 Lamport 时钟解决
- **格式冲突**: 采用最后写入者获胜策略

### 3. 实时可视化反馈

**光标显示**:
- 每个用户的光标位置实时同步
- 不同用户使用不同颜色标识
- 显示用户名标签和在线状态

**选择范围**:
- 高亮显示其他用户的选择区域
- 透明度区分，避免遮挡内容

**状态指示器**:
- 在线用户列表
- 正在编辑状态提示
- 保存状态指示

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
