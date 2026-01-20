import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { db } from "@/db";
import { documents, blocks, workspaces, operations, users, documentCollaborators, workspaceMembers, integrationAccounts } from "@/db/schema";
import { eq, and, desc, asc, sql, gt, or, inArray, SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyDocumentUpdated } from "@/realtime/notify";
import { ensurePersonalWorkspace } from "@/lib/workspace";
import { redis } from "@/lib/redis";
import { encrypt, decrypt } from "@/lib/crypto";

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

type DocumentAccessRecord = {
  document: typeof documents.$inferSelect;
  workspace: typeof workspaces.$inferSelect | null;
  collaborator: typeof documentCollaborators.$inferSelect | null;
  workspaceMember: typeof workspaceMembers.$inferSelect | null;
};

type ShareLogEntry = {
  message: string;
  type: "share" | "revoke";
  createdAt: string;
};

type DocumentMetadata = Record<string, unknown> & {
  shareLogs?: ShareLogEntry[];
};

const appendDocumentShareLog = async (documentId: string, entry: ShareLogEntry) => {
  const [doc] = await db
    .select({
      metadata: documents.metadata,
    })
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) {
    return;
  }

  const metadata = (doc.metadata ?? {}) as DocumentMetadata;
  const existingLogs = Array.isArray(metadata.shareLogs)
    ? metadata.shareLogs
    : [];

  const nextMetadata: DocumentMetadata = {
    ...metadata,
    shareLogs: [...existingLogs, entry],
  };

  await db
    .update(documents)
    .set({
      metadata: nextMetadata,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  if (redis) {
    await redis.del(`doc:${documentId}`);
  }
};

const canManageDocument = (record: DocumentAccessRecord | undefined, userId: string) => {
  if (!record) return false;
  const { document, workspace, collaborator, workspaceMember } = record;
  if (!document) return false;
  if (document.ownerId === userId) return true;
  if (workspace && workspace.ownerId === userId) return true;
  if (collaborator && collaborator.userId === userId && collaborator.role === "owner") return true;
  if (workspaceMember && workspaceMember.userId === userId && workspaceMember.role === "admin") return true;
  return false;
};

const canEditDocumentFromAccess = (record: DocumentAccessRecord | undefined, userId: string) => {
  if (!record) return false;
  const { document, workspace, collaborator, workspaceMember } = record;
  if (!document) return false;
  if (document.ownerId === userId) return true;
  if (workspace && (workspace.ownerId === userId)) return true;
  if (collaborator && collaborator.userId === userId && (collaborator.role === "owner" || collaborator.role === "editor")) return true;
  if (workspaceMember && workspaceMember.userId === userId && (workspaceMember.role === "admin" || workspaceMember.role === "editor")) return true;
  return false;
};

const DOCUMENT_CACHE_TTL_SECONDS = 60;
const BLOCKS_FIRST_PAGE_TTL_SECONDS = 60;

const wordpressAuthSchema = z.object({
  siteUrl: z.string().url(),
  authType: z.enum(["application_password"]),
  username: z.string().min(1),
  applicationPassword: z.string().min(1),
});

type WordpressAuthInput = z.infer<typeof wordpressAuthSchema>;

type WordpressValidationResult = {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
  user?: {
    id?: number | string;
    name?: string;
    slug?: string;
  };
};

const normalizeSiteUrl = (siteUrl: string) => {
  return siteUrl.trim().replace(/\/+$/, "");
};

const validateWordpressCredentials = async (input: WordpressAuthInput): Promise<WordpressValidationResult> => {
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  const authString = `${input.username}:${input.applicationPassword}`;
  const basic = Buffer.from(authString, "utf8").toString("base64");

  let response: Response;
  try {
    response = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      errorMessage: "无法连接到 WordPress 站点",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      errorCode: "INVALID_CREDENTIALS",
      errorMessage: "WordPress 凭证无效",
      httpStatus: response.status,
      user: undefined,
    };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  const anyData = data as { id?: number | string; name?: string; slug?: string; username?: string } | null;

  return {
    ok: true,
    user: anyData
      ? {
          id: anyData.id,
          name: anyData.name || anyData.username,
          slug: anyData.slug,
        }
      : undefined,
  };
};

const escapeHtml = (value: string) => {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const uploadMediaToWordpress = async (
  site: typeof integrationAccounts.$inferSelect,
  imageUrl: string
): Promise<string | null> => {
  const siteUrl = normalizeSiteUrl(site.siteUrl || "");
  const credential = site.credentials as {
    authType?: string;
    username?: string;
    applicationPassword?: string;
    encryptedPassword?: string;
    accessToken?: string;
  };
  
  let authHeader = "";
  if (credential.authType === "oauth" && credential.accessToken) {
    authHeader = `Bearer ${credential.accessToken}`;
  } else {
    const password = credential.applicationPassword || (credential.encryptedPassword ? decrypt(credential.encryptedPassword) : "");
    const authString = `${credential.username}:${password}`;
    const basic = Buffer.from(authString, "utf8").toString("base64");
    authHeader = `Basic ${basic}`;
  }

  try {
    let buffer: Buffer;
    let filename = "image.png";
    let contentType = "image/png";

    if (imageUrl.startsWith("data:")) {
      // Handle Data URI
      const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return null;
      }
      contentType = matches[1];
      buffer = Buffer.from(matches[2], "base64");
      const ext = contentType.split("/")[1] || "png";
      filename = `upload-${Date.now()}.${ext}`;
    } else {
      // Handle Remote URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get("content-type") || "image/png";
      const urlPath = new URL(imageUrl).pathname;
      const urlFilename = urlPath.split("/").pop();
      if (urlFilename && urlFilename.includes(".")) {
        filename = urlFilename;
      } else {
        const ext = contentType.split("/")[1] || "png";
        filename = `upload-${Date.now()}.${ext}`;
      }
    }

    const response = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": contentType,
      },
      body: buffer as unknown as BodyInit,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { source_url?: string };
    return data.source_url || null;
  } catch (e) {
    console.error("Failed to upload media to WordPress", e);
    return null;
  }
};

