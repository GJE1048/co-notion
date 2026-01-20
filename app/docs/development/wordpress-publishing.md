### 9. 开发任务拆解

1. **后端基础设施 (已完成)**
   - 实现 `integration_accounts` Schema 设计与迁移。
   - 实现 `bindWordpressSite` procedure。

2. **文档转换引擎**
   - 实现 `exportDocumentToHtml`：将 Block 结构转为符合 WordPress 要求的 HTML。

3. **前端 UI (进行中)**
   - `ConnectWordpressDialog`：表单输入 URL、用户名、密码。
   - `PublishToWordpressDialog`：支持选择 Post/Page，选择分类/标签。
   - **新增**：在 `PublishToWordpressDialog` 中增加 Jetpack Social 选项。

4. **集成测试**
   - 验证 Application Password 流程。
   - 验证 OAuth 流程。
   - 验证 Post 和 Page 的发布及更新。
   - 验证 Jetpack Social 消息透传。
