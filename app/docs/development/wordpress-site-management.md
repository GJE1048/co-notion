# WordPress 站点管理功能设计

## 1. 功能概述

本模块旨在提供一个集中的管理界面，让用户可以查看和管理所有已连接的 WordPress 站点，以及查看各站点的发布记录。

### 核心功能
- **站点列表**：展示当前用户绑定的所有 WordPress 站点。
- **站点详情**：查看特定站点的详细信息（URL、用户名、连接状态）。
- **发布记录**：展示通过本平台发布到该站点的文章列表。
- **解除绑定**：允许用户断开与特定站点的连接。
- **快捷发布**：提供从管理界面直接跳转到文档进行发布的入口（可选）。

## 2. 路由设计

### 前端路由
- **主入口**：`/wordpress`
  - 展示站点列表卡片。
  - 如果没有站点，显示引导连接页面。
- **侧边栏集成**：
  - 在应用左侧主侧边栏中添加 "WordPress" 或 "My Sites" 入口。

### 后端 API (tRPC)
基于现有的 `modules/documents/server/procedures.ts` 扩展，或新建 `modules/wordpress/server/procedures.ts`。

需要新增/复用的 Procedure：
- `getSites`: 获取当前用户的站点列表 (已存在或需完善)。
- `getSitePosts`: 获取指定站点已发布的文章列表 (需新增)。
- `disconnectSite`: 删除站点连接 (需新增)。

## 3. UI/UX 设计

### 3.1 侧边栏 (Sidebar)
在 `components/app-sidebar.tsx` (或相应文件) 中添加：
- 图标：使用 `BrandWordPress` 或类似图标。
- 标签：WordPress

### 3.2 站点管理页 (/wordpress)
**布局**：
- 顶部：标题 "WordPress Sites" + "Add New Site" 按钮。
- 内容区：Grid 布局展示站点卡片。

**站点卡片 (SiteCard)**：
- 站点图标/Logo
- 站点名称 (Display Name)
- 站点 URL
- 状态指示 (Connected)
- 操作菜单：
  - Manage (跳转详情)
  - Disconnect (解绑)

### 3.3 站点详情页 (可选，或模态框)
展示该站点最近发布的文章列表：
- 文章标题
- 发布时间
- 状态 (Published/Draft)
- 链接 (点击跳转到 WordPress)

## 4. 数据结构

复用 `wordpress_sites` 表：
- `id`: UUID
- `ownerId`: User UUID
- `siteUrl`: String
- `displayName`: String
- `authType`: "basic" | "oauth"
- `credential`: JSON (Encrypted)

## 5. 开发步骤

1. **文档编写** (Current Step): 确认需求与设计。
2. **路由创建**:
   - 新建 `app/wordpress/page.tsx`。
   - 新建 `app/wordpress/layout.tsx` (可选)。
3. **侧边栏更新**:
   - 找到应用侧边栏配置文件，添加路由链接。
4. **后端接口**:
   - 完善 `getSites` (确保返回必要字段)。
   - 实现 `disconnectSite`。
5. **UI 实现**:
   - 实现 `SiteList` 组件。
   - 实现 `SiteCard` 组件。
   - 集成 `ConnectWordpressDialog`。

## 6. 扩展规划
- 支持多平台 (Notion, Ghost) 时，此页面可重构为 "Integrations" 或 "Connections"。
- 添加站点健康检查 (定期验证 Token 有效性)。
