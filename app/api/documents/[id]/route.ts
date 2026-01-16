import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "未授权" },
        { status: 401 }
      );
    }

    const { id } = await params;

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

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));

    if (!document) {
      return NextResponse.json(
        { error: "文档不存在" },
        { status: 404 }
      );
    }

    // 验证文档所有权
    if (document.ownerId !== user.id) {
      return NextResponse.json(
        { error: "无权访问此文档" },
        { status: 403 }
      );
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error("获取文档错误:", error);
    return NextResponse.json(
      { error: "获取文档时发生错误" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "未授权" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { title, content } = body;

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

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));

    if (!document) {
      return NextResponse.json(
        { error: "文档不存在" },
        { status: 404 }
      );
    }

    // 验证文档所有权
    if (document.ownerId !== user.id) {
      return NextResponse.json(
        { error: "无权编辑此文档" },
        { status: 403 }
      );
    }

    // 更新文档
    const [updatedDocument] = await db
      .update(documents)
      .set({
        title: title !== undefined ? title.trim() : document.title,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();

    return NextResponse.json({ document: updatedDocument });
  } catch (error) {
    console.error("更新文档错误:", error);
    return NextResponse.json(
      { error: "更新文档时发生错误" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "未授权" },
        { status: 401 }
      );
    }

    const { id } = await params;

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

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));

    if (!document) {
      return NextResponse.json(
        { error: "文档不存在" },
        { status: 404 }
      );
    }

    // 验证文档所有权
    if (document.ownerId !== user.id) {
      return NextResponse.json(
        { error: "无权删除此文档" },
        { status: 403 }
      );
    }

    await db.delete(documents).where(eq(documents.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除文档错误:", error);
    return NextResponse.json(
      { error: "删除文档时发生错误" },
      { status: 500 }
    );
  }
}

