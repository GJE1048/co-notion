import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ErrorCodes, type ErrorCode, createErrorResponse } from "@/lib/api-errors";

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

type SiliconFlowMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return createErrorResponse({
        status: 401,
        error: "未授权",
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    let body: ChatRobotRequest;
    try {
      body = (await request.json()) as ChatRobotRequest;
    } catch (parseError) {
      console.error("机器人聊天接口请求体解析失败:", parseError);
      return createErrorResponse({
        status: 400,
        error: "请求体不是合法的 JSON",
        errorCode: ErrorCodes.INVALID_JSON,
      });
    }

    if (!body.messages || body.messages.length === 0) {
      return createErrorResponse({
        status: 400,
        error: "缺少对话消息",
        errorCode: ErrorCodes.MISSING_MESSAGES,
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (!user) {
      return createErrorResponse({
        status: 404,
        error: "用户不存在",
        errorCode: ErrorCodes.USER_NOT_FOUND,
      });
    }

    const targetDocumentId =
      body.target?.documentId ?? body.documentContext?.documentId;

    if (targetDocumentId) {
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, targetDocumentId));

      if (!document) {
        return createErrorResponse({
          status: 404,
          error: "文档不存在",
          errorCode: ErrorCodes.DOCUMENT_NOT_FOUND,
        });
      }

      if (document.ownerId !== user.id) {
        return createErrorResponse({
          status: 403,
          error: "无权访问此文档",
          errorCode: ErrorCodes.DOCUMENT_FORBIDDEN,
        });
      }
    }

    const messages: SiliconFlowMessage[] = [];

    const contextParts: string[] = [];

    if (body.documentContext?.title) {
      contextParts.push(`文档标题: ${body.documentContext.title}`);
    }

    if (body.documentContext?.summary) {
      contextParts.push(`文档摘要: ${body.documentContext.summary}`);
    }

    if (body.documentContext?.blocks && body.documentContext.blocks.length > 0) {
      const blockTexts = body.documentContext.blocks
        .map((block) => {
          return `Block ${block.blockId}:\n${block.content}`;
        })
        .join("\n\n");
      contextParts.push(`相关文档内容:\n${blockTexts}`);
    }

    if (contextParts.length > 0) {
      const contextText = contextParts.join("\n\n");
      messages.push({
        role: "system",
        content: `下面是与本次对话相关的文档上下文，请在编辑或回答问题时参考并尽量保持与原文风格一致：\n\n${contextText}`,
      });
    }

    if (body.mode === "edit" && body.action) {
      const actionMap: Record<RobotAction, string> = {
        chat: "进行自然对话",
        polish: "在不改变原意的前提下润色文本，提升表达和可读性",
        rewrite: "根据用户要求重写文本，可以调整结构和用词",
        summarize: "根据上下文生成简洁摘要",
        fix_typos: "修正错别字和明显语法错误，保持原意不变",
        extract: "从文本中提取关键要点或结构化信息",
        replace: "生成可直接替换当前文本的新内容",
      };

      const instruction = actionMap[body.action] ?? "进行智能编辑";

      messages.push({
        role: "system",
        content: `本次任务类型为: ${body.action}。请根据上述文档上下文和用户指令，${instruction}。如果涉及修改内容，请直接输出修改后的完整文本，不要包含解释说明。`,
      });
    }

    for (const message of body.messages) {
      messages.push({
        role: message.role,
        content: message.content,
      });
    }

    const reply = await callSiliconFlowChat(messages);

    const responseBody: ChatRobotResponse = {
      reply,
      metadata: {
        action: body.action,
        documentId: targetDocumentId,
        blockId: body.target?.blockId,
      },
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    const errorId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let errorCode: ErrorCode = ErrorCodes.INTERNAL_ERROR;
    let clientMessage = "机器人服务暂不可用，请稍后重试";

    if (error instanceof Error) {
      if (error.message.includes("SILICONFLOW_API_KEY")) {
        errorCode = ErrorCodes.MISSING_SILICONFLOW_API_KEY;
        clientMessage = "机器人服务未正确配置，请联系管理员检查 API Key";
      } else if (error.message.startsWith("SiliconFlow Chat API 调用失败")) {
        errorCode = ErrorCodes.ROBOT_API_ERROR;
      }

      console.error("机器人聊天接口调用错误:", {
        errorId,
        errorCode,
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("机器人聊天接口未知错误:", {
        errorId,
        errorCode,
        value: error,
      });
    }

    return createErrorResponse({
      status: 500,
      error: clientMessage,
      errorCode,
      errorId,
    });
  }
}

async function callSiliconFlowChat(messages: SiliconFlowMessage[]) {
  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey) {
    throw new Error("缺少 SILICONFLOW_API_KEY 环境变量");
  }

  for (let i = 0; i < apiKey.length; i += 1) {
    const code = apiKey.charCodeAt(i);
    if (code > 255) {
      throw new Error(
        `SILICONFLOW_API_KEY 包含非法字符，索引 ${i} 的字符编码为 ${code}`
      );
    }
  }

  const baseUrl =
    process.env.SILICONFLOW_BASE_URL ?? "https://api.siliconflow.cn";

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.SILICONFLOW_MODEL ?? "Qwen/Qwen3-8B",
        messages,
        temperature: 0.7,
      }),
    });
  } catch (networkError) {
    console.error("SiliconFlow Chat API 网络错误:", networkError);
    throw new Error(
      networkError instanceof Error
        ? `SiliconFlow Chat API 调用失败: ${networkError.message}`
        : "SiliconFlow Chat API 调用失败: 网络错误"
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("SiliconFlow API Error:", {
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
    });
    throw new Error(
      `SiliconFlow Chat API 调用失败: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content =
    data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";

  return content ?? "";
}
