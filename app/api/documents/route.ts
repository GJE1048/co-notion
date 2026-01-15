import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "未授权" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, userId } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "文档标题不能为空" },
        { status: 400 }
      );
    }

    // 验证用户是否存在
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
    }

    // 验证Clerk用户ID匹配
    if (user.clerkId !== clerkUserId) {
      return NextResponse.json(
        { error: "无权创建此文档" },
        { status: 403 }
      );
    }

    // 创建文档
    const [newDocument] = await db
      .insert(documents)
      .values({
        title: title.trim(),
        content: "",
        userId: user.id,
      })
      .returning();

    return NextResponse.json(
      { document: newDocument },
      { status: 201 }
    );
  } catch (error) {
    console.error("创建文档错误:", error);
    return NextResponse.json(
      { error: "创建文档时发生错误" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "未授权" },
        { status: 401 }
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (!user) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
    }

    const userDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, user.id))
      .orderBy(documents.updatedAt);

    return NextResponse.json({ documents: userDocuments });
  } catch (error) {
    console.error("获取文档列表错误:", error);
    return NextResponse.json(
      { error: "获取文档列表时发生错误" },
      { status: 500 }
    );
  }
}

