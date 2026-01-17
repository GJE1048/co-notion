import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { db } from "@/db";
import { documents, blocks, workspaces, operations, users, documentCollaborators, workspaceMembers } from "@/db/schema";
import { eq, and, desc, asc, sql, gt, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Schema definitions
const createDocumentSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  workspaceId: z.string().optional(),
  templateId: z.string().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1, "标题不能为空").optional(),
  isArchived: z.boolean().optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
});

const createBlockSchema = z.object({
  documentId: z.string(),
  type: z.enum([
    'page', 'heading_1', 'heading_2', 'heading_3',
    'paragraph', 'code', 'quote', 'list', 'todo',
    'divider', 'image', 'video', 'file', 'ai_generated',
    'database', 'table', 'kanban', 'calendar'
  ]),
  parentId: z.string().nullable().optional(),
  content: z.unknown().default({}),
  properties: z.unknown().default({}),
  position: z.number().default(0),
  clientId: z.string().optional(),
});

const updateBlockSchema = z.object({
  type: z.enum([
    'page', 'heading_1', 'heading_2', 'heading_3',
    'paragraph', 'code', 'quote', 'list', 'todo',
    'divider', 'image', 'video', 'file', 'ai_generated',
    'database', 'table', 'kanban', 'calendar'
  ]).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  position: z.number().optional(),
});

