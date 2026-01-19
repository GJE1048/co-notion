## WordPress 发布集成与自动建站能力设计

### 1. 功能概述

目标：在文档编辑完成后，提供「一键发布到外部站点」能力，第一期优先支持连接用户已有的 WordPress 站点。

- **核心场景**：
  - 用户连接自己已有的 WordPress 站点（自托管或托管均可）。
  - 从当前文档内容生成文章（标题 + 正文），发布到指定 WordPress 站点。
  - 支持选择发布状态（草稿 / 已发布）。
  - 支持绑定多个 WordPress 站点并复用。

- **关于“自动建站”**：
  - 第一期主要聚焦于**连接已有站点**。
  - “自动建站”（即通过 API 创建全新的 WordPress 实例）仅在特定云服务商（如 WordPress.com）提供支持时作为扩展功能，不作为核心路径。

后续扩展方向：
- 支持更多平台（Notion、Ghost、Hashnode、知乎草稿等）。
- 支持批量发布 / 定时发布。
- 支持将回链（canonical URL）写回当前文档 metadata。

---

### 2. 连接方案设计

为了兼顾自托管站点和托管平台（如 WordPress.com），采用两种集成方案。

#### 方案一：Application Passwords + WP REST API（推荐，通用性最强）

适用于所有支持 Application Passwords 的 WordPress 站点（WordPress 5.6+ 内置支持）。这是目前最通用、且符合官方推荐的安全集成方式。

**流程概览：**
1. 用户在自己的 WordPress 后台生成一个 **Application Password**。
2. 用户在本应用中输入：
   - **站点地址**（如 `https://example.com`）
   - **用户名**
   - **Application Password**
3. 本应用后端验证凭据有效性，并加密存储。
4. 后续发布时，后端代理请求，使用 HTTP Basic Auth 调用 WP REST API。

**优点**：
- 无需在 WordPress 安装特定插件（核心功能内置）。
- 适用于绝大多数自托管站点。
- 相比 OAuth2 Server 插件配置更简单。

#### 方案二：WordPress.com OAuth 2.0（可选，针对托管站点）

适用于 WordPress.com 托管站点或启用了 Jetpack 的自托管站点。

**流程概览：**
1. 用户点击“连接 WordPress.com”。
2. 跳转到 WordPress.com 授权页面。
3. 用户授权后，本应用获取 `accessToken`。
4. 本应用使用 Token 调用 WordPress.com API。

**优点**：
- 用户体验更流畅（无需手动复制粘贴密码）。
- 统一的 Token 管理。

---

### 3. 安全架构设计（关键）

Application Password 本质上具有用户账户的完整权限，**绝对严禁**明文暴露。必须严格遵循以下安全架构：

#### 3.1 核心原则
1. **前端不持久化凭据**：前端只负责收集用户输入，通过 HTTPS 传输给后端，绝不保存在 LocalStorage/SessionStorage 中。
2. **后端代理所有请求**：前端不直接调用用户 WordPress 站点 API，所有操作通过本应用后端中转。
3. **加密存储**：后端数据库中存储的凭据必须经过高强度加密（AES-256-GCM 或 KMS）。

#### 3.2 数据流向与安全措施

| 阶段 | 动作 | 安全措施 |
| :--- | :--- | :--- |
| **连接时** | 用户输入 URL/用户/密码 | 全程 HTTPS 传输；前端不缓存。 |
| **验证时** | 后端尝试调用 `/wp-json/wp/v2/users/me` | 验证凭据有效性；验证成功后立即加密。 |
| **存储时** | 存入 `wordpress_sites` 表 | 仅存储加密后的密文（`encrypted_credential`），密钥由服务端安全管理。 |
| **使用时** | 用户发起发布请求 | 前端仅传递 `siteId`；后端解密凭据，构造 Basic Auth Header，代理发送请求。 |
| **断开时** | 用户删除绑定 | 后端彻底删除数据库中的凭据记录。 |

---

### 4. 路由与模块规划

#### 4.1 前端路由（App Router）

- 文档编辑页内使用**侧边栏 / 弹窗组件**：
  - 在 `/documents/[id]` 页内增加「发布」按钮。
  - 打开 `PublishToWordpressDialog` 组件完成配置与发布。

组件规划（位于 `modules/documents/ui/components/`）：
- `PublishButton`：入口。
- `PublishToWordpressDialog`：
  - **站点管理 Tab**：列表展示已绑定站点，提供“添加站点”入口。
  - **发布配置 Tab**：选择站点、设置标题、状态、分类。

#### 4.2 后端 API / tRPC 规划

在 `modules/documents/server/procedures.ts` 中新增：

- `documentsRouter.connectWordpress` (Mutation)
  - 输入：`{ siteUrl, username, applicationPassword }` 或 OAuth Code。
  - 逻辑：验证连接 -> 加密凭据 -> 存入数据库。
- `documentsRouter.publishToWordpress` (Mutation)
  - 输入：`{ documentId, siteId, options: { status, slug, categories... } }`
  - 逻辑：校验权限 -> 读取文档 -> 转换 HTML -> 解密凭据 -> 调用 WP API -> 返回结果。

---

### 5. 数据库模型设计

新增 `wordpress_sites` 表：

```prisma
model WordpressSite {
  id          String   @id @default(uuid())
  ownerId     String   // 关联用户或工作区
  
  // 站点基本信息
  siteUrl     String
  name        String?  // 用户自定义名称或自动获取的站点标题
  
  // 认证信息
  authType    String   // "application_password" | "oauth"
  username    String?  // OAuth 模式下可能为空
  
  // 敏感凭据（加密存储）
  // 存储结构示例：JSON.stringify({ iv: "...", content: "...", authTag: "..." })
  credential  String   @db.Text 
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
}
```

---

### 6. 发布流程详解

1. **前端发起**：
   用户在编辑器点击发布，选择站点 `site-123`，填写标题 "My Post"。
2. **后端处理 (`publishToWordpress`)**：
   - 检查用户是否拥有 `site-123` 的使用权。
   - 从数据库取出 `credential`，使用服务器密钥解密出 `applicationPassword`。
   - 将文档 Blocks 转换为 HTML。
   - 构造目标 URL：`{siteUrl}/wp-json/wp/v2/posts`。
   - 构造 Header：`Authorization: Basic base64(username:password)`。
   - 发送 POST 请求。
3. **结果处理**：
   - 成功：返回文章链接，记录发布历史。
   - 失败：返回错误码（如 401 Auth Failed, 403 Forbidden），提示用户检查凭据或权限。

---

### 7. 开发任务拆解

1. **后端基础设施**
   - 实现加密/解密工具函数（`lib/crypto.ts`）。
   - 创建 `wordpress_sites` 数据表 (Prisma Schema)。
   - 实现 `connectWordpress` procedure (含验证逻辑)。

2. **文档转换引擎**
   - 实现 `exportDocumentToHtml`：将 Block 结构转为符合 WordPress 要求的 HTML。

3. **前端 UI**
   - `ConnectWordpressDialog`：表单输入 URL、用户名、密码。
   - `PublishDialog`：选择站点、配置发布参数。

4. **集成测试**
   - 使用本地 WordPress 或测试站点验证 Application Password 流程。
   - 验证加密存储的安全性（数据库中无明文）。
