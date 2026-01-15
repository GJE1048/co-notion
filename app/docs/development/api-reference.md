# API 参考文档

## 概述

本文档描述了智能化多人文档编辑平台的 RESTful API 接口。所有 API 接口都遵循 REST 设计原则，使用 JSON 作为数据交换格式。

## 基础信息

- **Base URL**: `https://api.document-platform.com/v1`
- **认证方式**: Bearer Token (JWT)
- **数据格式**: JSON
- **字符编码**: UTF-8
- **API 版本**: v1

## 认证

### 获取访问令牌

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "displayName": "John Doe"
    }
  }
}
```

### 刷新访问令牌

```http
POST /auth/refresh
Authorization: Bearer <refresh_token>
```

### 使用访问令牌

在所有需要认证的请求中包含 Authorization 头:

```http
Authorization: Bearer <access_token>
```

## 用户管理 API

### 获取用户信息

```http
GET /users/:userId
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "displayName": "John Doe",
    "avatar": "https://example.com/avatar.jpg",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "preferences": {
      "theme": "dark",
      "language": "zh-CN"
    }
  }
}
```

### 更新用户信息

```http
PUT /users/:userId
Content-Type: application/json

{
  "displayName": "新名称",
  "preferences": {
    "theme": "light"
  }
}
```

### 注册用户

```http
POST /users/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "displayName": "用户名"
}
```

## 文档管理 API

### 创建文档

```http
POST /documents
Content-Type: application/json