export const documentsRouter = createTRPCRouter({
  // 获取用户的所有文档
  getUserDocuments: protectedProcedure
    .query(async ({ ctx }) => {
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
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(or(
          eq(documents.ownerId, ctx.user.id),
          eq(documentCollaborators.userId, ctx.user.id),
          eq(workspaces.ownerId, ctx.user.id),
          eq(workspaceMembers.userId, ctx.user.id),
        ))
        .orderBy(desc(documents.updatedAt));

      return userDocuments;
    }),

  // 获取单个文档详情
  getDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(
          eq(documents.id, input.id),
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

      return document;
    }),

  // 创建新文档
  createDocument: protectedProcedure
    .input(createDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      // 如果没有指定工作区，使用用户的默认工作区
      let workspaceId = input.workspaceId;
      if (!workspaceId) {
        const [defaultWorkspace] = await db
          .select()
          .from(workspaces)
          .where(and(
            eq(workspaces.ownerId, ctx.user.id),
            eq(workspaces.isPersonal, true)
          ));

        if (!defaultWorkspace) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "未找到默认工作区",
          });
        }
        workspaceId = defaultWorkspace.id;
      }

      // 创建文档
      const [newDocument] = await db
        .insert(documents)
        .values({
          title: input.title,
          workspaceId,
          ownerId: ctx.user.id,
          isTemplate: false,
          isArchived: false,
          permissions: { public: false, team: true },
          metadata: {},
        })
        .returning();

      // 创建默认的标题 Block
      await db.insert(blocks).values({
        documentId: newDocument.id,
        type: 'heading_1',
        content: { text: { content: input.title } },
        properties: {},
        position: 0,
        version: 1,
        createdBy: ctx.user.id,
      });

      return newDocument;
    }),

  // 更新文档
  updateDocument: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: updateDocumentSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const [existingDocument] = await db
        .select()
        .from(documents)
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(
          eq(documents.id, input.id),
          or(
            eq(documents.ownerId, ctx.user.id),
            eq(documentCollaborators.userId, ctx.user.id),
            eq(workspaces.ownerId, ctx.user.id),
            eq(workspaceMembers.userId, ctx.user.id),
          )
        ));

      if (!existingDocument) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      const [updatedDocument] = await db
        .update(documents)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, input.id))
        .returning();

      return updatedDocument;
    }),

  // 删除文档（软删除）
  deleteDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existingDocument] = await db
        .select()
        .from(documents)
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .leftJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(
          eq(documents.id, input.id),
          or(
            eq(documents.ownerId, ctx.user.id),
            eq(documentCollaborators.userId, ctx.user.id),
            eq(workspaces.ownerId, ctx.user.id),
            eq(workspaceMembers.userId, ctx.user.id),
          )
        ));

      if (!existingDocument) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      await db
        .update(documents)
        .set({
          isArchived: true,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, input.id));

      return { success: true };
    }),

  // 获取文档的完整 Block 树
  getDocumentBlocks: protectedProcedure
    .input(z.object({ documentId: z.string() }))
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

  // 创建 Block
  createBlock: protectedProcedure
    .input(createBlockSchema)
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

      // 获取下一个位置
      const existingBlocks = await db
        .select({ position: blocks.position })
        .from(blocks)
        .where(eq(blocks.documentId, input.documentId))
        .orderBy(desc(blocks.position))
        .limit(1);

      const nextPosition = existingBlocks.length > 0
        ? existingBlocks[0].position + 1
        : 0;

      const [newBlock] = await db
        .insert(blocks)
        .values({
          documentId: input.documentId,
          type: input.type,
          parentId: input.parentId ?? null,
          content: input.content,
          properties: input.properties,
          position: input.position ?? nextPosition,
          version: 1,
          createdBy: ctx.user.id,
        })
        .returning();

      const [lastOperation] = await db
        .select({ version: operations.version })
        .from(operations)
        .where(eq(operations.documentId, input.documentId))
        .orderBy(desc(operations.version))
        .limit(1);

      const nextVersion = lastOperation ? lastOperation.version + 1 : 1;

      await db.insert(operations).values({
        documentId: input.documentId,
        blockId: newBlock.id,
        type: "create_block",
        payload: newBlock as unknown as Record<string, unknown>,
        clientId: input.clientId ?? ctx.user.id,
        userId: ctx.user.id,
        version: nextVersion,
      });

      return newBlock;
    }),

  // 更新 Block
  updateBlock: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: updateBlockSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // 验证 Block 权限
      const [block] = await db
        .select({
          block: blocks,
          document: documents,
        })
        .from(blocks)
        .innerJoin(documents, eq(blocks.documentId, documents.id))
        .where(eq(blocks.id, input.id));

      if (!block || block.document.ownerId !== ctx.user.id) {
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

      // TODO: 记录操作日志
      // await recordOperation(block.document.id, 'update_block', input.data, ctx.user.id);

      return updatedBlock;
    }),

  // 删除 Block
  deleteBlock: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 验证 Block 权限
      const [block] = await db
        .select({
          block: blocks,
          document: documents,
        })
        .from(blocks)
        .innerJoin(documents, eq(blocks.documentId, documents.id))
        .where(eq(blocks.id, input.id));

      if (!block || block.document.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Block 不存在或无权限访问",
        });
      }

      await db
        .delete(blocks)
        .where(eq(blocks.id, input.id));

      // TODO: 记录操作日志
      // await recordOperation(block.document.id, 'delete_block', { blockId: input.id }, ctx.user.id);

      return { success: true };
    }),

  // 移动 Block
  moveBlock: protectedProcedure
    .input(z.object({
      id: z.string(),
      newParentId: z.string().optional(),
      newPosition: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 验证 Block 权限
      const [block] = await db
        .select({
          block: blocks,
          document: documents,
        })
        .from(blocks)
        .innerJoin(documents, eq(blocks.documentId, documents.id))
        .where(eq(blocks.id, input.id));

      if (!block || block.document.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Block 不存在或无权限访问",
        });
      }

      await db
        .update(blocks)
        .set({
          parentId: input.newParentId,
          position: input.newPosition,
          updatedAt: new Date(),
          version: sql`${blocks.version} + 1`,
        })
        .where(eq(blocks.id, input.id));

      // TODO: 记录操作日志
      // await recordOperation(block.document.id, 'move_block', input, ctx.user.id);

      return { success: true };
    }),

  // 获取文档的历史版本
  getDocumentVersions: protectedProcedure
    .input(z.object({ documentId: z.string() }))
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

      // TODO: 实现快照查询
      // const snapshots = await db
      //   .select()
      //   .from(documentSnapshots)
      //   .where(eq(documentSnapshots.documentId, input.documentId))
      //   .orderBy(desc(documentSnapshots.version));

      return {
        versions: [], // 暂时返回空数组
        currentVersion: 1,
      };
    }),

  // 按文档增量获取操作日志
  getDocumentOperations: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      sinceVersion: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(200).default(100),
    }))
    .query(async ({ ctx, input }) => {
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

      const conditions = [
        eq(operations.documentId, input.documentId),
        input.sinceVersion > 0
          ? gt(operations.version, input.sinceVersion)
          : sql`TRUE`,
      ];

      const ops = await db
        .select()
        .from(operations)
        .where(and(...conditions))
        .orderBy(asc(operations.version))
        .limit(input.limit);

      const latestVersion = ops.length > 0
        ? ops[ops.length - 1].version
        : input.sinceVersion;

      return {
        operations: ops,
        latestVersion,
      };
    }),

  acceptDocumentInvite: protectedProcedure
    .input(z.object({
      documentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, input.documentId));

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "文档不存在" });
      }

      const [existing] = await db
        .select()
        .from(documentCollaborators)
        .where(and(eq(documentCollaborators.documentId, input.documentId), eq(documentCollaborators.userId, ctx.user.id)));

      if (existing) {
        await db
          .update(documentCollaborators)
          .set({ role: "owner" })
          .where(eq(documentCollaborators.id, existing.id));
      } else {
        await db
          .insert(documentCollaborators)
          .values({
            documentId: input.documentId,
            userId: ctx.user.id,
            role: "owner",
          });
      }

      return { mode: "collaborator", documentId: input.documentId };
    }),

  duplicateDocument: protectedProcedure
    .input(z.object({
      documentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, input.documentId), eq(documents.ownerId, ctx.user.id)));

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "文档不存在或无权限" });
      }

      let [personalWs] = await db
        .select()
        .from(workspaces)
        .where(and(eq(workspaces.ownerId, ctx.user.id), eq(workspaces.isPersonal, true)))
        .limit(1);

      if (!personalWs) {
        [personalWs] = await db
          .insert(workspaces)
          .values({
            name: "我的工作区",
            ownerId: ctx.user.id,
            isPersonal: true,
            permissions: { public: false, team: true },
            metadata: {},
          })
          .returning();
      }

      const [newDoc] = await db
        .insert(documents)
        .values({
          title: doc.title,
          workspaceId: personalWs.id,
          ownerId: ctx.user.id,
          isTemplate: doc.isTemplate,
          isArchived: false,
          permissions: doc.permissions,
          metadata: doc.metadata,
        })
        .returning();

      const originalBlocks = await db
        .select()
        .from(blocks)
        .where(eq(blocks.documentId, input.documentId));

      if (originalBlocks.length > 0) {
        for (const b of originalBlocks) {
          await db.insert(blocks).values({
            documentId: newDoc.id,
            parentId: b.parentId,
            type: b.type,
            content: b.content,
            properties: b.properties,
            position: b.position,
            version: 1,
            createdBy: ctx.user.id,
          });
        }
      }

      return newDoc;
    }),

  shareDocumentToUser: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      targetUsername: z.string(),
      copyToPersonal: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, input.documentId), eq(documents.ownerId, ctx.user.id)));

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "文档不存在或无权限" });
      }

      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.username, input.targetUsername));

      if (!target) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "目标用户不存在" });
      }

      if (input.copyToPersonal) {
        let [personalWs] = await db
          .select()
          .from(workspaces)
          .where(and(eq(workspaces.ownerId, target.id), eq(workspaces.isPersonal, true)))
          .limit(1);

        if (!personalWs) {
          [personalWs] = await db
            .insert(workspaces)
            .values({
              name: "我的工作区",
              ownerId: target.id,
              isPersonal: true,
              permissions: { public: false, team: true },
              metadata: {},
            })
            .returning();
        }

        const [newDoc] = await db
          .insert(documents)
          .values({
            title: doc.title,
            workspaceId: personalWs.id,
            ownerId: target.id,
            isTemplate: doc.isTemplate,
            isArchived: false,
            permissions: doc.permissions,
            metadata: doc.metadata,
          })
          .returning();

        const originalBlocks = await db
          .select()
          .from(blocks)
          .where(eq(blocks.documentId, input.documentId));

        if (originalBlocks.length > 0) {
          for (const b of originalBlocks) {
            await db.insert(blocks).values({
              documentId: newDoc.id,
              parentId: b.parentId,
              type: b.type,
              content: b.content,
              properties: b.properties,
              position: b.position,
              version: 1,
              createdBy: target.id,
            });
          }
        }

        return { newDocumentId: newDoc.id };
      } else {
        const [existing] = await db
          .select()
          .from(documentCollaborators)
          .where(and(eq(documentCollaborators.documentId, input.documentId), eq(documentCollaborators.userId, target.id)));

        if (existing) {
          await db
            .update(documentCollaborators)
            .set({ role: "owner" })
            .where(eq(documentCollaborators.id, existing.id));
          return { sharedAsCollaborator: true };
        }

        await db
          .insert(documentCollaborators)
          .values({
            documentId: input.documentId,
            userId: target.id,
            role: "owner",
          });

        return { sharedAsCollaborator: true };
      }
    }),
});
