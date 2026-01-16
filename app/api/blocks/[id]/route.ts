import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { blocks, documents, users } from "@/db/schema";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// PATCH /api/blocks/[id] - 更新 block
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: blockId } = await params;
    const updates = await request.json();

    // 验证用户权限
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 获取 block 及其文档信息
    const [block] = await db
      .select({
        block: blocks,
        document: documents,
      })
      .from(blocks)
      .innerJoin(documents, eq(blocks.documentId, documents.id))
      .where(eq(blocks.id, blockId));

    if (!block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    if (block.document.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 更新 block
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.properties !== undefined) updateData.properties = updates.properties;
    if (updates.position !== undefined) updateData.position = updates.position;
    if (updates.version !== undefined) updateData.version = updates.version;

    await db
      .update(blocks)
      .set(updateData)
      .where(eq(blocks.id, blockId));

    // TODO: 记录操作日志
    // await recordOperation(block.document.id, 'update_block', updates, user.id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Failed to update block:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/blocks/[id] - 删除 block
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: blockId } = await params;

    // 验证用户权限
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 获取 block 及其文档信息
    const [block] = await db
      .select({
        block: blocks,
        document: documents,
      })
      .from(blocks)
      .innerJoin(documents, eq(blocks.documentId, documents.id))
      .where(eq(blocks.id, blockId));

    if (!block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    if (block.document.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 删除 block
    await db
      .delete(blocks)
      .where(eq(blocks.id, blockId));

    // TODO: 记录操作日志
    // await recordOperation(block.document.id, 'delete_block', { blockId }, user.id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Failed to delete block:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