{
  "title": "文档标题",
  "content": "文档内容",
  "folderId": "folder_123",
  "tags": ["标签1", "标签2"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "doc_123",
    "title": "文档标题",
    "content": "文档内容",
    "ownerId": "user_123",
    "folderId": "folder_123",
    "tags": ["标签1", "标签2"],
    "version": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### 获取文档

```http
GET /documents/:documentId
```

**查询参数**:
- `version` (可选): 指定版本号

### 更新文档

```http
PUT /documents/:documentId
Content-Type: application/json

{
  "title": "新标题",
  "content": "新内容",
  "tags": ["新标签"]
}
```

### 删除文档

```http
DELETE /documents/:documentId
```

### 获取文档列表

```http
GET /documents
```

**查询参数**:
- `folderId` (可选): 文件夹ID
- `ownerId` (可选): 所有者ID
- `tags` (可选): 标签数组
- `search` (可选): 搜索关键词
- `page` (可选): 页码，默认为1
- `limit` (可选): 每页数量，默认为20
- `sortBy` (可选): 排序字段，默认为 updatedAt
- `sortOrder` (可选): 排序顺序，asc 或 desc

**响应**:
```json
{
  "success": true,
  "data": {
    "documents": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

## 文件夹管理 API

### 创建文件夹

```http
POST /folders
Content-Type: application/json

{
  "name": "文件夹名称",
  "parentId": "parent_folder_id"
}
```

### 获取文件夹内容

```http
GET /folders/:folderId/contents
```

**响应**:
```json
{
  "success": true,
  "data": {
    "folder": {
      "id": "folder_123",
      "name": "文件夹名称",
      "parentId": null,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "subfolders": [...],
    "documents": [...]
  }
}
```

### 更新文件夹

```http
PUT /folders/:folderId
Content-Type: application/json

{
  "name": "新文件夹名称"
}
```

### 删除文件夹

```http
DELETE /folders/:folderId
```

## 权限管理 API

### 获取用户权限

```http
GET /permissions
```

**查询参数**:
- `userId` (可选): 用户ID
- `resourceId` (可选): 资源ID
- `resourceType` (可选): 资源类型 (document/folder)

### 授予权限

```http
POST /permissions
Content-Type: application/json

{
  "userId": "user_123",
  "resourceId": "doc_456",
  "resourceType": "document",
  "level": 3,
  "reason": "项目协作需要"
}
```

**权限级别**:
- 1: 查看者
- 2: 评论者
- 3: 编辑者
- 4: 管理员
- 5: 所有者

### 撤销权限

```http
DELETE /permissions/:permissionId
```

### 权限历史

```http
GET /permissions/:resourceId/history
```

## AI 智能写作 API

### 文本续写

```http
POST /ai/continue
Content-Type: application/json

{
  "text": "选中的文本内容",
  "context": "文档上下文",
  "style": "正式",
  "length": "medium"
}
```

**参数说明**:
- `text`: 要续写的文本
- `context`: 文档上下文 (可选)
- `style`: 写作风格 (正式/轻松/学术等)
- `length`: 输出长度 (short/medium/long)

### 文本润色

```http
POST /ai/polish
Content-Type: application/json

{
  "text": "待润色的文本",
  "style": "正式",
  "focus": "grammar" // grammar/style/structure
}
```

### 翻译文本

```http
POST /ai/translate
Content-Type: application/json

{
  "text": "待翻译的文本",
  "from": "zh-CN",
  "to": "en-US",
  "domain": "general" // general/technical/literary
}
```

### 生成摘要

```http
POST /ai/summarize
Content-Type: application/json

{
  "text": "待摘要的文本",
  "ratio": 0.3, // 摘要比例
  "type": "extractive" // extractive/generative
}
```

### 智能问答

```http
POST /ai/ask
Content-Type: application/json

{
  "question": "用户问题",
  "context": "相关文档内容",
  "documentId": "doc_123"
}
```

## 实时协作 API

### WebSocket 连接

**连接地址**: `wss://api.document-platform.com/ws`

**身份验证**:
```javascript
const socket = io('wss://api.document-platform.com/ws', {
  auth: {
    token: 'jwt_token_here'
  }
});
```

### 加入文档编辑

```javascript
socket.emit('join-document', {
  documentId: 'doc_123'
});
```

### 发送操作

```javascript
socket.emit('operation', {
  documentId: 'doc_123',
  operation: {
    type: 'insert',
    position: 10,
    content: '新内容',
    version: 5
  }
});
```

### 接收操作

```javascript
socket.on('operation', (data) => {
  console.log('收到操作:', data.operation);
  // 应用操作到本地文档
});
```

### 用户状态更新

```javascript
socket.on('user-status', (users) => {
  console.log('在线用户:', users);
});
```

## 搜索 API

### 全文搜索

```http
GET /search
```

**查询参数**:
- `q`: 搜索关键词 (必需)
- `type`: 搜索类型 (all/documents/folders/users)
- `filters`: 搜索过滤器 (JSON字符串)

**示例**:
```http
GET /search?q=项目管理&type=documents&filters={"tags":["重要"]}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "doc_123",
        "type": "document",
        "title": "项目管理文档",
        "snippet": "...项目管理...",
        "score": 0.95,
        "metadata": {
          "updatedAt": "2024-01-01T00:00:00Z",
          "owner": "John Doe"
        }
      }
    ],
    "total": 1,
    "took": 15 // 搜索耗时(ms)
  }
}
```

### 智能搜索建议

```http
GET /search/suggestions
```

**查询参数**:
- `q`: 输入的关键词前缀
- `limit`: 建议数量，默认为5

## 文件上传 API

### 上传文件

```http
POST /upload
Content-Type: multipart/form-data

# FormData:
# file: File对象
# folderId: string (可选)
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "file_123",
    "filename": "document.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "url": "https://cdn.example.com/files/file_123.pdf",
    "uploadedAt": "2024-01-01T00:00:00Z"
  }
}
```

### 获取文件信息

```http
GET /files/:fileId
```

### 删除文件

```http
DELETE /files/:fileId
```

## 通知 API

### 获取通知列表

```http
GET /notifications
```

**查询参数**:
- `status`: 通知状态 (unread/read/all)
- `page`: 页码
- `limit`: 每页数量

### 标记通知为已读

```http
PUT /notifications/:notificationId/read
```

### 批量标记已读

```http
PUT /notifications/read
Content-Type: application/json

{
  "notificationIds": ["notif_1", "notif_2"]
}
```

## 系统状态 API

### 健康检查

```http
GET /health
```

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00Z",
    "services": {
      "database": "healthy",
      "redis": "healthy",
      "websocket": "healthy"
    }
  }
}
```

### 系统信息

```http
GET /system/info
```

**响应**:
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "environment": "production",
    "uptime": 86400,
    "memory": {
      "used": 256,
      "total": 1024,
      "unit": "MB"
    }
  }
}
```

## 错误处理

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入数据无效",
    "details": {
      "field": "email",
      "reason": "邮箱格式不正确"
    },
    "requestId": "req_123456",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 常见错误码

- `VALIDATION_ERROR`: 输入验证失败
- `AUTHENTICATION_ERROR`: 认证失败
- `AUTHORIZATION_ERROR`: 权限不足
- `NOT_FOUND`: 资源不存在
- `CONFLICT`: 资源冲突
- `RATE_LIMIT_EXCEEDED`: 请求频率超限
- `INTERNAL_ERROR`: 服务器内部错误

## 速率限制

- **认证接口**: 5 次/分钟/IP
- **一般API**: 100 次/分钟/用户
- **AI接口**: 20 次/分钟/用户
- **文件上传**: 10 次/分钟/用户

超出限制时返回 HTTP 429 状态码。

## 分页

支持分页的接口使用以下参数:

- `page`: 页码 (从1开始)
- `limit`: 每页项目数 (最大100)

响应中包含分页信息:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## SDK 和客户端库

### JavaScript SDK

```javascript
import { DocumentPlatform } from '@document-platform/sdk';

const client = new DocumentPlatform({
  baseURL: 'https://api.document-platform.com/v1',
  token: 'your_jwt_token'
});

// 获取文档列表
const documents = await client.documents.list();

// 创建文档
const document = await client.documents.create({
  title: '新文档',
  content: '文档内容'
});
```

### 其他语言支持

- Python SDK: `pip install document-platform`
- Java SDK: Maven 依赖
- Go SDK: `go get github.com/document-platform/go-sdk`

详细的 SDK 文档请参考 [SDK 文档](https://docs.document-platform.com/sdk)。

---

本 API 文档会随着平台的发展不断更新。如有疑问，请联系开发团队或查看 [GitHub Issues](https://github.com/your-org/document-platform/issues)。
