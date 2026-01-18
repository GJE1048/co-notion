## WordPress 快速发布与自动建站能力设计

### 1. 功能概述

目标：在文档编辑完成后，提供「一键发布到外部站点」能力，第一期支持 WordPress。

- 支持场景：
  - 从当前文档内容生成文章（标题 + 正文），发布到指定 WordPress 站点
  - 支持选择发布状态（草稿 / 已发布）
  - 支持绑定多个 WordPress 站点并复用
- 不支持 / 注意事项：
  - **不能**仅凭「用户输入任意 WordPress 网站 URL」就“自动建站”
    - WordPress REST API 只能操作**已有**站点
    - 真正的“自动建站”需要对应云服务（如 WordPress.com、托管服务商）提供**站点创建 API**，本项目可以预留集成点，但无法对任意独立部署的 WordPress 做到自动建站
  - 不做主题 / 插件层面的自动配置，只负责内容层面的创建文章

后续扩展方向：

- 支持更多平台（Notion、Ghost、Hashnode、知乎草稿等）
- 支持批量发布 / 定时发布
- 支持将回链（canonical URL）写回当前文档 metadata

---

### 2. 能力与限制：关于「自动建站」

#### 2.1 能不能通过 WordPress 接口自动建站？

通用结论：**直接对用户填写的 wordpress 网站 URL，通常做不到自动建站**，原因：

- 常见自建站点（宝塔 / VPS 上装的 WordPress）：
  - WordPress 核心只内置内容管理 API（Posts、Pages、Users 等）
  - 站点本身是通过安装向导 + 数据库配置完成的，没有公开的「创建新站点」REST API
- WordPress.com 或托管服务：
  - 少数平台提供站点创建 API，但都是**平台级 OAuth + 自己的 API 规范**
  - 需要单独协议、申请 client id / secret，本项目可以接入，但属于**特定平台适配**

因此，本设计中的“自动建站”定义为：

- 在**已存在的 WordPress 账户 / 站点体系**之上，调用平台 API 帮用户创建新的「站点实例」；
- 需要针对不同平台开发独立的 Provider，例如：
  - `WordPressDotComProvider`
  - 某云厂商的「WordPress 一键部署」API Provider

第一期只做**「对已有 WordPress 站点自动发文」**，在接口设计中预留 `provider` / `siteId` 等字段，为后续自动建站扩展留坑。

---

### 3. 路由与模块规划

#### 3.1 前端路由（App Router）

新建页面路由示例（仅规划，不一定全部实现）：

- `/publish`：发布中心总览（列出已绑定的站点、发布历史）
- `/publish/wordpress`：WordPress 发布配置与测试页面
- 文档编辑页内使用**侧边栏 / 弹窗组件**（而不是单独路由）：
  - 在 `/documents/[id]` 页内增加「发布」按钮
  - 打开 `PublishToWordpressDialog` 组件完成配置与发布

组件规划（位于 `modules/documents/ui/components/`）：

- `PublishButton`：文档页面右上角 / 工具栏上的「发布」入口
- `PublishToWordpressDialog`：
  - 选择 / 新增 WordPress 站点
  - 显示将要发布的标题 / 预览
  - 提交后调用后端 API

#### 3.2 后端 API / tRPC 规划

在 `modules/documents/server/procedures.ts` 中新增一个 Router 或 Procedure：

- `documentsRouter.publishToWordpress`（tRPC mutation）
  - 输入：
    - `documentId: string`
    - `target`：`{ type: "wordpress"; siteId: string }`
    - `options`：
      - `status: "draft" | "publish"`
      - `slug?: string`
      - `categories?: string[]`
      - `tags?: string[]`
  - 输出：
    - `remotePostId: string`
    - `remoteUrl?: string`
    - `status: "success" | "partial" | "failed"`

后续可以做一个通用的 `publishRouter`，把 WordPress / 其他平台抽象成 Provider。

---

### 4. WordPress 集成设计

#### 4.1 与 WordPress 的通信方式

优先采用 **WordPress REST API + Application Password / Token**：

- 典型 URL：
  - `https://example.com/wp-json/wp/v2/posts`
- 身份验证方式（可配置多种）：
  1. **Application Password（推荐，自托管站点）**
     - WordPress 5.6+ 内置
     - 用户在 WordPress 后台生成「应用密码」，在本系统中录入：
       - `siteUrl`: `https://example.com`
       - `username`: `editor_user`
       - `applicationPassword`: `xxxx xxxx xxxx xxxx`
     - 在后端请求时使用 Basic Auth：`Authorization: Basic base64(username:applicationPassword)`
  2. **JWT Authentication 插件**
     - 需要站点安装 JWT 插件
     - 登录获取 `accessToken`，后续用 `Authorization: Bearer <token>`
  3. **WordPress.com / 其他托管平台**
     - 独立的 OAuth 流程，后续扩展

由于安全原因：

- 不在前端直接调用 WordPress API
- 不在浏览器保存明文密码 / token（统一存在后端数据库，使用加密列或 KMS）

#### 4.2 站点配置模型

新增数据表（仅设计）：

- `wordpress_sites`
  - `id` (uuid)
  - `ownerId` (用户 id / workspace id)
  - `siteUrl` (string)
  - `displayName` (string)
  - `authType` (`"application_password" | "jwt" | "wordpress_com" | ...`)
  - `username` (string, 可选)
  - `credential` (加密存储的 JSON，包含 application password / token 等)
  - `createdAt`, `updatedAt`

