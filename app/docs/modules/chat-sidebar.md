# 文档编辑右侧机器人聊天侧边栏

## 概述

本模块在「文档编辑页」中增加一个可开关的**右侧机器人聊天侧边栏**，提供基于大模型的对话能力，用于：
- 询问写作建议、结构优化方案
- 基于当前文档内容进行问答和总结
- 辅助生成段落、标题等内容块

侧边栏布局与现有左侧边栏保持视觉风格一致，并使用机器人图标作为入口。

## UI 设计

### 入口与布局

- **入口位置**：
  - 文档编辑页顶部工具栏右侧新增一个「机器人」按钮（例如使用 `lucide-react` 中的机器人图标）
  - 点击按钮时在桌面端打开 / 关闭右侧聊天侧边栏
- **侧边栏布局**：
  - 使用现有 `Sidebar` 组件的右侧模式（`side="right"`），宽度与左侧保持一致
  - 在移动端使用 Radix `Sheet` 的右滑抽屉形式
  - 内容区域包含：
    - 标题栏：机器人名称 + 在线状态点
    - 聊天消息列表（上下滚动）
    - 输入框 + 发送按钮
    - 可选的「基于当前文档提问」「润色本段」等快捷操作入口

### 交互行为

- **打开 / 关闭**：
  - 再次点击机器人按钮，切换侧边栏显示状态
  - 文档编辑区宽度自适应收缩，避免遮挡内容
- **聊天体验**：
  - 发送消息后立即在列表中追加「用户消息」
  - 调用后端 Chat 接口后逐步显示「机器人回复」（第一版可先使用非流式完整输出）
  - 显示请求状态（如「机器人思考中...」）
  - 错误时显示错误提示（如「服务繁忙，请稍后重试」）

## 技术方案

### 前端架构

- 在文档编辑视图（`DocumentView` / `DocumentEditor`）中：
  - 增加一个本地状态 `isChatSidebarOpen`
  - 顶部工具栏添加机器人按钮，切换该状态
  - 在页面右侧渲染一个固定定位的聊天面板：
    - Desktop：固定在右侧，宽度约 360–400px
    - Mobile：可以复用 `Sheet` 或简单的全屏覆盖，第一版以 Desktop 为主
- 聊天消息状态：
  - 使用 `useState` 存储消息数组：
    ```ts
    type ChatRole = "user" | "assistant" | "system";

    interface ChatMessage {
      id: string;
      role: ChatRole;
      content: string;
      createdAt: Date;
    }
    ```
  - 每次发送时：
    - 追加用户消息到本地列表
    - 调用后端 `/api/chat/robot` 接口
    - 收到成功响应后追加机器人消息

### 后端 API 设计（硅基流动接入）

- 新增一个 Next.js Route Handler（示例路径）：

  ```ts
  // POST /api/chat/robot
  type RobotAction =
    | "chat"
    | "polish"
    | "rewrite"
    | "summarize"
    | "fix_typos"
    | "extract"
    | "replace";

  interface DocumentBlockContext {
    documentId: string;
    blockId: string;
    content: string;
  }

  interface ChatRobotRequest {
    messages: {
      role: "user" | "assistant" | "system";
      content: string;
    }[];
    mode?: "chat" | "edit";
    action?: RobotAction;
    target?: {
      type: "document" | "block" | "selection";
      documentId?: string;
      blockId?: string;
    };
    documentContext?: {
      documentId: string;
      title: string;
      // 可选：截取的文档内容摘要
      summary?: string;
      blocks?: DocumentBlockContext[];
    };
  }

  interface ChatRobotResponse {
    reply: string;
    metadata?: {
      action?: RobotAction;
      documentId?: string;
      blockId?: string;
    };
  }
  ```

- 处理逻辑：
  1. 从请求中读取用户对话 `messages`
  2. 可选：根据 `documentContext.documentId` 调用文档查询 / 摘要接口，补充上下文
  3. 组装成硅基流动兼容的 Chat 请求体
  4. 调用硅基流动 Chat API，取回模型回复
  5. 返回统一的 `{ reply }` JSON 响应

### 硅基流动 Chat API 调用约定

> 注意：以下为示例约定，具体字段需根据硅基流动官方文档确认后在实现阶段对齐。

- 环境变量约定：
  - `SILICONFLOW_API_KEY`：硅基流动 API Key
  - `SILICONFLOW_BASE_URL`：可选，若有网关或代理地址

