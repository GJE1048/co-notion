import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { db } from "@/db";
import { workspaces, documents, tags, documentTags, users, workspaceMembers } from "@/db/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { DEFAULT_WORKSPACE_PERMISSIONS, ensurePersonalWorkspace } from "@/lib/workspace";

const createWorkspaceSchema = z.object({
  name: z.string().min(1, "工作区名称不能为空"),
  isPersonal: z.boolean().default(true),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1, "工作区名称不能为空").optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
});

const createTagSchema = z.object({
  name: z.string().min(1, "标签名称不能为空"),
  color: z.string().default("#6B7280"),
  category: z.string().optional(),
  workspaceId: z.string().optional(),
});

export const workspacesRouter = createTRPCRouter({
  // 获取用户的所有工作区（通过 clerkId 关联）
  getUserWorkspaces: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          ownerId: workspaces.ownerId,
          isPersonal: workspaces.isPersonal,
          permissions: workspaces.permissions,
          createdAt: workspaces.createdAt,
          updatedAt: workspaces.updatedAt,
          memberRole: workspaceMembers.role,
        })
        .from(workspaces)
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(or(eq(workspaces.ownerId, ctx.user.id), eq(workspaceMembers.userId, ctx.user.id)))
        .orderBy(desc(workspaces.createdAt));

      return result.map(r => {
        const isOwner = r.ownerId === ctx.user.id;
        let userRole: "creator" | "admin" | "viewer";

        if (isOwner) {
          userRole = "creator";
        } else if (r.memberRole === "admin") {
          userRole = "admin";
        } else {
          userRole = "viewer";
        }

        return {
          id: r.id,
          name: r.name,
          isPersonal: r.isPersonal,
          permissions: r.permissions,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          userRole,
        };
      });
    }),

  // 获取单个工作区详情（通过 clerkId 关联）
  getWorkspace: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [workspace] = await db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          isPersonal: workspaces.isPersonal,
          permissions: workspaces.permissions,
          createdAt: workspaces.createdAt,
          updatedAt: workspaces.updatedAt,
        })
        .from(workspaces)
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(
          eq(workspaces.id, input.id),
          or(eq(workspaces.ownerId, ctx.user.id), eq(workspaceMembers.userId, ctx.user.id))
        ));

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "工作区不存在",
        });
      }

      return workspace;
    }),

  // 创建工作区
  createWorkspace: protectedProcedure
    .input(createWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      const [newWorkspace] = await db
        .insert(workspaces)
        .values({
          name: input.name,
          ownerId: ctx.user.id,
          isPersonal: input.isPersonal,
          permissions: DEFAULT_WORKSPACE_PERMISSIONS,
          metadata: {},
        })
        .returning();

      return newWorkspace;
    }),

  // 更新工作区（通过 clerkId 关联）
  updateWorkspace: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: updateWorkspaceSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // 先验证工作区权限（通过 clerkId）
      const [existingWorkspace] = await db
        .select({
          workspace: workspaces,
        })
        .from(workspaces)
        .where(and(
          eq(workspaces.id, input.id),
          eq(workspaces.ownerId, ctx.user.id)
        ));

      if (!existingWorkspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "工作区不存在",
        });
      }

      const [updatedWorkspace] = await db
        .update(workspaces)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, input.id))
        .returning();

      return updatedWorkspace;
    }),

  // 删除工作区（通过 clerkId 关联）
  deleteWorkspace: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 先验证工作区权限（通过 clerkId）
      const [existingWorkspace] = await db
        .select({
          workspace: workspaces,
        })
        .from(workspaces)
        .where(and(
          eq(workspaces.id, input.id),
          eq(workspaces.ownerId, ctx.user.id)
        ));

      if (!existingWorkspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "工作区不存在",
        });
      }

      // 检查工作区是否有文档
      const documentsCount = await db
        .select({ count: documents.id })
        .from(documents)
        .where(eq(documents.workspaceId, input.id));

      if (documentsCount.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "无法删除包含文档的工作区",
        });
      }

      await db
        .delete(workspaces)
        .where(eq(workspaces.id, input.id));

      return { success: true };
    }),

  // 获取工作区的文档（通过 clerkId 关联）
  getWorkspaceDocuments: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 验证工作区权限（通过 clerkId）
      const [workspaceResult] = await db
        .select({
          workspace: workspaces,
        })
        .from(workspaces)
        .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(
          eq(workspaces.id, input.workspaceId),
          or(eq(workspaces.ownerId, ctx.user.id), eq(workspaceMembers.userId, ctx.user.id))
        ));

      if (!workspaceResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "工作区不存在",
        });
      }

      const workspaceDocuments = await db
        .select({
          id: documents.id,
          title: documents.title,
          isArchived: documents.isArchived,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(eq(documents.workspaceId, input.workspaceId))
        .orderBy(desc(documents.updatedAt));

      return workspaceDocuments;
    }),

  // 创建标签
  createTag: protectedProcedure
    .input(createTagSchema)
    .mutation(async ({ ctx, input }) => {
      let workspaceId = input.workspaceId;

      if (!workspaceId) {
        const personalWorkspace = await ensurePersonalWorkspace(ctx.user.id);
        workspaceId = personalWorkspace.id;
      }

      // 验证工作区权限（通过 clerkId）
      const [workspaceResult] = await db
        .select({
          workspace: workspaces,
        })
        .from(workspaces)
        .where(and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.ownerId, ctx.user.id)
        ));

      if (!workspaceResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "工作区不存在",
        });
      }

      const [newTag] = await db
        .insert(tags)
        .values({
          name: input.name,
          color: input.color,
          category: input.category,
          workspaceId,
          usage: 0,
        })
        .returning();

      return newTag;
    }),

  // 获取工作区的标签（通过 clerkId 关联）
  getWorkspaceTags: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 验证工作区权限（通过 clerkId）
      const [workspaceResult] = await db
        .select({
          workspace: workspaces,
        })
        .from(workspaces)
        .where(and(
          eq(workspaces.id, input.workspaceId),
          eq(workspaces.ownerId, ctx.user.id)
        ));

      if (!workspaceResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "工作区不存在",
        });
      }

      const workspaceTags = await db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          category: tags.category,
          usage: tags.usage,
          createdAt: tags.createdAt,
        })
        .from(tags)
        .where(eq(tags.workspaceId, input.workspaceId))
        .orderBy(desc(tags.usage), desc(tags.createdAt));

      return workspaceTags;
    }),

  // 为文档添加标签
  addDocumentTag: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      tagId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 验证文档权限
      const [document] = await db
        .select({
          document: documents,
          workspace: workspaces,
        })
        .from(documents)
        .innerJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .where(and(
          eq(documents.id, input.documentId),
          eq(documents.ownerId, ctx.user.id)
        ));

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      // 验证标签权限
      const [tag] = await db
        .select()
        .from(tags)
        .where(and(
          eq(tags.id, input.tagId),
          eq(tags.workspaceId, document.workspace.id)
        ));

      if (!tag) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "标签不存在",
        });
      }

      // 检查是否已经存在
      const [existingTag] = await db
        .select()
        .from(documentTags)
        .where(and(
          eq(documentTags.documentId, input.documentId),
          eq(documentTags.tagId, input.tagId)
        ));

      if (existingTag) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "文档已经拥有此标签",
        });
      }

      await db.insert(documentTags).values({
        documentId: input.documentId,
        tagId: input.tagId,
        addedBy: ctx.user.id,
      });

      // 更新标签使用次数
      await db
        .update(tags)
        .set({ usage: tag.usage + 1 })
        .where(eq(tags.id, input.tagId));

      return { success: true };
    }),

  acceptWorkspaceInvite: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
    }))
    .mutation(async ({ ctx, input }) => {
      const [ws] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, input.workspaceId));

      if (!ws) {
        throw new TRPCError({ code: "NOT_FOUND", message: "工作区不存在" });
      }

      const [existing] = await db
        .select()
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, ctx.user.id)));

      if (existing) {
        await db
          .update(workspaceMembers)
          .set({ role: input.role })
          .where(eq(workspaceMembers.id, existing.id));
        return { success: true, joined: false };
      }

      await db
        .insert(workspaceMembers)
        .values({
          workspaceId: input.workspaceId,
          userId: ctx.user.id,
          role: input.role,
        });

      return { success: true, joined: true };
    }),

  // 从文档移除标签
  removeDocumentTag: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      tagId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 验证文档权限
      const [document] = await db
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, input.documentId),
          eq(documents.ownerId, ctx.user.id)
        ));

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      // 删除标签关联
      await db
        .delete(documentTags)
        .where(and(
          eq(documentTags.documentId, input.documentId),
          eq(documentTags.tagId, input.tagId)
        ));

      // 更新标签使用次数
      await db
        .update(tags)
        .set({ usage: sql`${tags.usage} - 1` })
        .where(eq(tags.id, input.tagId));

      return { success: true };
    }),

  // 获取文档的标签
  getDocumentTags: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 验证文档权限
      const [document] = await db
        .select()
        .from(documents)
        .where(and(
          eq(documents.id, input.documentId),
          eq(documents.ownerId, ctx.user.id)
        ));

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      const documentTagList = await db
        .select({
          id: documentTags.id,
          tag: {
            id: tags.id,
            name: tags.name,
            color: tags.color,
            category: tags.category,
          },
          addedAt: documentTags.addedAt,
        })
        .from(documentTags)
        .innerJoin(tags, eq(documentTags.tagId, tags.id))
        .where(eq(documentTags.documentId, input.documentId))
        .orderBy(desc(documentTags.addedAt));

      return documentTagList;
    }),
});
