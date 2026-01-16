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

// GET /api/documents/[id]/blocks - 获取文档的所有 blocks
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: documentId } = await params;

    // 验证用户权限
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 获取所有 blocks，按位置排序
    const documentBlocks = await db
      .select()
      .from(blocks)
      .where(eq(blocks.documentId, documentId))
      .orderBy(blocks.position);

    return NextResponse.json({
      blocks: documentBlocks,
      total: documentBlocks.length
    });

  } catch (error) {
    console.error("Failed to fetch blocks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/documents/[id]/blocks - 创建新 block
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: documentId } = await params;
    const body = await request.json();

    // 验证用户权限
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 创建新 block
    const newBlock = {
      id: body.id || crypto.randomUUID(),
      documentId,
      parentId: body.parentId || null,
      type: body.type,
      content: body.content || {},
      properties: body.properties || {},
      position: body.position || 0,
      version: body.version || 1,
      createdBy: user.id,
    };

    await db.insert(blocks).values(newBlock);

    // TODO: 记录操作日志
    // await recordOperation(documentId, 'create_block', newBlock, user.id);

    return NextResponse.json(newBlock, { status: 201 });

  } catch (error) {
    console.error("Failed to create block:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
