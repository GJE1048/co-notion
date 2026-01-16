import { createTRPCRouter, baseProcedure } from "../init";
import { documentsRouter } from "@/modules/documents/server/procedures";
import { blocksRouter } from "@/modules/blocks/server/procedures";
import { workspacesRouter } from "@/modules/workspaces/server/procedures";

export const appRouter = createTRPCRouter({
  // Health check procedure - can be removed when adding actual procedures
  health: baseProcedure.query(() => ({ status: "ok" })),

  // 测试端点 - 获取所有文档（用于调试）
  testDocuments: baseProcedure.query(async () => {
    const { db } = await import("@/db");
    const { documents, users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const [user] = await db.select().from(users).limit(1);
    if (!user) return { documents: [] };

    const userDocs = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt
      })
      .from(documents)
      .where(eq(documents.ownerId, user.id));

    return { documents: userDocs };
  }),

  // 开发模式端点 - 绕过认证获取文档（仅用于调试）
  devDocuments: baseProcedure.query(async () => {
    const { db } = await import("@/db");
    const { documents, users, workspaces } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");

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

  // 文档相关路由
  documents: documentsRouter,

  // Block 相关路由
  blocks: blocksRouter,

  // 工作区相关路由
  workspaces: workspacesRouter,
})

export type AppRouter = typeof appRouter;