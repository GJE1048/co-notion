
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { aiShorthandRecords, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ErrorCodes, createErrorResponse } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return createErrorResponse({
        status: 401,
        error: "未授权",
        errorCode: ErrorCodes.UNAUTHORIZED,
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

    const records = await db
      .select()
      .from(aiShorthandRecords)
      .where(eq(aiShorthandRecords.userId, user.id))
      .orderBy(desc(aiShorthandRecords.createdAt));

    return NextResponse.json({ records });
  } catch (error) {
    console.error("获取录音记录失败:", error);
    return createErrorResponse({
      status: 500,
      error: "获取记录失败",
      errorCode: ErrorCodes.INTERNAL_ERROR,
    });
  }
}

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

    const body = await request.json();
    const { title, date } = body;

    const [newRecord] = await db
      .insert(aiShorthandRecords)
      .values({
        userId: user.id,
        title: title || "新录音",
        date: date ? new Date(date) : new Date(),
        status: "recording",
      })
      .returning();

    return NextResponse.json({ record: newRecord });
  } catch (error) {
    console.error("创建录音记录失败:", error);
    return createErrorResponse({
      status: 500,
      error: "创建记录失败",
      errorCode: ErrorCodes.INTERNAL_ERROR,
    });
  }
}
