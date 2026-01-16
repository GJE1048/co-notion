import { createTRPCRouter, baseProcedure } from "../init";
import { z } from "zod";

export const devRouter = createTRPCRouter({
  // 开发模式 - 绕过认证获取文档（ngrok 环境下使用）
  getUserDocuments: baseProcedure.query(async () => {
    const { db } = await import("@/db");
    const { documents, users, workspaces } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");

    // 获取第一个用户（开发模式）
    const [user] = await db.select().from(users).limit(1);
    if (!user) return [];

    const userDocuments = await db
      .select({
        id: documents.id,
        title: documents.title,
        workspaceId: documents.workspaceId,
        isArchived: documents.isArchived,
        permissions: documents.permissions,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        workspace: {
          id: workspaces.id,
          name: workspaces.name,
        },
      })
      .from(documents)
      .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
      .where(eq(documents.ownerId, user.id))
      .orderBy(desc(documents.updatedAt));

    return userDocuments;
  }),

  // 开发模式 - 绕过认证获取单个文档
  getDocument: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const { db } = await import("@/db");
      const { documents, workspaces } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");

      const [document] = await db
        .select({
          id: documents.id,
          title: documents.title,
          workspaceId: documents.workspaceId,
          ownerId: documents.ownerId,
          isTemplate: documents.isTemplate,
          isArchived: documents.isArchived,
          permissions: documents.permissions,
          metadata: documents.metadata,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
          workspace: {
            id: workspaces.id,
            name: workspaces.name,
          },
        })
        .from(documents)
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .where(eq(documents.id, input.id));

      if (!document) {
        throw new Error("文档不存在");
      }

      return document;
    }),

  // 开发模式 - 绕过认证获取文档 blocks
  getDocumentBlocks: baseProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ input }) => {
      const { db } = await import("@/db");
      const { blocks } = await import("@/db/schema");
      const { eq, asc } = await import("drizzle-orm");

      const documentBlocks = await db
        .select()
        .from(blocks)
        .where(eq(blocks.documentId, input.documentId))
        .orderBy(asc(blocks.position));

      return {
        blocks: documentBlocks,
        total: documentBlocks.length,
      };
    }),
});