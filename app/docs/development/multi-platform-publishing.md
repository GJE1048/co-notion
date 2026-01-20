# 多平台发布策略与 WordPress 文章/页面开发指南

本文档旨在回答关于 WordPress 文章（Posts）与页面（Pages）的区别，如何更好地进行 WordPress 开发，以及关于发布到知乎等第三方平台的可行性分析与实施策略。

## 1. WordPress 文章 (Posts) 与页面 (Pages)

### 1.1 核心区别

在 WordPress 中，`Post` 和 `Page` 是两种最基本的内容类型，它们在数据结构上非常相似，但在用途和功能上有显著区别：

| 特性 | 文章 (Posts) | 页面 (Pages) |
| :--- | :--- | :--- |
| **时效性** | 强，通常按时间倒序排列 | 无，内容通常是静态的、长期的 |
| **分类/标签** | 支持 Categories 和 Tags | 不支持（通常），支持层级关系（父/子页面） |
| **层级结构** | 无（扁平化） | 有（可以有父页面，如关于 -> 团队） |
| **RSS Feed** | 包含在 Feed 中 | 不包含 |
| **用途** | 博客文章、新闻、动态 | 关于我们、联系方式、隐私政策、服务介绍 |
| **API 端点** | `/wp/v2/posts` | `/wp/v2/pages` |

### 1.2 开发建议：如何开发更好？

在开发类似本项目的“文档发布工具”时，为了提供更好的用户体验和灵活性，建议：

1.  **支持类型选择**：
    *   不要将所有文档都默认发布为 `Post`。
    *   在发布对话框中添加一个“发布类型”选项（Post/Page）。
    *   如果是 `Page`，隐藏分类/标签选择器，但可能需要展示“父页面”选择器（高级功能）。

2.  **API 适配**：
    *   后端代码应动态构建 API URL：
        ```typescript
        const endpointType = options.type === 'page' ? 'pages' : 'posts';
        const url = `${apiBaseUrl}/${endpointType}`;
        ```
    *   注意字段差异：`Post` 提交时可以带 `categories`/`tags`，`Page` 提交时带 `parent` (ID)。

3.  **元数据隔离**：
    *   在数据库存储发布记录时，区分 `postId` 和 `pageId`，或者统称为 `remoteId` 但记录 `type`。

---

## 2. 发布到知乎等第三方平台

### 2.1 可行性分析

用户经常询问“WordPress 是否可以发布到知乎”。

*   **现状**：知乎**没有**开放的、面向普通开发者的“文章写入 API”。知乎的 API 主要面向企业合作伙伴或仅限于读取。
*   **WordPress 插件**：市面上存在一些 "WordPress to Zhihu" 插件（如 "Wp to Zhihu"），但它们的原理通常是：
    *   **模拟登录**：要求用户提取浏览器 Cookie。
    *   **不稳定**：知乎接口变动会导致插件失效。
    *   **风险**：账号可能因检测到自动化操作而被封禁。

### 2.2 本项目的开发策略

如果要在本项目（Next.js 应用）中实现发布到知乎，有以下几种路径：

#### 方案 A：浏览器插件辅助（推荐，最安全）
开发一个 Chrome 扩展。当用户在我们的平台上点击“发布到知乎”时：
1.  扩展检测到指令。
2.  扩展打开知乎写文章页面。
3.  扩展通过 DOM 操作将 Markdown/HTML 内容填入编辑器。
4.  用户手动点击“发布”。
*   **优点**：不涉及账号密码/Cookie 传输，无封号风险。
*   **缺点**：体验不是全自动的。

#### 方案 B：Puppeteer / Playwright 模拟（后端）
在后端启动无头浏览器，模拟用户登录（或使用用户提供的 Cookie）并发布。
*   **优点**：全自动。
*   **缺点**：极重，维护成本高，知乎验证码难以处理，法律/合规风险。

#### 方案 C：寻找第三方中间件
使用如类似 Zapier 的自动化工具，或者寻找开源的 Python 脚本封装成微服务。但核心问题依然是知乎的反爬/反自动化机制。

### 2.3 结论

*   **对于 WordPress**：不要依赖 WordPress 插件同步到知乎，体验通常很差。
*   **对于本项目**：建议优先完善 WordPress 的深度集成（支持 Page/Post，支持自定义字段）。对于知乎，建议仅提供“复制 Markdown”或“复制 HTML”功能，让用户一键复制后去知乎粘贴（知乎编辑器对 Markdown 支持尚可）。

---

## 3. 开发链接与参考资源

### WordPress 开发
*   **REST API 手册**: [WordPress REST API Handbook](https://developer.wordpress.org/rest-api/)
    *   Posts Endpoint: [Reference](https://developer.wordpress.org/rest-api/reference/posts/)
    *   Pages Endpoint: [Reference](https://developer.wordpress.org/rest-api/reference/pages/)
*   **Application Passwords**: [官方文档](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)

### 知乎相关（仅供研究）
*   **Zhihu-OAuth** (非官方 Python 库，已多年未更新但可参考思路): [GitHub](https://github.com/7sDream/zhihu-oauth)

---

## 4. 下一步开发计划 (Roadmap)

基于上述分析，建议按照以下顺序迭代代码：

1.  **后端改造**：修改 `publishToWordpress` procedure，接受 `type: 'post' | 'page'` 参数。
2.  **前端改造**：修改 `PublishToWordpressDialog`，增加单选框让用户选择发布类型。
3.  **通用化接口**：重构数据库 schema，将 `wordpressSites` 泛化为 `integration_accounts`，为未来可能支持的 Ghost / Medium 做准备（这些平台有良好的 API）。

