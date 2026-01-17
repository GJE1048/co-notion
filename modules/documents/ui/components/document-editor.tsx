"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2, Save, ArrowLeft, Plus, Heading1, List, Code, Share, Copy, Trash2 } from "lucide-react";
import { trpc } from "@/trpc/client";
import { BlockEditor } from "./block-editor";
import type { documents, blocks, operations as operationsTable } from "@/db/schema";

type Document = typeof documents.$inferSelect;
type Block = typeof blocks.$inferSelect;
type Operation = typeof operationsTable.$inferSelect;

interface DocumentEditorProps {
  document: Document;
}

export const DocumentEditor = ({ document: initialDocument }: DocumentEditorProps) => {
  const router = useRouter();
  const [title, setTitle] = useState(initialDocument.title);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isHeadingPopoverOpen, setIsHeadingPopoverOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmCopyOpen, setConfirmCopyOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const {
    data: blocksData,
    isLoading: blocksLoading,
    error: blocksError
  } = trpc.dev.getDocumentBlocks.useQuery({
    documentId: initialDocument.id
  });

  const createBlockMutation = trpc.documents.createBlock.useMutation();
  const updateBlockMutation = trpc.blocks.updateBlock.useMutation();
  const deleteBlockMutation = trpc.blocks.deleteBlock.useMutation();
  const updateDocumentMutation = trpc.documents.updateDocument.useMutation();
  const deleteDocumentMutation = trpc.documents.deleteDocument.useMutation({
    onSuccess: () => {
      router.push("/documents");
    },
  });
  const duplicateDocumentMutation = trpc.documents.duplicateDocument.useMutation({
    onSuccess: (newDocument) => {
      router.push(`/documents/${newDocument.id}`);
    },
  });

  const { data: userWorkspaces } = trpc.workspaces.getUserWorkspaces.useQuery();
  const { data: documentMembersData } = trpc.documents.getDocumentMembers.useQuery({
    documentId: initialDocument.id,
  });

  const currentWorkspace = userWorkspaces?.find((ws) => ws.id === initialDocument.workspaceId);
  const workspaceRole = currentWorkspace?.userRole ?? "creator";
  const canManageDocument = workspaceRole === "creator" || workspaceRole === "admin";

  const documentMembers = documentMembersData?.members ?? [];
  const documentOwner = documentMembers.find((m) => m.isDocumentOwner);
  const visibleMembers = documentMembers.slice(0, 5);
  const extraMemberCount = documentMembers.length - visibleMembers.length;
  const { data: currentUser } = trpc.documents.getCurrentUserProfile.useQuery();
  const canEditDocument = (() => {
    if (!currentUser) {
      return false;
    }
    const isDocOwner = initialDocument.ownerId === currentUser.id;
    const workspaceEditor = workspaceRole === "creator" || workspaceRole === "admin";
    const member = documentMembers.find((m) => m.id === currentUser.id);
    const isDocOwnerFromMember = !!member?.isDocumentOwner;
    const documentRole = member?.documentRole;
    const workspaceRoleFromMember = member?.workspaceRole;
    const isDocEditor =
      documentRole === "owner" ||
      documentRole === "editor";
    const isWorkspaceEditorFromMember =
      workspaceRoleFromMember === "creator" ||
      workspaceRoleFromMember === "admin";
    return isDocOwner || workspaceEditor || isDocOwnerFromMember || isDocEditor || isWorkspaceEditorFromMember;
  })();
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  const hasPresence = onlineUsernames.length > 0;

  const [yjsBlocksSnapshot, setYjsBlocksSnapshot] = useState<
    { id: string; type: string; text: string }[]
  >([]);

  const ydocRef = useRef<Y.Doc | null>(null);
  const yBlocksRef = useRef<Y.Array<Y.Map<unknown>> | null>(null);

  const blocks = useMemo(
    () => blocksData?.blocks || [],
    [blocksData]
  );
  const isLoading = blocksLoading;

  const utils = trpc.useUtils();

  const [clientId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const storageKey = "doc_client_id";
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }
    const newId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    window.localStorage.setItem(storageKey, newId);
    return newId;
  });

  const currentVersionRef = useRef(0);
  const hasInitializedVersionRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchOperations = useCallback(async () => {
    if (!blocksData || blocksLoading) {
      return;
    }

    try {
      const result = await utils.documents.getDocumentOperations.fetch({
        documentId: initialDocument.id,
        sinceVersion: currentVersionRef.current,
      });

      if (!result) {
        return;
      }

      if (!hasInitializedVersionRef.current) {
        hasInitializedVersionRef.current = true;
        currentVersionRef.current = result.latestVersion;
        return;
      }

      if (!result.operations.length) {
        currentVersionRef.current = result.latestVersion;
        return;
      }

      utils.dev.getDocumentBlocks.setData(
        { documentId: initialDocument.id },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          let updatedBlocks = [...oldData.blocks];

          for (const op of result.operations as Operation[]) {
            if (!op) continue;
            if (op.clientId && op.clientId === clientId) continue;

            if (op.type === "create_block") {
              const payloadBlock = op.payload as unknown as Block | undefined;
              if (!payloadBlock) continue;
              const exists = updatedBlocks.some((block) => block.id === payloadBlock.id);
              if (!exists) {
                updatedBlocks.push(payloadBlock);
              }
              continue;
            }

            if (op.type === "update_block") {
              updatedBlocks = updatedBlocks.map((block) =>
                block.id === op.blockId
                  ? {
                      ...block,
                      ...(op.payload as unknown as Partial<Block>),
                      updatedAt: op.timestamp ?? block.updatedAt,
                    }
                  : block
              );
              continue;
            }

            if (op.type === "delete_block") {
              updatedBlocks = updatedBlocks.filter((block) => block.id !== op.blockId);
              continue;
            }

            if (op.type === "reorder_blocks") {
              const payload = op.payload as unknown as {
                blockUpdates?: { id: string; position: number }[];
              } | null;

              if (payload && Array.isArray(payload.blockUpdates)) {
                const positionMap = new Map<string, number>();
                for (const update of payload.blockUpdates) {
                  positionMap.set(update.id, update.position);
                }

                updatedBlocks = updatedBlocks.map((block) =>
                  positionMap.has(block.id)
                    ? {
                        ...block,
                        position: positionMap.get(block.id) ?? block.position,
                        updatedAt: op.timestamp ?? block.updatedAt,
                      }
                    : block
                );
              }
            }
          }

          return {
            ...oldData,
            blocks: updatedBlocks,
          };
        }
      );

      currentVersionRef.current = result.latestVersion;
    } catch (err) {
      console.error("Failed to fetch document operations:", err);
    }
  }, [blocksData, blocksLoading, utils, initialDocument.id, clientId]);

  const syncBlockToYjs = useCallback((block: Block) => {
    const yBlocks = yBlocksRef.current;
    if (!yBlocks) {
      return;
    }

    const array = yBlocks.toArray() as Y.Map<unknown>[];
    const existingIndex = array.findIndex((item) => item.get("id") === block.id);
    let textContent = "";

    if (block.type === "code") {
      type CodeContent = {
        code?: {
          content?: string;
        };
      };
      const value = block.content as unknown as CodeContent;
      textContent = value.code?.content ?? "";
    } else {
      type TextContent = {
        text?: {
          content?: string;
        };
      };
      const value = block.content as unknown as TextContent;
      textContent = value.text?.content ?? "";
    }

    if (existingIndex >= 0) {
      const yBlock = array[existingIndex];
      yBlock.set("type", block.type);
      yBlock.set("position", block.position);
      const content = yBlock.get("content");
      if (content instanceof Y.Text) {
        content.delete(0, content.length);
        content.insert(0, textContent);
      } else {
        const yText = new Y.Text(textContent);
        yBlock.set("content", yText);
      }
      return;
    }

    const yBlock = new Y.Map<unknown>();
    yBlock.set("id", block.id);
    yBlock.set("type", block.type);
    yBlock.set("position", block.position);
    const yText = new Y.Text(textContent);
    yBlock.set("content", yText);

    yBlocks.push([yBlock]);
  }, []);

  const deleteBlockFromYjs = useCallback((blockId: string) => {
    const yBlocks = yBlocksRef.current;
    if (!yBlocks) {
      return;
    }

    const array = yBlocks.toArray() as Y.Map<unknown>[];
    const index = array.findIndex((item) => item.get("id") === blockId);
    if (index === -1) {
      return;
    }

    yBlocks.delete(index, 1);
  }, []);

  const handleSave = useCallback(async () => {
    if (!canEditDocument) {
      setError("你没有编辑文档的权限");
      setToastMessage("你没有编辑文档的权限");
      return;
    }
    try {
      setError(null);

      await updateDocumentMutation.mutateAsync({
        id: initialDocument.id,
        data: {
          title: title.trim(),
        },
      });

      setLastSaved(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存文档时发生错误";
      setError(message);
      setToastMessage(message);
    }
  }, [canEditDocument, updateDocumentMutation, initialDocument.id, title]);

  const isSaving = updateDocumentMutation.isPending;
  const [isShareOpen, setIsShareOpen] = useState(false);
  const isDeletingDocument = deleteDocumentMutation.isPending;
  const isDuplicatingDocument = duplicateDocumentMutation.isPending;

  // Block 操作处理函数
  const handleBlockCreate = useCallback(async (blockData: Omit<Block, "id" | "createdAt" | "updatedAt">) => {
    try {
      setError(null);
      const newBlock = await createBlockMutation.mutateAsync({
        ...blockData,
        clientId,
      });
      syncBlockToYjs(newBlock as Block);
      // 重新获取 blocks 数据 - 使用正确的路由
      await utils.dev.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
      // 也刷新文档blocks查询
      await utils.documents.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
    } catch (err) {
      console.error('Failed to create block:', err);
      setError(err instanceof Error ? err.message : '创建 Block 失败');
    }
  }, [createBlockMutation, utils, initialDocument.id, clientId, syncBlockToYjs]);

  // 在指定块之后创建新块
  const handleBlockCreateAfter = useCallback(async (afterBlockId: string, blockData: Omit<Block, "id" | "createdAt" | "updatedAt">) => {
    try {
      setError(null);
      // 获取当前块的位置，新块位置 = 当前块位置 + 1
      const afterBlock = blocks.find(b => b.id === afterBlockId);
      if (afterBlock) {
        blockData.position = afterBlock.position + 1;
      } else {
        // 如果没有找到，使用最大位置 + 1
        const maxPosition = blocks.length > 0 
          ? Math.max(...blocks.map(b => b.position)) 
          : -1;
        blockData.position = maxPosition + 1;
      }
      
      const newBlock = await createBlockMutation.mutateAsync({
        ...blockData,
        clientId,
      });
      syncBlockToYjs(newBlock as Block);
      // 重新获取 blocks 数据 - 使用正确的路由
      await utils.dev.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
      await utils.documents.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
    } catch (err) {
      console.error('Failed to create block after:', err);
      setError(err instanceof Error ? err.message : '创建 Block 失败');
    }
  }, [createBlockMutation, utils, initialDocument.id, blocks, clientId, syncBlockToYjs]);

  // 使用 useRef 来管理防抖定时器
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBlockUpdate = useCallback(async (blockId: string, updates: Partial<Block>) => {
    try {
      setError(null);
      
      // 乐观更新：立即更新本地缓存
      utils.dev.getDocumentBlocks.setData(
        { documentId: initialDocument.id },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            blocks: oldData.blocks.map(block =>
              block.id === blockId
                ? { ...block, ...updates, updatedAt: new Date() }
                : block
            ),
          };
        }
      );
      
      // 清除之前的定时器
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // 使用防抖来减少频繁的服务器请求
      updateTimeoutRef.current = setTimeout(async () => {
        try {
          const updatedBlock = await updateBlockMutation.mutateAsync({
            id: blockId,
            data: updates,
            clientId,
          });
          syncBlockToYjs(updatedBlock as Block);
          // 服务器更新成功后，刷新数据确保一致性
          await utils.dev.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
          await utils.documents.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
        } catch (err) {
          console.error('Failed to update block on server:', err);
          // 如果服务器更新失败，重新获取数据恢复状态
          await utils.dev.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
        }
        updateTimeoutRef.current = null;
      }, 500); // 500ms 防抖
    } catch (err) {
      console.error('Failed to update block:', err);
      setError(err instanceof Error ? err.message : '更新 Block 失败');
      // 恢复数据
      await utils.dev.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
    }
  }, [updateBlockMutation, utils, initialDocument.id, clientId, syncBlockToYjs]);

  const handleBlockDelete = useCallback(async (blockId: string) => {
    try {
      setError(null);
      await deleteBlockMutation.mutateAsync({
        id: blockId,
        clientId,
      });
      deleteBlockFromYjs(blockId);
      // 重新获取 blocks 数据 - 使用正确的路由
      await utils.dev.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
      await utils.documents.getDocumentBlocks.invalidate({ documentId: initialDocument.id });
    } catch (err) {
      console.error('Failed to delete block:', err);
      setError(err instanceof Error ? err.message : '删除 Block 失败');
    }
  }, [deleteBlockMutation, utils, initialDocument.id, clientId, deleteBlockFromYjs]);

  useEffect(() => {
    void fetchOperations();
  }, [fetchOperations]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ydoc = new Y.Doc();
    const wsUrl =
      process.env.NEXT_PUBLIC_YJS_SERVER_WS_URL ||
      `ws://${window.location.hostname}:1234`;

    const provider = new WebsocketProvider(wsUrl, initialDocument.id, ydoc);
    const yBlocks = ydoc.getArray<Y.Map<unknown>>("blocks");

    ydocRef.current = ydoc;
    yBlocksRef.current = yBlocks;

    const handleUpdate = () => {
      const array = yBlocks.toArray() as Y.Map<unknown>[];
      const snapshot = array.map((item) => {
        const id = (item.get("id") as string) || "";
        const type = (item.get("type") as string) || "paragraph";
        const content = item.get("content");
        let text = "";

        if (content instanceof Y.Text) {
          text = content.toString();
        } else if (typeof content === "string") {
          text = content;
        }

        return {
          id,
          type,
          text,
        };
      });

      setYjsBlocksSnapshot(snapshot);
    };

    yBlocks.observe(handleUpdate);
    handleUpdate();

    return () => {
      yBlocks.unobserve(handleUpdate);
      yBlocksRef.current = null;
      ydocRef.current = null;
      provider.destroy();
      ydoc.destroy();
    };
  }, [initialDocument.id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!currentUser?.username) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_REALTIME_SERVER_WS_URL || `ws://${window.location.hostname}:4000/ws`;
    let closed = false;

    const connect = () => {
      if (closed) {
        return;
      }

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: "join_document",
          documentId: initialDocument.id,
          username: currentUser.username,
        }));
      };

      socket.onmessage = (event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(event.data as string);
        } catch {
          return;
        }

        if (!payload || typeof payload !== "object") {
          return;
        }

        const msg = payload as {
          type?: string;
          documentId?: string;
          onlineUsernames?: string[];
          latestVersion?: number;
        };

        if (msg.type === "presence" && msg.documentId === initialDocument.id && Array.isArray(msg.onlineUsernames)) {
          setOnlineUsernames(msg.onlineUsernames);
        }

        if (msg.type === "document_operations_updated" && msg.documentId === initialDocument.id) {
          void fetchOperations();
        }
      };

      socket.onclose = () => {
        if (closed) {
          return;
        }
        setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      closed = true;
      const socket = wsRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "leave_document",
          documentId: initialDocument.id,
        }));
        socket.close();
      }
      wsRef.current = null;
    };
  }, [initialDocument.id, currentUser?.username, fetchOperations]);

  // 自动保存（简化版，后续会用操作日志替换）
  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (canEditDocument && title !== initialDocument.title) {
        handleSave();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [title, handleSave, initialDocument.title, canEditDocument]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/documents")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          返回文档列表
        </Button>

        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              已保存 {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {canManageDocument && (
            <>
              <Button
                onClick={() => setConfirmCopyOpen(true)}
                disabled={isLoading}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Copy className="size-4" />
                复制
              </Button>
              <Button
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isLoading}
                size="sm"
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="size-4" />
                删除
              </Button>
              <Button
                onClick={() => setIsShareOpen(true)}
                disabled={isLoading}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Share className="size-4" />
                分享
              </Button>
            </>
          )}
          <Button
            onClick={() => handleSave()}
            disabled={isSaving || isLoading || !canEditDocument}
            size="sm"
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="size-4" />
                保存
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
        <div>
          {documentOwner && (
            <span>
              文档拥有者：{documentOwner.username}
            </span>
          )}
        </div>
        {documentMembers.length > 0 && (
          <div className="flex items-center justify-end gap-2">
            <div className="flex -space-x-2">
              {visibleMembers.map((member) => {
                const roles: string[] = [];

                if (member.isDocumentOwner) {
                  roles.push("文档拥有者");
                } else if (member.documentRole === "owner") {
                  roles.push("协作者");
                }

                if (member.workspaceRole === "creator") {
                  roles.push("工作区创建者");
                } else if (member.workspaceRole === "admin") {
                  roles.push("管理员");
                } else if (member.workspaceRole === "editor") {
                  roles.push("编辑者");
                } else if (member.workspaceRole === "viewer") {
                  roles.push("查看者");
                }

                const roleLabel = roles.join(" / ") || "成员";
                const initials = member.username ? member.username.charAt(0).toUpperCase() : "成员";
                const isOnline = !hasPresence || onlineUsernames.includes(member.username);

                return (
                  <Tooltip key={member.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={`relative inline-flex size-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-medium text-slate-700 overflow-hidden shadow-sm dark:border-slate-900 dark:bg-slate-700 dark:text-slate-50 ${
                          isOnline ? "" : "grayscale opacity-60"
                        }`}
                        aria-label={`${member.username}（${roleLabel}）`}
                      >
                        {member.imageUrl ? (
                          <img
                            src={member.imageUrl}
                            alt={member.username}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{member.username}</span>
                        <span className="text-xs opacity-80">{roleLabel}</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            {extraMemberCount > 0 && (
              <div className="inline-flex size-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-500 shadow-sm dark:border-slate-900 dark:bg-slate-800 dark:text-slate-200">
                +{extraMemberCount}
              </div>
            )}
          </div>
        )}
      </div>

      {(error || blocksError) && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error || '加载文档内容失败'}
          </p>
        </div>
      )}

      {/* 文档编辑器 */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-slate-900 text-white px-4 py-2 shadow-lg text-sm">
          {toastMessage}
        </div>
      )}

      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* 标题输入 */}
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              readOnly={!canEditDocument}
              placeholder="文档标题..."
              className="text-3xl font-semibold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
            />

            {/* Block 编辑器 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-500">加载文档内容...</span>
              </div>
            ) : (
              <BlockEditor
                blocks={blocks}
                onBlockCreate={handleBlockCreate}
                onBlockUpdate={handleBlockUpdate}
                onBlockDelete={handleBlockDelete}
                onBlockCreateAfter={handleBlockCreateAfter}
                readOnly={!canEditDocument}
              />
            )}

            {/* 添加新 Block 按钮 */}
            {!isLoading && (
              <div className="space-y-2">
                <div className="text-xs text-slate-500">添加内容块</div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                    const maxPosition = blocks.length > 0 
                      ? Math.max(...blocks.map(b => b.position)) 
                      : -1;
                    await handleBlockCreate({
                      documentId: initialDocument.id,
                      parentId: null,
                      type: 'paragraph',
                      content: { text: { content: '' } },
                      properties: {},
                      position: maxPosition + 1,
                      version: 1,
                      createdBy: '', // 这个字段会在服务器端设置
                    });
                  }}
                  >
                    <Plus className="size-4 mr-1" />
                    段落
                  </Button>
                  <div className="relative inline-block">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setIsHeadingPopoverOpen((open) => !open)}
                    >
                      <Heading1 className="size-4 mr-1" />
                      标题
                    </Button>
                    {isHeadingPopoverOpen && (
                      <div className="absolute z-20 mt-2 w-40 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md py-1">
                        <button
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={async () => {
                            const maxPosition = blocks.length > 0
                              ? Math.max(...blocks.map(b => b.position))
                              : -1;
                            await handleBlockCreate({
                              documentId: initialDocument.id,
                              parentId: null,
                              type: 'heading_1',
                              content: { text: { content: '' } },
                              properties: {},
                              position: maxPosition + 1,
                              version: 1,
                              createdBy: '',
                            });
                            setIsHeadingPopoverOpen(false);
                          }}
                        >
                          H1 标题
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={async () => {
                            const maxPosition = blocks.length > 0
                              ? Math.max(...blocks.map(b => b.position))
                              : -1;
                            await handleBlockCreate({
                              documentId: initialDocument.id,
                              parentId: null,
                              type: 'heading_2',
                              content: { text: { content: '' } },
                              properties: {},
                              position: maxPosition + 1,
                              version: 1,
                              createdBy: '',
                            });
                            setIsHeadingPopoverOpen(false);
                          }}
                        >
                          H2 标题
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={async () => {
                            const maxPosition = blocks.length > 0
                              ? Math.max(...blocks.map(b => b.position))
                              : -1;
                            await handleBlockCreate({
                              documentId: initialDocument.id,
                              parentId: null,
                              type: 'heading_3',
                              content: { text: { content: '' } },
                              properties: {},
                              position: maxPosition + 1,
                              version: 1,
                              createdBy: '',
                            });
                            setIsHeadingPopoverOpen(false);
                          }}
                        >
                          H3 标题
                        </button>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const maxPosition = blocks.length > 0 
                        ? Math.max(...blocks.map(b => b.position)) 
                        : -1;
                      await handleBlockCreate({
                        documentId: initialDocument.id,
                        parentId: null,
                        type: 'list',
                        content: { list: { items: [''] } },
                        properties: {},
                        position: maxPosition + 1,
                        version: 1,
                        createdBy: '',
                      });
                    }}
                  >
                    <List className="size-4 mr-1" />
                    列表
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const maxPosition = blocks.length > 0 
                        ? Math.max(...blocks.map(b => b.position)) 
                        : -1;
                      await handleBlockCreate({
                        documentId: initialDocument.id,
                        parentId: null,
                        type: 'code',
                        content: { code: { content: '', language: 'javascript' } },
                        properties: {},
                        position: maxPosition + 1,
                        version: 1,
                        createdBy: '',
                      });
                    }}
                  >
                    <Code className="size-4 mr-1" />
                    代码
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isShareOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="text-lg font-semibold mb-4">分享文档</div>
            {error && (
              <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  分享链接
                </label>
                <Input
                  value={inviteLink}
                  readOnly
                  placeholder="点击下方按钮生成分享链接"
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsShareOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    if (typeof window === "undefined") return;
                    const url = new URL(window.location.href);
                    url.pathname = "/invite/document";
                    url.searchParams.set("documentId", initialDocument.id);
                    const link = url.toString();
                    setInviteLink(link);
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(link).catch(() => {});
                    }
                  }}
                >
                  生成并复制链接
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !isDeletingDocument) {
            setConfirmDeleteOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除文档</DialogTitle>
            <DialogDescription>
              删除后将无法在文档列表中看到该文档，是否确认删除？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={isDeletingDocument}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                try {
                  await deleteDocumentMutation.mutateAsync({ id: initialDocument.id });
                } catch {
                }
              }}
              disabled={isDeletingDocument}
            >
              {isDeletingDocument ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmCopyOpen}
        onOpenChange={(open) => {
          if (!open && !isDuplicatingDocument) {
            setConfirmCopyOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>复制文档</DialogTitle>
            <DialogDescription>
              将在“我的文档”中创建该文档的副本，是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCopyOpen(false)}
              disabled={isDuplicatingDocument}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={async () => {
                try {
                  await duplicateDocumentMutation.mutateAsync({ documentId: initialDocument.id });
                } catch {
                }
              }}
              disabled={isDuplicatingDocument}
            >
              {isDuplicatingDocument ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  复制中...
                </>
              ) : (
                "确认复制"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
