import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/db";
import { documents, workspaces, workspaceMembers } from "@/db/schema";
import { desc, eq, or, sql } from "drizzle-orm";

export const homeRouter = createTRPCRouter({
  getDashboardData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const recentDocuments = await db
      .select({
        id: documents.id,
        title: documents.title,
        workspaceId: documents.workspaceId,
        isArchived: documents.isArchived,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.ownerId, userId))
      .orderBy(desc(documents.updatedAt))
      .limit(5);

    const [docStats] = await db
      .select({
        totalDocuments: sql<number>`count(*)`,
        activeDocuments: sql<number>`sum(case when ${documents.isArchived} = false then 1 else 0 end)`,
      })
      .from(documents)
      .where(eq(documents.ownerId, userId));

    const [workspaceStats] = await db
      .select({
        workspaceCount: sql<number>`count(distinct ${workspaces.id})`,
      })
      .from(workspaces)
      .leftJoin(
        workspaceMembers,
        eq(workspaceMembers.workspaceId, workspaces.id),
      )
      .where(
        or(
          eq(workspaces.ownerId, userId),
          eq(workspaceMembers.userId, userId),
        ),
      );

    return {
      recentDocuments,
      stats: {
        totalDocuments: Number(docStats?.totalDocuments ?? 0),
        activeDocuments: Number(docStats?.activeDocuments ?? 0),
        workspaceCount: Number(workspaceStats?.workspaceCount ?? 0),
      },
    };
  }),
});

