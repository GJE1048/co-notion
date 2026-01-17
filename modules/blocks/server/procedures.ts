import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { db } from "@/db";
import { blocks, documents, operations, documentCollaborators, workspaces, workspaceMembers } from "@/db/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyDocumentUpdated } from "@/realtime/notify";

export const blocksRouter = createTRPCRouter({
  // 获取单个 Block 详情
  getBlock: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [block] = await db
        .select({
          id: blocks.id,
          documentId: blocks.documentId,
          parentId: blocks.parentId,
          type: blocks.type,
          content: blocks.content,
          properties: blocks.properties,
          position: blocks.position,
          version: blocks.version,
          createdAt: blocks.createdAt,
          updatedAt: blocks.updatedAt,
          createdBy: blocks.createdBy,
        })
        .from(blocks)
        .innerJoin(documents, eq(blocks.documentId, documents.id))
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(
          eq(blocks.id, input.id),
          or(
            eq(documents.ownerId, ctx.user.id),
            eq(documentCollaborators.userId, ctx.user.id),
            eq(workspaces.ownerId, ctx.user.id),
            eq(workspaceMembers.userId, ctx.user.id),
          )
        ));

      if (!block) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Block 不存在",
        });
      }

      return block;
    }),

  // 更新 Block
  updateBlock: protectedProcedure
    .input(z.object({
      id: z.string(),
      clientId: z.string().optional(),
      data: z.object({
        type: z.enum([
          'page', 'heading_1', 'heading_2', 'heading_3',
          'paragraph', 'code', 'quote', 'list', 'todo',
          'divider', 'image', 'video', 'file', 'ai_generated',
          'database', 'table', 'kanban', 'calendar'
        ]).optional(),
        content: z.unknown().optional(),
        properties: z.unknown().optional(),
        position: z.number().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // 验证 Block 权限
      const [block] = await db
        .select({
          block: blocks,
          document: documents,
          collaboratorUserId: documentCollaborators.userId,
          workspaceOwnerId: workspaces.ownerId,
          workspaceMemberUserId: workspaceMembers.userId,
        })
        .from(blocks)
        .innerJoin(documents, eq(blocks.documentId, documents.id))
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(blocks.id, input.id));

      const hasAccess =
        !!block &&
        (block.document.ownerId === ctx.user.id ||
          block.collaboratorUserId === ctx.user.id ||
          block.workspaceOwnerId === ctx.user.id ||
          block.workspaceMemberUserId === ctx.user.id);

      if (!block || !hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Block 不存在或无权限访问",
        });
      }

      const [updatedBlock] = await db
        .update(blocks)
        .set({
          ...input.data,
          updatedAt: new Date(),
          version: sql`${blocks.version} + 1`,
        })
        .where(eq(blocks.id, input.id))
        .returning();

      const [lastOperation] = await db
        .select({ version: operations.version })
        .from(operations)
        .where(eq(operations.documentId, block.document.id))
        .orderBy(desc(operations.version))
        .limit(1);

      const nextVersion = lastOperation ? lastOperation.version + 1 : 1;

      await db.insert(operations).values({
        documentId: block.document.id,
        blockId: updatedBlock.id,
        type: "update_block",
        payload: input.data as Record<string, unknown>,
        clientId: input.clientId ?? ctx.user.id,
        userId: ctx.user.id,
        version: nextVersion,
      });

      void notifyDocumentUpdated(block.document.id, nextVersion);

      return updatedBlock;
    }),

  // 删除 Block
  deleteBlock: protectedProcedure
    .input(z.object({
      id: z.string(),
      clientId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 验证 Block 权限
      const [block] = await db
        .select({
          block: blocks,
          document: documents,
          collaboratorUserId: documentCollaborators.userId,
          workspaceOwnerId: workspaces.ownerId,
          workspaceMemberUserId: workspaceMembers.userId,
        })
        .from(blocks)
        .innerJoin(documents, eq(blocks.documentId, documents.id))
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(blocks.id, input.id));

      const hasAccess =
        !!block &&
        (block.document.ownerId === ctx.user.id ||
          block.collaboratorUserId === ctx.user.id ||
          block.workspaceOwnerId === ctx.user.id ||
          block.workspaceMemberUserId === ctx.user.id);

      if (!block || !hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Block 不存在或无权限访问",
        });
      }

      await db
        .delete(blocks)
        .where(eq(blocks.id, input.id));

      const [lastOperation] = await db
        .select({ version: operations.version })
        .from(operations)
        .where(eq(operations.documentId, block.document.id))
        .orderBy(desc(operations.version))
        .limit(1);

      const nextVersion = lastOperation ? lastOperation.version + 1 : 1;

      await db.insert(operations).values({
        documentId: block.document.id,
        blockId: block.block.id,
        type: "delete_block",
        payload: { blockId: input.id } as Record<string, unknown>,
        clientId: input.clientId ?? ctx.user.id,
        userId: ctx.user.id,
        version: nextVersion,
      });

      void notifyDocumentUpdated(block.document.id, nextVersion);

      return { success: true };
    }),

  // 获取文档的所有子 Block
  getChildBlocks: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      parentId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // 验证文档权限
      const [document] = await db
        .select()
        .from(documents)
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(
          eq(documents.id, input.documentId),
          or(
            eq(documents.ownerId, ctx.user.id),
            eq(documentCollaborators.userId, ctx.user.id),
            eq(workspaces.ownerId, ctx.user.id),
            eq(workspaceMembers.userId, ctx.user.id),
          )
        ));

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      const childBlocks = await db
        .select()
        .from(blocks)
        .where(and(
          eq(blocks.documentId, input.documentId),
          input.parentId
            ? eq(blocks.parentId, input.parentId)
            : sql`${blocks.parentId} IS NULL`
        ))
        .orderBy(blocks.position);

      return childBlocks;
    }),

  // 批量更新 Block 位置
  reorderBlocks: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      parentId: z.string().optional(),
      blockUpdates: z.array(z.object({
        id: z.string(),
        position: z.number(),
      })),
      clientId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 验证文档权限
      const [document] = await db
        .select()
        .from(documents)
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(
          eq(documents.id, input.documentId),
          or(
            eq(documents.ownerId, ctx.user.id),
            eq(documentCollaborators.userId, ctx.user.id),
            eq(workspaces.ownerId, ctx.user.id),
            eq(workspaceMembers.userId, ctx.user.id),
          )
        ));

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      // 批量更新位置
      const updatePromises = input.blockUpdates.map(({ id, position }) =>
        db
          .update(blocks)
          .set({
            position,
            updatedAt: new Date(),
            version: sql`${blocks.version} + 1`,
          })
          .where(and(
            eq(blocks.id, id),
            eq(blocks.documentId, input.documentId),
            input.parentId
              ? eq(blocks.parentId, input.parentId)
              : sql`${blocks.parentId} IS NULL`
          ))
      );

      await Promise.all(updatePromises);

      const [lastOperation] = await db
        .select({ version: operations.version })
        .from(operations)
        .where(eq(operations.documentId, input.documentId))
        .orderBy(desc(operations.version))
        .limit(1);

      const nextVersion = lastOperation ? lastOperation.version + 1 : 1;

      await db.insert(operations).values({
        documentId: input.documentId,
        blockId: null,
        type: "reorder_blocks",
        payload: input as Record<string, unknown>,
        clientId: input.clientId ?? ctx.user.id,
        userId: ctx.user.id,
        version: nextVersion,
      });

      void notifyDocumentUpdated(input.documentId, nextVersion);

      return { success: true };
    }),

  // 复制 Block
  duplicateBlock: protectedProcedure
    .input(z.object({
      id: z.string(),
      clientId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 获取原 Block
      const [originalBlock] = await db
        .select({
          block: blocks,
          document: documents,
          collaboratorUserId: documentCollaborators.userId,
          workspaceOwnerId: workspaces.ownerId,
          workspaceMemberUserId: workspaceMembers.userId,
        })
        .from(blocks)
        .innerJoin(documents, eq(blocks.documentId, documents.id))
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(blocks.id, input.id));

      const hasAccess =
        !!originalBlock &&
        (originalBlock.document.ownerId === ctx.user.id ||
          originalBlock.collaboratorUserId === ctx.user.id ||
          originalBlock.workspaceOwnerId === ctx.user.id ||
          originalBlock.workspaceMemberUserId === ctx.user.id);

      if (!originalBlock || !hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Block 不存在",
        });
      }

      // 获取下一个位置
      const [lastBlock] = await db
        .select({ position: blocks.position })
        .from(blocks)
        .where(eq(blocks.documentId, originalBlock.document.id))
        .orderBy(desc(blocks.position))
        .limit(1);

      const nextPosition = lastBlock ? lastBlock.position + 1 : 0;

      // 创建副本
      const [duplicatedBlock] = await db
        .insert(blocks)
        .values({
          documentId: originalBlock.document.id,
          parentId: originalBlock.block.parentId,
          type: originalBlock.block.type,
          content: originalBlock.block.content,
          properties: originalBlock.block.properties,
          position: nextPosition,
          version: 1,
          createdBy: ctx.user.id,
        })
        .returning();

      const [lastOperation] = await db
        .select({ version: operations.version })
        .from(operations)
        .where(eq(operations.documentId, originalBlock.document.id))
        .orderBy(desc(operations.version))
        .limit(1);

      const nextVersion = lastOperation ? lastOperation.version + 1 : 1;

      await db.insert(operations).values({
        documentId: originalBlock.document.id,
        blockId: duplicatedBlock.id,
        type: "duplicate_block",
        payload: {
          originalId: input.id,
          duplicatedId: duplicatedBlock.id,
        } as Record<string, unknown>,
        clientId: input.clientId ?? ctx.user.id,
        userId: ctx.user.id,
        version: nextVersion,
      });

      void notifyDocumentUpdated(originalBlock.document.id, nextVersion);

      return duplicatedBlock;
    }),

  // 搜索 Block 内容
  searchBlocks: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      query: z.string().min(1),
      type: z.enum(['all', 'text', 'heading', 'code']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      // 验证文档权限
      const [document] = await db
        .select()
        .from(documents)
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(
          eq(documents.id, input.documentId),
          or(
            eq(documents.ownerId, ctx.user.id),
            eq(documentCollaborators.userId, ctx.user.id),
            eq(workspaces.ownerId, ctx.user.id),
            eq(workspaceMembers.userId, ctx.user.id),
          )
        ));

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      const whereConditions = [
        eq(blocks.documentId, input.documentId),
      ];

      // 添加类型过滤
      if (input.type !== 'all') {
        switch (input.type) {
          case 'heading':
            whereConditions.push(sql`${blocks.type} IN ('heading_1', 'heading_2', 'heading_3')`);
            break;
          case 'text':
            whereConditions.push(sql`${blocks.type} IN ('paragraph', 'quote')`);
            break;
          case 'code':
            whereConditions.push(eq(blocks.type, 'code'));
            break;
        }
      }

      // 添加内容搜索条件
      whereConditions.push(
        sql`${blocks.content}::text ILIKE ${`%${input.query}%`}`
      );

      const searchResults = await db
        .select({
          id: blocks.id,
          type: blocks.type,
          content: blocks.content,
          position: blocks.position,
        })
        .from(blocks)
        .where(and(...whereConditions))
        .orderBy(blocks.position)
        .limit(50);

      return {
        results: searchResults,
        total: searchResults.length,
      };
    }),

  // 获取 Block 操作历史
  getBlockHistory: protectedProcedure
    .input(z.object({
      blockId: z.string(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      // 验证 Block 权限
      const [block] = await db
        .select({
          block: blocks,
          document: documents,
          collaboratorUserId: documentCollaborators.userId,
          workspaceOwnerId: workspaces.ownerId,
          workspaceMemberUserId: workspaceMembers.userId,
        })
        .from(blocks)
        .innerJoin(documents, eq(blocks.documentId, documents.id))
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(blocks.id, input.blockId));

      const hasAccess =
        !!block &&
        (block.document.ownerId === ctx.user.id ||
          block.collaboratorUserId === ctx.user.id ||
          block.workspaceOwnerId === ctx.user.id ||
          block.workspaceMemberUserId === ctx.user.id);

      if (!block || !hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Block 不存在",
        });
      }

      const history = await db
        .select()
        .from(operations)
        .where(eq(operations.blockId, input.blockId))
        .orderBy(desc(operations.timestamp))
        .limit(input.limit);

      return {
        operations: history,
        block: block.block,
      };
    }),
});