- 请求示例（伪代码）：

  ```ts
  const apiKey = process.env.SILICONFLOW_API_KEY;

  async function callSiliconFlowChat(messages: { role: string; content: string }[]) {
    const response = await fetch(`${process.env.SILICONFLOW_BASE_URL ?? "https://api.siliconflow.cn"}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "siliconflow-chat-model-id",
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error("SiliconFlow Chat API 调用失败");
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  }
  ```

### 权限与安全

- 仅登录用户可以使用机器人聊天侧边栏
- 针对每个请求：
  - 校验用户身份（通过 Clerk session）
  - 可选：记录审计日志（用户、文档、问题时间）
- 对输入内容做基本长度限制，避免过长内容导致请求失败或成本过高

## 开发步骤

1. **前端 UI 与状态管理**
   - 在文档编辑顶部工具栏添加机器人按钮
   - 在文档编辑页右侧实现一个可开关的聊天侧边栏（仅本地假数据）
   - 完成消息列表与输入框 UI

2. **后端 Chat API 接口**
   - 新增 `/api/chat/robot` Route Handler
   - 从请求中读取 `messages`，调用硅基流动 Chat API
   - 返回标准化的 `{ reply }` 响应

3. **前端接入后端接口**
   - 发送消息时调用 `/api/chat/robot`
   - 根据响应更新聊天消息列表
   - 增加错误提示与加载状态

4. **文档上下文增强（可选）**
   - 在请求中附带当前文档 `documentId` 和标题
   - 后端根据需要查询文档摘要或关键内容，作为系统提示注入模型

## 文档内容集成与智能编辑

### 目标与使用场景

- 文档内容美化：对当前段落或选中文本进行润色、改写、纠错
- 结构调整：在保持语义不变的前提下优化段落结构和层级
- 内容增删：根据用户指令补充示例、扩展说明，或删除冗余内容
- 内容摘取：从长文档中抽取摘要、关键要点或行动项
- 一键应用：用户确认 AI 输出后，一键替换当前段落内容或插入新内容

### 前端交互设计

- 在聊天输入区上方或下方增加快捷操作按钮，例如：
  - 「润色当前段落」
  - 「修正错别字」
  - 「重写为更正式的表达」
  - 「从文档中帮我摘取要点」
- 快捷操作点击流程：
  1. 前端从文档编辑器中读取当前光标所在的段落或选中内容
  2. 将文本作为 `DocumentBlockContext.content` 发送给 `/api/chat/robot`
  3. 收到 AI 回复后，在消息气泡中展示结果，同时在下方渲染「替换当前段落」「插入为新段落」按钮
  4. 用户点击按钮后，通过现有 Blocks 模块更新或插入对应文档块内容

### 后端请求扩展与行为约定

- 基于 `mode` 与 `action` 区分不同能力：
  - `mode: "chat"`：普通问答与头脑风暴，主要基于 `messages`
  - `mode: "edit"`：文档内容编辑场景，强依赖 `documentContext` 和 `target`
- 常见 `action` 约定：
  - `"polish"`：在不改变原意的前提下润色文本
  - `"fix_typos"`：侧重错别字和基础语法纠错
  - `"rewrite"`：根据语气或风格要求重新表述
  - `"summarize"`：输出简洁摘要
  - `"extract"`：提取要点、列表或结构化信息
  - `"replace"`：明确告诉模型将输出视为可直接落地的新内容
- 当请求中携带 `target.type = "block"` 时：
  - `documentContext.blocks` 至少包含当前目标块
  - 后端可以在系统提示中注入约束，例如「保持段落编号与上文引用一致」
- 当请求中携带 `target.type = "document"` 时：
  - 优先用于全局性操作，如「帮我为整篇文档生成摘要」「统一语气」

### 内容应用与替换流程

1. 前端将当前段落内容作为 `DocumentBlockContext` 发送给 `/api/chat/robot`，同时设置 `target.type = "block"` 和对应的 `blockId`
2. 后端根据 `action` 生成结果文本，并在 `ChatRobotResponse.metadata` 中回传 `documentId` 与 `blockId`
3. 前端在聊天窗中展示结果，附带「应用到文档」按钮
4. 用户点击按钮后：
   - 调用 Blocks 模块的更新接口，将该 `blockId` 的内容替换为 AI 输出
   - 或在该段落后插入新 Block，以保留原文和 AI 文本的对比
5. 操作成功后，可在聊天记录中追加一条系统消息，标记「已应用到文档」

### 示例请求结构

```ts
const req: ChatRobotRequest = {
  messages: [
    {
      role: "user",
      content: "请帮我润色这段话，突出结论并修正错别字。",
    },
  ],
  mode: "edit",
  action: "polish",
  target: {
    type: "block",
    documentId: "doc_123",
    blockId: "block_456",
  },
  documentContext: {
    documentId: "doc_123",
    title: "示例文档",
    blocks: [
      {
        documentId: "doc_123",
        blockId: "block_456",
        content: "原始段落内容...",
      },
    ],
  },
};
```

5. **优化与扩展**
   - 支持流式响应（Streaming）与打字机效果
   - 支持预设提示词模式（如「帮我润色本段」「帮我生成摘要」）
   - 支持对话历史分页与本地持久化（localStorage 或服务端存储）

## 测试要点

- UI：
  - 机器人按钮可以正常开关右侧侧边栏
  - 聊天窗口在不同屏幕尺寸下布局正常
- 功能：
  - 输入问题后能够成功获得硅基流动返回的回复
  - 接口错误时有清晰的错误提示，不会导致页面崩溃
- 安全：
  - 未登录用户无法访问聊天接口
  - 不会在前端暴露 `SILICONFLOW_API_KEY`
