
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { aiShorthandRecords, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ErrorCodes, createErrorResponse } from "@/lib/api-errors";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return createErrorResponse({
        status: 401,
        error: "未授权",
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const { id: recordId } = await params;
    const body = await request.json();

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

    // 验证记录存在且属于当前用户
    const [record] = await db
      .select()
      .from(aiShorthandRecords)
      .where(and(
        eq(aiShorthandRecords.id, recordId),
        eq(aiShorthandRecords.userId, user.id)
      ));

    if (!record) {
      return createErrorResponse({
        status: 404,
        error: "记录不存在",
        errorCode: ErrorCodes.DOCUMENT_NOT_FOUND, // 复用类似的错误码
      });
    }

    // 更新记录
    const updateData: Partial<typeof aiShorthandRecords.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.duration !== undefined) updateData.duration = body.duration;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.transcript !== undefined) updateData.transcript = body.transcript;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const [updatedRecord] = await db
      .update(aiShorthandRecords)
      .set(updateData)
      .where(eq(aiShorthandRecords.id, recordId))
      .returning();

    return NextResponse.json({ record: updatedRecord });
  } catch (error) {
    console.error("更新录音记录失败:", error);
    return createErrorResponse({
      status: 500,
      error: "更新记录失败",
      errorCode: ErrorCodes.INTERNAL_ERROR,
    });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return createErrorResponse({
        status: 401,
        error: "未授权",
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const { id: recordId } = await params;

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

    // 验证记录存在且属于当前用户
    const [record] = await db
      .select()
      .from(aiShorthandRecords)
      .where(and(
        eq(aiShorthandRecords.id, recordId),
        eq(aiShorthandRecords.userId, user.id)
      ));

    if (!record) {
      return createErrorResponse({
        status: 404,
        error: "记录不存在",
        errorCode: ErrorCodes.DOCUMENT_NOT_FOUND,
      });
    }

    await db
      .delete(aiShorthandRecords)
      .where(eq(aiShorthandRecords.id, recordId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除录音记录失败:", error);
    return createErrorResponse({
      status: 500,
      error: "删除记录失败",
      errorCode: ErrorCodes.INTERNAL_ERROR,
    });
  }
}