const exportDocumentToHtml = async (
  documentId: string,
  imageHandler?: (url: string) => Promise<string | null>
) => {
  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
    })
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "文档不存在",
    });
  }

  const rows = await db
    .select({
      id: blocks.id,
      type: blocks.type,
      content: blocks.content,
      position: blocks.position,
    })
    .from(blocks)
    .where(eq(blocks.documentId, documentId))
    .orderBy(asc(blocks.position));

  const htmlParts: string[] = [];

  for (const row of rows) {
    const type = row.type;
    const content = row.content as unknown;

    if (type === "heading_1" || type === "heading_2" || type === "heading_3" || type === "paragraph" || type === "quote") {
      const value = content as { text?: { content?: string } };
      const text = escapeHtml(value.text?.content ?? "");
      if (!text) {
        continue;
      }
      if (type === "heading_1") {
        htmlParts.push(`<h1>${text}</h1>`);
      } else if (type === "heading_2") {
        htmlParts.push(`<h2>${text}</h2>`);
      } else if (type === "heading_3") {
        htmlParts.push(`<h3>${text}</h3>`);
      } else if (type === "quote") {
        htmlParts.push(`<blockquote>${text}</blockquote>`);
      } else {
        htmlParts.push(`<p>${text}</p>`);
      }
      continue;
    }

    if (type === "list") {
      const value = content as { list?: { items?: string[] } };
      const items = value.list?.items ?? [];
      if (!items.length) {
        continue;
      }
      const inner = items.map((item) => `<li>${escapeHtml(item ?? "")}</li>`).join("");
      htmlParts.push(`<ul>${inner}</ul>`);
      continue;
    }

    if (type === "todo") {
      const value = content as { todo?: { items?: { text?: string; checked?: boolean }[] } };
      const items = value.todo?.items ?? [];
      if (!items.length) {
        continue;
      }
      const inner = items
        .map((item) => {
          const text = escapeHtml(item.text ?? "");
          const checked = item.checked ? "true" : "false";
          return `<li data-checked="${checked}">${text}</li>`;
        })
        .join("");
      htmlParts.push(`<ul class="todo-list">${inner}</ul>`);
      continue;
    }

    if (type === "code") {
      const value = content as { code?: { content?: string; language?: string } };
      const codeText = escapeHtml(value.code?.content ?? "");
      const language = value.code?.language || "plaintext";
      htmlParts.push(`<pre><code class="language-${escapeHtml(language)}">${codeText}</code></pre>`);
      continue;
    }

    if (type === "image") {
      const value = content as { image?: { url?: string; caption?: string } };
      let url = value.image?.url;
      if (!url) {
        continue;
      }

      if (imageHandler) {
        const uploadedUrl = await imageHandler(url);
        if (uploadedUrl) {
          url = uploadedUrl;
        }
      }

      const safeUrl = escapeHtml(url);
      const caption = value.image?.caption ? escapeHtml(value.image.caption) : "";
      const captionHtml = caption ? `<figcaption>${caption}</figcaption>` : "";
      htmlParts.push(`<figure><img src="${safeUrl}" alt="${caption}" />${captionHtml}</figure>`);
      continue;
    }
  }

  const html = htmlParts.join("\n");

  return {
    title: doc.title,
    html,
  };
};

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

  getCurrentUserProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id));

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户不存在",
        });
      }

      return user;
    }),

  // 获取单个文档详情
  getDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const cacheKey = `doc:${input.id}`;

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const cachedDoc = cached as {
            id: string;
            title: string;
            workspaceId: string | null;
            ownerId: string;
            isTemplate: boolean;
            isArchived: boolean;
            permissions: unknown;
            metadata: unknown;
            yjsState: string | null;
            createdAt: string | Date;
            updatedAt: string | Date;
            workspace: {
              id: string | null;
              name: string | null;
            } | null;
          };

          return {
            ...cachedDoc,
            createdAt: new Date(cachedDoc.createdAt),
            updatedAt: new Date(cachedDoc.updatedAt),
          };
        }
      }

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
          yjsState: documents.yjsState,
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

      if (redis) {
        await redis.set(cacheKey, document, { ex: DOCUMENT_CACHE_TTL_SECONDS });
      }

      return document;
    }),

  getDocumentMembers: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [documentRecord] = await db
        .select({
          document: documents,
          workspace: workspaces,
        })
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

      if (!documentRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      const document = documentRecord.document;
      const workspace = documentRecord.workspace;

      const membersMap = new Map<string, {
        id: string;
        username: string;
        imageUrl: string;
        isDocumentOwner: boolean;
        workspaceRole: string | null;
        documentRole: string | null;
      }>();

      const documentOwner = await db
        .select({
          id: users.id,
          username: users.username,
          imageUrl: users.imageUrl,
        })
        .from(users)
        .where(eq(users.id, document.ownerId));

      if (documentOwner[0]) {
        membersMap.set(documentOwner[0].id, {
          id: documentOwner[0].id,
          username: documentOwner[0].username,
          imageUrl: documentOwner[0].imageUrl,
          isDocumentOwner: true,
          workspaceRole: workspace && workspace.ownerId === documentOwner[0].id ? "creator" : null,
          documentRole: "owner",
        });
      }

      if (workspace) {
        const workspaceMembersWithUser = await db
          .select({
            id: users.id,
            username: users.username,
            imageUrl: users.imageUrl,
            role: workspaceMembers.role,
          })
          .from(workspaceMembers)
          .innerJoin(users, eq(workspaceMembers.userId, users.id))
          .where(eq(workspaceMembers.workspaceId, workspace.id));

        for (const wm of workspaceMembersWithUser) {
          const existing = membersMap.get(wm.id);
          membersMap.set(wm.id, {
            id: wm.id,
            username: wm.username,
            imageUrl: wm.imageUrl,
            isDocumentOwner: existing ? existing.isDocumentOwner : false,
            workspaceRole: wm.role,
            documentRole: existing ? existing.documentRole : null,
          });
        }
      }

      const collaboratorsWithUser = await db
        .select({
          id: users.id,
          username: users.username,
          imageUrl: users.imageUrl,
          role: documentCollaborators.role,
        })
        .from(documentCollaborators)
        .innerJoin(users, eq(documentCollaborators.userId, users.id))
        .where(eq(documentCollaborators.documentId, document.id));

      for (const collab of collaboratorsWithUser) {
        const existing = membersMap.get(collab.id);
        membersMap.set(collab.id, {
          id: collab.id,
          username: collab.username,
          imageUrl: collab.imageUrl,
          isDocumentOwner: existing ? existing.isDocumentOwner : false,
          workspaceRole: existing ? existing.workspaceRole : null,
          documentRole: collab.role,
        });
      }

      const members = Array.from(membersMap.values());

      members.sort((a, b) => {
        if (a.isDocumentOwner && !b.isDocumentOwner) return -1;
        if (!a.isDocumentOwner && b.isDocumentOwner) return 1;
        if (a.workspaceRole === "admin" && b.workspaceRole !== "admin") return -1;
        if (a.workspaceRole !== "admin" && b.workspaceRole === "admin") return 1;
        return a.username.localeCompare(b.username, "zh-CN");
      });

      return { members };
    }),

  // 创建新文档（支持基于模板复制）
  createDocument: protectedProcedure
    .input(createDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      let workspaceId = input.workspaceId;
      if (!workspaceId) {
        const personalWorkspace = await ensurePersonalWorkspace(ctx.user.id);
        workspaceId = personalWorkspace.id;
      }

      let templateDocument: typeof documents.$inferSelect | null = null;
      let templateBlocks: typeof blocks.$inferSelect[] = [];

      if (input.templateId) {
        const [doc] = await db
          .select()
          .from(documents)
          .where(and(
            eq(documents.isTemplate, true),
            sql`${documents.metadata}->>'templateKey' = ${input.templateId}`
          ));

        if (doc) {
          templateDocument = doc;

          templateBlocks = await db
            .select()
            .from(blocks)
            .where(eq(blocks.documentId, doc.id))
            .orderBy(blocks.position);
        }
      }

      const [newDocument] = await db
        .insert(documents)
        .values({
          title: input.title,
          workspaceId,
          ownerId: ctx.user.id,
          isTemplate: false,
          isArchived: false,
          permissions: templateDocument ? templateDocument.permissions : { public: false, team: true },
          metadata: templateDocument ? templateDocument.metadata : {},
        })
        .returning();

      if (templateBlocks.length > 0) {
        await db.insert(blocks).values(
          templateBlocks.map((b) => ({
            documentId: newDocument.id,
            parentId: b.parentId,
            type: b.type,
            content: b.content,
            properties: b.properties,
            position: b.position,
            version: 1,
            createdBy: ctx.user.id,
          })),
        );
      } else {
        await db.insert(blocks).values({
          documentId: newDocument.id,
          type: 'heading_1',
          content: { text: { content: input.title } },
          properties: {},
          position: 0,
          version: 1,
          createdBy: ctx.user.id,
        });
      }

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

      if (redis) {
        await redis.del(`doc:${input.id}`);
        await redis.del(`blocks:${input.id}:page:1`);
      }

      return updatedDocument;
    }),

  // 删除文档（软删除）
  deleteDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existingDocument] = await db
        .select({
          document: documents,
          workspace: workspaces,
          collaborator: documentCollaborators,
          workspaceMember: workspaceMembers,
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

      if (!existingDocument) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

       if (!canManageDocument(existingDocument, ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "无权限删除文档",
        });
      }

      await db
        .update(documents)
        .set({
          isArchived: true,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, input.id));

      if (redis) {
        await redis.del(`doc:${input.id}`);
        await redis.del(`blocks:${input.id}:page:1`);
      }

      return { success: true };
    }),

  getDocumentBlocks: protectedProcedure
    .input(z.object({ documentId: z.string() }))
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

  getDocumentBlocksPage: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      cursor: z.number().int().nonnegative().optional(),
      limit: z.number().int().positive().max(200).optional(),
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

      const limit = input.limit ?? 30;
      const offset = input.cursor ?? 0;

      if (redis && offset === 0 && limit === 30) {
        const cacheKey = `blocks:${input.documentId}:page:1`;
        const cached = await redis.get(cacheKey);
        if (cached) {
          const cachedResult = cached as {
            blocks: (typeof blocks.$inferSelect & {
              createdAt: string | Date;
              updatedAt: string | Date;
            })[];
            total: number;
            cursor: number;
            nextCursor: number | null;
            hasMore: boolean;
          };

          const hydratedBlocks = cachedResult.blocks.map((b) => ({
            ...b,
            createdAt: new Date(b.createdAt),
            updatedAt: new Date(b.updatedAt),
          }));

          return {
            blocks: hydratedBlocks,
            total: cachedResult.total,
            cursor: cachedResult.cursor,
            nextCursor: cachedResult.nextCursor,
            hasMore: cachedResult.hasMore,
          };
        }
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(blocks)
        .where(eq(blocks.documentId, input.documentId));

      const total = Number(countResult?.count ?? 0);

      const documentBlocks = await db
        .select()
        .from(blocks)
        .where(eq(blocks.documentId, input.documentId))
        .orderBy(asc(blocks.position))
        .limit(limit)
        .offset(offset);

      const hasMore = offset + documentBlocks.length < total;
      const nextCursor = hasMore ? offset + documentBlocks.length : null;

      const result = {
        blocks: documentBlocks,
        total,
        cursor: offset,
        nextCursor,
        hasMore,
      };

      if (redis && offset === 0 && limit === 30) {
        const cacheKey = `blocks:${input.documentId}:page:1`;
        await redis.set(cacheKey, result, { ex: BLOCKS_FIRST_PAGE_TTL_SECONDS });
      }

      return result;
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

      void notifyDocumentUpdated(input.documentId, nextVersion);

      if (redis) {
        await redis.del(`blocks:${input.documentId}:page:1`);
      }

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
          : undefined,
      ];

      const validConditions = conditions.filter((c): c is SQL => c !== undefined);

      const ops = await db
        .select()
        .from(operations)
        .where(and(...validConditions))
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
          .set({ role: "editor" })
          .where(eq(documentCollaborators.id, existing.id));
      } else {
        await db
          .insert(documentCollaborators)
          .values({
            documentId: input.documentId,
            userId: ctx.user.id,
            role: "editor",
          });
      }

      return { mode: "collaborator", documentId: input.documentId };
    }),

  duplicateDocument: protectedProcedure
    .input(z.object({
      documentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [access] = await db
        .select({
          document: documents,
          workspace: workspaces,
          collaborator: documentCollaborators,
          workspaceMember: workspaceMembers,
        })
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

      if (!access) {
        throw new TRPCError({ code: "NOT_FOUND", message: "文档不存在" });
      }

      if (!canManageDocument(access, ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权限复制文档" });
      }

      const doc = access.document;

      const personalWs = await ensurePersonalWorkspace(ctx.user.id);

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
      const [access] = await db
        .select({
          document: documents,
          workspace: workspaces,
          collaborator: documentCollaborators,
          workspaceMember: workspaceMembers,
        })
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

      if (!access) {
        throw new TRPCError({ code: "NOT_FOUND", message: "文档不存在" });
      }

      if (!canManageDocument(access, ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权限分享文档" });
      }

      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.username, input.targetUsername));

      if (!target) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "目标用户不存在" });
      }

      const doc = access.document;

      const [currentUser] = await db
        .select({
          id: users.id,
          username: users.username,
        })
        .from(users)
        .where(eq(users.id, ctx.user.id));

      const actorName = currentUser?.username || "未知用户";
      const documentTitle = doc.title || "未命名文档";

      if (input.copyToPersonal) {
        const personalWs = await ensurePersonalWorkspace(target.id);

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

        await appendDocumentShareLog(input.documentId, {
          message: `${actorName} 将文档《${documentTitle}》分享给 ${target.username}（复制到对方个人工作区）`,
          type: "share",
          createdAt: new Date().toISOString(),
        });

        return { newDocumentId: newDoc.id };
      } else {
        const [existing] = await db
          .select()
          .from(documentCollaborators)
          .where(and(eq(documentCollaborators.documentId, input.documentId), eq(documentCollaborators.userId, target.id)));

        if (existing) {
          await db
            .update(documentCollaborators)
            .set({ role: "editor" })
            .where(eq(documentCollaborators.id, existing.id));

          await appendDocumentShareLog(input.documentId, {
            message: `${actorName} 将文档《${documentTitle}》分享给 ${target.username}`,
            type: "share",
            createdAt: new Date().toISOString(),
          });

          return { sharedAsCollaborator: true };
        }

        await db
          .insert(documentCollaborators)
          .values({
            documentId: input.documentId,
            userId: target.id,
            role: "editor",
          });

        await appendDocumentShareLog(input.documentId, {
          message: `${actorName} 将文档《${documentTitle}》分享给 ${target.username}`,
          type: "share",
          createdAt: new Date().toISOString(),
        });

        return { sharedAsCollaborator: true };
      }
    }),
  getSharedDocumentsByMe: protectedProcedure
    .query(async ({ ctx }) => {
      const sharedDocsRaw = await db
        .select({
          id: documents.id,
          title: documents.title,
          workspaceId: documents.workspaceId,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
          workspace: {
            id: workspaces.id,
            name: workspaces.name,
          },
          metadata: documents.metadata,
        })
        .from(documents)
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .innerJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .where(eq(documents.ownerId, ctx.user.id))
        .orderBy(desc(documents.updatedAt));

      if (sharedDocsRaw.length === 0) {
        return [];
      }

      const documentIds = sharedDocsRaw.map((d) => d.id);

      const collaborators = await db
        .select({
          documentId: documentCollaborators.documentId,
          userId: users.id,
          username: users.username,
          imageUrl: users.imageUrl,
          role: documentCollaborators.role,
          createdAt: documentCollaborators.createdAt,
        })
        .from(documentCollaborators)
        .innerJoin(users, eq(documentCollaborators.userId, users.id))
        .where(and(
          inArray(documentCollaborators.documentId, documentIds),
          eq(users.id, users.id),
        ));

      const grouped = sharedDocsRaw.map((doc) => {
        const metadata = (doc.metadata ?? {}) as DocumentMetadata;
        const shareLogs = Array.isArray(metadata.shareLogs) ? metadata.shareLogs : [];
        return {
          id: doc.id,
          title: doc.title,
          workspaceId: doc.workspaceId,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          workspace: doc.workspace,
          collaborators: collaborators
            .filter((c) => c.documentId === doc.id && c.userId !== ctx.user.id)
            .map((c) => ({
              userId: c.userId,
              username: c.username,
              imageUrl: c.imageUrl,
              role: c.role,
              createdAt: c.createdAt,
            })),
          shareLogs,
        };
      });

      return grouped;
    }),
  getDocumentsSharedWithMe: protectedProcedure
    .query(async ({ ctx }) => {
      const docs = await db
        .select({
          id: documents.id,
          title: documents.title,
          workspaceId: documents.workspaceId,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
          workspace: {
            id: workspaces.id,
            name: workspaces.name,
          },
          ownerId: documents.ownerId,
          ownerUsername: users.username,
          ownerImageUrl: users.imageUrl,
          collaboratorRole: documentCollaborators.role,
          sharedAt: documentCollaborators.createdAt,
          metadata: documents.metadata,
        })
        .from(documents)
        .leftJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .innerJoin(documentCollaborators, eq(documentCollaborators.documentId, documents.id))
        .innerJoin(users, eq(documents.ownerId, users.id))
        .where(eq(documentCollaborators.userId, ctx.user.id))
        .orderBy(desc(documents.updatedAt));

      if (docs.length === 0) {
        return [];
      }

      return docs.map((doc) => {
        const metadata = (doc.metadata ?? {}) as DocumentMetadata;
        const shareLogs = Array.isArray(metadata.shareLogs) ? metadata.shareLogs : [];
        return {
          id: doc.id,
          title: doc.title,
          workspaceId: doc.workspaceId,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          workspace: doc.workspace,
          owner: {
            id: doc.ownerId,
            username: doc.ownerUsername,
            imageUrl: doc.ownerImageUrl,
          },
          collaboratorRole: doc.collaboratorRole,
          sharedAt: doc.sharedAt,
          shareLogs,
        };
      });
    }),
  updateCollaboratorRole: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      userId: z.string(),
      role: z.enum(["owner", "editor", "viewer"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const [access] = await db
        .select({
          document: documents,
          workspace: workspaces,
          collaborator: documentCollaborators,
          workspaceMember: workspaceMembers,
        })
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
          ),
        ));

      if (!access) {
        throw new TRPCError({ code: "NOT_FOUND", message: "文档不存在" });
      }

      if (!canManageDocument(access, ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权限修改协作者权限" });
      }

      await db
        .update(documentCollaborators)
        .set({ role: input.role })
        .where(and(
          eq(documentCollaborators.documentId, input.documentId),
          eq(documentCollaborators.userId, input.userId),
        ));

      return { success: true };
    }),
  removeCollaborator: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [access] = await db
        .select({
          document: documents,
          workspace: workspaces,
          collaborator: documentCollaborators,
          workspaceMember: workspaceMembers,
        })
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
          ),
        ));

      if (!access) {
        throw new TRPCError({ code: "NOT_FOUND", message: "文档不存在" });
      }

      if (!canManageDocument(access, ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权限撤回文档分享" });
      }

      const [targetUser] = await db
        .select({
          id: users.id,
          username: users.username,
        })
        .from(users)
        .where(eq(users.id, input.userId));

      const [currentUser] = await db
        .select({
          id: users.id,
          username: users.username,
        })
        .from(users)
        .where(eq(users.id, ctx.user.id));

      const actorName = currentUser?.username || "未知用户";
      const targetName = targetUser?.username || "未知用户";
      const documentTitle = access.document.title || "未命名文档";

      await db
        .delete(documentCollaborators)
        .where(and(
          eq(documentCollaborators.documentId, input.documentId),
          eq(documentCollaborators.userId, input.userId),
        ));

      await appendDocumentShareLog(input.documentId, {
        message: `${actorName} 撤回了对 ${targetName} 的文档《${documentTitle}》分享`,
        type: "revoke",
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    }),
  saveYjsState: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      state: z.array(z.number().int().min(0).max(255)),
    }))
    .mutation(async ({ ctx, input }) => {
      const [access] = await db
        .select({
          document: documents,
          workspace: workspaces,
          collaborator: documentCollaborators,
          workspaceMember: workspaceMembers,
        })
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

      if (!access) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      if (!canEditDocumentFromAccess(access, ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "无权限保存文档状态",
        });
      }

      const buffer = Buffer.from(new Uint8Array(input.state));
      const base64 = buffer.toString("base64");

      await db
        .update(documents)
        .set({
          yjsState: base64,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, input.documentId));

      if (redis) {
        await redis.del(`doc:${input.documentId}`);
      }

      return { success: true };
    }),
  getWordpressSites: protectedProcedure
    .query(async ({ ctx }) => {
      const sites = await db
        .select({
          id: integrationAccounts.id,
          siteUrl: integrationAccounts.siteUrl,
          displayName: integrationAccounts.displayName,
          authType: integrationAccounts.authType,
          username: integrationAccounts.identifier,
          createdAt: integrationAccounts.createdAt,
          updatedAt: integrationAccounts.updatedAt,
        })
        .from(integrationAccounts)
        .where(and(
          eq(integrationAccounts.ownerId, ctx.user.id),
          eq(integrationAccounts.platform, "wordpress")
        ))
        .orderBy(desc(integrationAccounts.createdAt));

      return sites;
    }),
  validateWordpressSite: protectedProcedure
    .input(wordpressAuthSchema)
    .mutation(async ({ input }) => {
      const result = await validateWordpressCredentials(input);
      return result;
    }),
  bindWordpressSite: protectedProcedure
    .input(
      wordpressAuthSchema.extend({
        displayName: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const validation = await validateWordpressCredentials(input);

      if (!validation.ok) {
        return {
          ok: false as const,
          errorCode: validation.errorCode,
          errorMessage: validation.errorMessage,
          httpStatus: validation.httpStatus,
        };
      }

      const siteUrl = normalizeSiteUrl(input.siteUrl);

      const [site] = await db
        .insert(integrationAccounts)
        .values({
          ownerId: ctx.user.id,
          platform: "wordpress",
          siteUrl,
          displayName: input.displayName,
          authType: input.authType,
          identifier: input.username,
          credentials: {
            authType: input.authType,
            username: input.username,
            encryptedPassword: input.applicationPassword ? encrypt(input.applicationPassword) : undefined,
          },
        })
        .returning({
          id: integrationAccounts.id,
          siteUrl: integrationAccounts.siteUrl,
          displayName: integrationAccounts.displayName,
          authType: integrationAccounts.authType,
          username: integrationAccounts.identifier,
          createdAt: integrationAccounts.createdAt,
          updatedAt: integrationAccounts.updatedAt,
        });

      return {
        ok: true as const,
        site,
        validation,
      };
    }),
  getWordpressTaxonomies: protectedProcedure
    .input(z.object({
      siteId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const [site] = await db
        .select()
        .from(integrationAccounts)
        .where(and(
          eq(integrationAccounts.id, input.siteId),
          eq(integrationAccounts.ownerId, ctx.user.id),
          eq(integrationAccounts.platform, "wordpress")
        ));

      if (!site) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "无权访问该 WordPress 站点",
        });
      }

      const siteUrl = normalizeSiteUrl(site.siteUrl || "");
      const credential = site.credentials as {
        authType?: string;
        username?: string;
        applicationPassword?: string;
        encryptedPassword?: string;
        accessToken?: string;
        blogId?: string | number;
      };

      let headers: Record<string, string>;
      let apiBaseUrl = `${siteUrl}/wp-json/wp/v2`;

      if (credential.authType === "oauth" && credential.accessToken) {
        headers = { Authorization: `Bearer ${credential.accessToken}` };
        
        // Ensure blogId is present (similar logic to publishToWordpress)
        if (!credential.blogId) {
             try {
               const sitesRes = await fetch("https://public-api.wordpress.com/rest/v1.1/me/sites", {
                 headers
               });
               if (sitesRes.ok) {
                 const sitesData = await sitesRes.json() as { sites: { ID: number; URL: string }[] };
                 if (sitesData.sites && sitesData.sites.length > 0) {
                   const matchedSite = sitesData.sites.find(s => normalizeSiteUrl(s.URL) === normalizeSiteUrl(site.siteUrl || "")) || sitesData.sites[0];
                   if (matchedSite) {
                     credential.blogId = matchedSite.ID;
                     // Update DB
                     await db.update(integrationAccounts).set({
                       credentials: { ...credential, blogId: matchedSite.ID }
                     }).where(eq(integrationAccounts.id, site.id));
                   }
                 }
               }
             } catch (e) {
               console.error("Failed to fetch sites for OAuth user in taxonomies", e);
             }
        }

        if (credential.blogId) {
          apiBaseUrl = `https://public-api.wordpress.com/wp/v2/sites/${credential.blogId}`;
        }
      } else if (credential.username && (credential.applicationPassword || credential.encryptedPassword)) {
        const password = credential.applicationPassword || decrypt(credential.encryptedPassword!);
        const authString = `${credential.username}:${password}`;
        const basic = Buffer.from(authString, "utf8").toString("base64");
        headers = { Authorization: `Basic ${basic}` };
      } else {
        return { categories: [], tags: [] };
      }

      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/categories?per_page=100`, { headers }),
          fetch(`${apiBaseUrl}/tags?per_page=100`, { headers }),
        ]);

        const categories = categoriesRes.ok ? await categoriesRes.json() as { id: number; name: string }[] : [];
        const tags = tagsRes.ok ? await tagsRes.json() as { id: number; name: string }[] : [];

        return {
          categories: Array.isArray(categories) ? categories.map(c => ({ id: String(c.id), name: c.name })) : [],
          tags: Array.isArray(tags) ? tags.map(t => ({ id: String(t.id), name: t.name })) : [],
        };
      } catch (e) {
        console.error("Failed to fetch taxonomies", e);
        return { categories: [], tags: [] };
      }
    }),
  disconnectWordpressSite: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(integrationAccounts)
        .where(and(
          eq(integrationAccounts.id, input.siteId),
          eq(integrationAccounts.ownerId, ctx.user.id),
          eq(integrationAccounts.platform, "wordpress")
        ));
      return { success: true };
    }),
  getSitePublishedPosts: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const posts = await db
        .select({
          id: documents.id,
          title: documents.title,
          updatedAt: documents.updatedAt,
          metadata: documents.metadata,
        })
        .from(documents)
        .where(and(
          eq(documents.ownerId, ctx.user.id),
          sql`(${documents.metadata}->'wordpress'->${input.siteId}) IS NOT NULL`
        ))
        .orderBy(desc(documents.updatedAt));
        
      return posts.map(doc => {
         const metadata = doc.metadata as { wordpress?: Record<string, { postId: string | number; link: string; lastPublishedAt: string }> };
         const wpData = metadata.wordpress?.[input.siteId];
         return {
           id: doc.id,
           title: doc.title,
           updatedAt: doc.updatedAt,
           publishedInfo: wpData
         };
      });
    }),
  publishToWordpress: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        target: z.object({
          type: z.literal("wordpress"),
          siteId: z.string(),
        }),
        options: z
          .object({
            status: z.enum(["draft", "publish"]).optional(),
            type: z.enum(["post", "page"]).optional().default("post"),
            slug: z.string().optional(),
            categories: z.array(z.string()).optional(),
            tags: z.array(z.string()).optional(),
            title: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [access] = await db
        .select({
          document: documents,
          workspace: workspaces,
          collaborator: documentCollaborators,
          workspaceMember: workspaceMembers,
        })
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
          ),
        ));

      if (!access) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "文档不存在",
        });
      }

      if (!canEditDocumentFromAccess(access, ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "无权限发布此文档",
        });
      }

      const [site] = await db
        .select()
        .from(integrationAccounts)
        .where(and(
          eq(integrationAccounts.id, input.target.siteId),
          eq(integrationAccounts.ownerId, ctx.user.id),
          eq(integrationAccounts.platform, "wordpress")
        ));

      if (!site) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "无权使用该 WordPress 站点",
        });
      }

      const credential = site.credentials as {
        authType?: string;
        username?: string;
        applicationPassword?: string;
        encryptedPassword?: string;
        accessToken?: string;
        blogId?: string | number;
      };

      if (credential.authType !== "application_password" && credential.authType !== "oauth") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "不支持的认证方式",
        });
      }

      const siteUrl = normalizeSiteUrl(site.siteUrl || "");
      let authHeader = "";
      let apiBaseUrl = `${siteUrl}/wp-json/wp/v2`;

      if (credential.authType === "oauth" && credential.accessToken) {
         authHeader = `Bearer ${credential.accessToken}`;
         
         // If blogId is missing, try to fetch it from WordPress.com
         if (!credential.blogId) {
             console.log("[Publish] blogId missing, attempting to fetch...");
             let debugMsg = "";
             try {
               const sitesRes = await fetch("https://public-api.wordpress.com/rest/v1.1/me/sites", {
                 headers: { Authorization: authHeader }
               });
               if (sitesRes.ok) {
                 const sitesData = await sitesRes.json() as { sites: { ID: number; URL: string }[] };
                 console.log("[Publish] Fetched sites:", JSON.stringify(sitesData));
                 if (sitesData.sites && sitesData.sites.length > 0) {
                   // Try to match by URL if possible, otherwise pick the first one
                   const matchedSite = sitesData.sites.find(s => normalizeSiteUrl(s.URL) === normalizeSiteUrl(site.siteUrl || "")) || sitesData.sites[0];
                   if (matchedSite) {
                     console.log("[Publish] Matched site:", matchedSite);
                     credential.blogId = matchedSite.ID;
                     // Update the DB to save this blogId for future use
                     await db.update(integrationAccounts).set({
                       credentials: { ...credential, blogId: matchedSite.ID }
                     }).where(eq(integrationAccounts.id, site.id));
                   } else {
                      debugMsg = "No matching site found in user's site list.";
                   }
                 } else {
                    debugMsg = "User has no sites.";
                 }
               } else {
                  const errText = await sitesRes.text();
                  debugMsg = `Fetch sites failed: ${sitesRes.status} ${errText}`;
                  console.error(debugMsg);
               }
             } catch (e) {
               debugMsg = `Fetch sites exception: ${e instanceof Error ? e.message : String(e)}`;
               console.error("Failed to fetch sites for OAuth user", e);
             }
             
             if (!credential.blogId) {
                 console.error("[Publish] Still no blogId after fetch attempt:", debugMsg);
                 throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `无法自动获取 WordPress 站点 ID (blogId)。原因: ${debugMsg || "未知错误"}。请检查您的 WordPress.com 账号下是否有可用站点。`,
                 });
             }
         }

         if (credential.blogId) {
            apiBaseUrl = `https://public-api.wordpress.com/wp/v2/sites/${credential.blogId}`;
         }
         console.log("[Publish] Using apiBaseUrl:", apiBaseUrl, "blogId:", credential.blogId);
      } else if (credential.username && (credential.applicationPassword || credential.encryptedPassword)) {
         const password = credential.applicationPassword || decrypt(credential.encryptedPassword!);
         const authString = `${credential.username}:${password}`;
         const basic = Buffer.from(authString, "utf8").toString("base64");
         authHeader = `Basic ${basic}`;
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "WordPress 凭证不完整",
        });
      }

      const exported = await exportDocumentToHtml(input.documentId, async (imageUrl) => {
        return uploadMediaToWordpress(site, imageUrl);
      });

      const status = input.options?.status ?? "draft";
      const postType = input.options?.type ?? "post";

      const metadata = (access.document.metadata || {}) as Record<string, unknown>;
      const wordpressMeta = metadata.wordpress as Record<string, { postId: string | number; link: string; type?: string }> | undefined;
      const existingPost = wordpressMeta?.[site.id];

      const body: Record<string, unknown> = {
        title: input.options?.title ?? exported.title,
        content: exported.html,
        status,
      };

      if (input.options?.slug) {
        body.slug = input.options.slug;
      }

      // Categories and Tags are only supported for posts
      if (postType === 'post') {
        if (input.options?.categories?.length) {
          body.categories = input.options.categories;
        }

        if (input.options?.tags?.length) {
          body.tags = input.options.tags;
        }
      }

      let response: Response;
      const endpointType = postType === 'page' ? 'pages' : 'posts';
      
      // Check if we should update existing or create new
      // If existing record has a different type (e.g. was Post, now publishing as Page), we create new
      const isUpdate = existingPost?.postId && (!existingPost.type || existingPost.type === postType);

      const endpoint = isUpdate
        ? `${apiBaseUrl}/${endpointType}/${existingPost.postId}`
        : `${apiBaseUrl}/${endpointType}`;

      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify(body),
        });
      } catch {
        return {
          status: "failed" as const,
          errorCode: "NETWORK_ERROR",
          errorMessage: "无法连接到 WordPress 站点",
        };
      }

      if (!response.ok) {
        let errorBody: string | undefined;
        try {
          errorBody = await response.text();
        } catch {
          errorBody = undefined;
        }
        const trimmed = errorBody ? errorBody.slice(0, 500) : undefined;
        return {
          status: "failed" as const,
          errorCode: "WORDPRESS_POST_FAILED",
          errorMessage: trimmed || "发布到 WordPress 失败",
          httpStatus: response.status,
        };
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      const anyData = data as { id?: number | string; link?: string } | null;

      if (anyData?.id) {
        const newMetadata = { ...metadata };
        if (!newMetadata.wordpress) {
          newMetadata.wordpress = {};
        }
        (newMetadata.wordpress as Record<string, unknown>)[site.id] = {
          postId: anyData.id,
          link: anyData.link,
          type: postType,
          lastPublishedAt: new Date().toISOString(),
        };

        await db
          .update(documents)
          .set({ metadata: newMetadata })
          .where(eq(documents.id, input.documentId));
      }

      return {
        status: "success" as const,
        remotePostId: anyData?.id !== undefined ? String(anyData.id) : undefined,
        remoteUrl: anyData?.link,
        httpStatus: response.status,
      };
    }),
});