后端通过 ownerId + siteId 校验权限，防止越权使用他人配置。

#### 4.3 发布流程

1. 前端在文档页内点击「发布到 WordPress」
2. 打开 `PublishToWordpressDialog`：
   - 从后端拉取当前用户可用的 `wordpress_sites` 列表
   - 选择站点 + 发布选项（状态 / 分类 / 标签）
3. 调用 tRPC `documents.publishToWordpress`：
   - 服务端根据 `documentId` 读取文档内容（blocks + title）
   - 通过已有的 Block → HTML/Markdown 转换函数生成 `content`
4. 服务端构造 WordPress REST 请求：

   ```ts
   POST {siteUrl}/wp-json/wp/v2/posts
   Authorization: Basic ...

   {
     title: "...",
     content: "<p>...</p>",
     status: "draft" | "publish",
     slug: "...",
     categories: [...],
     tags: [...]
   }
   ```

5. 保存发布结果：
   - 成功：返回 `remotePostId`、`link`，并可将这些信息写入当前文档 metadata：
     - `metadata.externalPosts.wordpress = [{ siteId, postId, url, status }]`
   - 失败：记录错误详情（`errorCode`, `errorMessage`, `requestId`），用于问题排查

---

### 5. 与现有文档系统的集成

#### 5.1 内容抽取与格式转换

内容来源：当前文档的 Blocks（已在 `DocumentEditor` / `blocks` 模块中定义）。

- 标题：使用文档标题 `document.title`
- 正文生成策略：
  - 遍历 Blocks，按 `position` 排序
  - 将不同类型 Block 映射为 HTML：
    - `heading_1/2/3` → `<h1> / <h2> / <h3>`
    - `paragraph` → `<p>`
    - `list` → `<ul><li>...</li></ul>`
    - `todo` → `<ul class="todo-list">...`
    - `code` → `<pre><code class="language-xxx">...</code></pre>`
    - 其他暂时按 `<p>` 处理或忽略
- 转换函数建议单独抽象到 `modules/documents/server/export.ts`：
  - `exportDocumentToHtml(documentId: string): Promise<{ title: string; html: string }>`

这样除了 WordPress，将来其他平台（如静态网站导出）也能复用。

#### 5.2 权限校验

调用 `publishToWordpress` 时需要：

- 调用者对 `documentId` 拥有「编辑权限」或更高（沿用 `canEditDocumentFromAccess`）
- 调用者对 `siteId` 拥有使用权限（`wordpress_sites.ownerId === ctx.user.id`）

---

### 6. 自动建站扩展设计（预留）

虽然第一期不做，但为未来的“自动建站”预留接口：

#### 6.1 抽象 Provider 接口

```ts
interface SiteProvisionProvider {
  createSite(params: {
    ownerId: string;
    plan?: string;
    template?: string;
  }): Promise<{
    siteId: string;
    siteUrl: string;
    adminUrl?: string;
  }>;
}
```

针对不同平台实现不同 Provider，例如：

- `WordPressComProvisionProvider`
- `SomeCloudWordPressProvisionProvider`

#### 6.2 流程示意

1. 用户在本系统内选择「使用 WordPress.com 自动创建站点」
2. 跳转到 WordPress.com OAuth 授权并返回 `accessToken`
3. 调用 WordPress.com 的站点创建 API：
   - 传入站点名称、域名（子域）、计划等
4. 成功后在本系统中：
   - 记录 `wordpress_sites`（站点 URL + 凭证）
   - 可立即调用「发布到 WordPress」流程发布当前文档

> 注意：这部分完全取决于目标托管平台是否提供公开 API，本项目只能在有能力的前提下集成。

---

### 7. 前端交互草图

**文档编辑页右上角按钮：**

- 「保存」右侧新增 `发布` 下拉按钮：
  - 点击主按钮：默认发布到最近一次使用的站点
  - 点击下拉：选择「发布到 WordPress」「发布到其他平台」

**发布弹窗字段：**

- 站点选择：`select`（从 `wordpress_sites` 获取）
- 标题（可编辑，默认使用文档标题）
- 发布状态：`草稿 / 立即发布`
- 分类 / 标签（可选）
- 预览区：简要展示转换后的 HTML（或 Markdown）

---

### 8. 安全与合规

- 所有与 WordPress 交互都在后端完成，避免暴露凭证
- 站点凭证存储：
  - 使用数据库加密列或者在应用层进行加密
  - 不在日志中打印完整的 URL + 带凭证的 header
- 失败重试：
  - tRPC 层返回明确错误码（如 `WORDPRESS_AUTH_FAILED`, `WORDPRESS_VALIDATION_ERROR`）
  - 前端 toast 提示友好信息，并在开发模式下打印详细错误

---

### 9. 开发拆分建议

1. 后端基础设施
   - 抽象 WordPress HTTP client（支持 Application Password）
   - 添加 `wordpress_sites` 数据模型与 CRUD API（内部用）
2. 文档导出能力
   - 实现 `exportDocumentToHtml`，基于现有 Blocks
3. `publishToWordpress` tRPC 实现
   - 权限校验、调用 WordPress API、错误处理
4. 前端 UI
   - 文档页发布按钮 + 弹窗
   - 简单发布历史（可后置）
5. 自动建站 Provider 预研
   - 调研目标托管平台是否提供站点创建 API
   - 设计 Provider 接口与配置结构

