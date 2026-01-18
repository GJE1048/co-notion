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
import { Loader2, Save, ArrowLeft, Plus, Heading1, List, Code, Share, Copy, Trash2, Bot, Send, X } from "lucide-react";
import { trpc } from "@/trpc/client";
import { BlockEditor } from "./block-editor";
import type { documents, blocks, operations as operationsTable } from "@/db/schema";

type Document = typeof documents.$inferSelect;
type Block = typeof blocks.$inferSelect;
type Operation = typeof operationsTable.$inferSelect;

type ChatRole = "user" | "assistant" | "system";

type RobotAction =
  | "chat"
  | "polish"
  | "rewrite"
  | "summarize"
  | "fix_typos"
  | "extract"
  | "replace";

interface ChatMessageMetadata {
  action?: RobotAction;
  documentId?: string;
  blockId?: string;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
  metadata?: ChatMessageMetadata;
}

interface DocumentBlockContextForChat {
  documentId: string;
  blockId: string;
  content: string;
}

interface ChatRobotRequest {
  messages: {
    role: ChatRole;
    content: string;
  }[];
  mode?: "chat" | "edit";
  action?: RobotAction;
  target?: {
    type: "document" | "block" | "selection";
    documentId?: string;
    blockId?: string;
  };
  documentContext?: {
    documentId: string;
    title: string;
    summary?: string;
    blocks?: DocumentBlockContextForChat[];
  };
}

interface ChatRobotResponse {
  reply: string;
  metadata?: ChatMessageMetadata;
}

type AwarenessUserState = {
  id?: string;
  name?: string;
  color?: string;
};

type AwarenessCursorState = {
  blockId?: string;
  anchor?: number;
  head?: number;
};

type AwarenessState = {
  user?: AwarenessUserState;
  cursor?: AwarenessCursorState;
};

type AwarenessLike = {
  getStates: () => Map<number, AwarenessState>;
  getLocalState: () => AwarenessState | null | undefined;
  setLocalState: (state: AwarenessState) => void;
  on: (eventName: "change", handler: () => void) => void;
  off: (eventName: "change", handler: () => void) => void;
};

type CurrentUserPresence = {
  id: string;
  username: string;
} | null;

interface DocumentEditorProps {
  document: Document;
}

const getUserColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

export const DocumentEditor = ({ document: initialDocument }: DocumentEditorProps) => {
  const yBlocksRef = useRef<Y.Array<Y.Map<unknown>> | null>(null);

  const router = useRouter();
  const [title, setTitle] = useState(initialDocument.title);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isHeadingPopoverOpen, setIsHeadingPopoverOpen] = useState(false);
  const [isParagraphPopoverOpen, setIsParagraphPopoverOpen] = useState(false);
  const [isListPopoverOpen, setIsListPopoverOpen] = useState(false);
  const [isCodePopoverOpen, setIsCodePopoverOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmCopyOpen, setConfirmCopyOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<"chat" | "article">("chat");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const blocksQueryInput = {
    documentId: initialDocument.id,
    cursor: 0,
    limit: 30,
  };

  const {
    data: blocksData,
    isLoading: blocksLoading,
    error: blocksError
  } = trpc.documents.getDocumentBlocksPage.useQuery(blocksQueryInput, {
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const updateDocumentMutation = trpc.documents.updateDocument.useMutation();
  const saveYjsStateMutation = trpc.documents.saveYjsState.useMutation();
  const saveYjsStateMutationRef = useRef(saveYjsStateMutation);
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
  const [remoteCursors, setRemoteCursors] = useState<
    { blockId: string; username: string; color: string; anchor?: number; head?: number }[]
  >([]);

  const [yjsBlocksSnapshot, setYjsBlocksSnapshot] = useState<
    { id: string; type: string; text: string; position: number }[]
  >([]);

  const ydocRef = useRef<Y.Doc | null>(null);
  const blocks = useMemo(
    () => {
      const dbBlocks = blocksData?.blocks ?? [];

      if (yjsBlocksSnapshot.length === 0) {
        return dbBlocks;
      }

      type BlockType = Block["type"];

      const dbById = new Map<string, Block>();
      for (const block of dbBlocks) {
        dbById.set(block.id, block);
      }

      const result: Block[] = [];

      const sortedSnapshot = [...yjsBlocksSnapshot].sort(
        (a, b) => a.position - b.position
      );

      sortedSnapshot.forEach((item) => {
        const id = item.id;
        if (!id) {
          return;
        }

        const dbBlock = dbById.get(id);
        const type = (item.type as BlockType) || dbBlock?.type || "paragraph";
        const text = item.text;
        const position = item.position;

        let base: Block;
        if (dbBlock) {
          base = dbBlock;
        } else {
          const content =
            type === "code"
              ? {
                  code: {
                    content: text,
                    language: "javascript",
                  },
                }
              : {
                  text: {
                    content: text,
                  },
                };

          base = {
            id,
            documentId: initialDocument.id,
            parentId: null,
            type,
            content,
            properties: {},
            position,
            version: 1,
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Block;
        }

        const nextContent = (() => {
          if (text === undefined || text === null) {
            return base.content;
          }

          if (type === "code") {
            type CodeContent = {
              code?: {
                content?: string;
                language?: string;
              };
            };
            const value = base.content as unknown as CodeContent;
            const language = value.code?.language ?? "javascript";
            return {
              code: {
                content: text,
                language,
              },
            } as unknown;
          }

          if (type === "list") {
            const lines = text ? text.split("\n") : [""];
            return {
              list: {
                items: lines,
              },
            } as unknown;
          }

          if (type === "todo") {
            const lines = text ? text.split("\n") : [""];
            const items = lines.map((raw) => {
              const line = raw.trim();
              if (!line) {
                return {
                  text: "",
                  checked: false,
                };
              }
              const checked =
                line.startsWith("[x] ") || line.startsWith("[X] ");
              const contentText = (() => {
                if (line.startsWith("[x] ") || line.startsWith("[X] ")) {
                  return line.slice(4);
                }
                if (line.startsWith("[ ] ")) {
                  return line.slice(4);
                }
                return line;
              })();
              return {
                text: contentText,
                checked,
              };
            });
            return {
              todo: {
                items,
              },
            } as unknown;
          }

          if (
            type === "heading_1" ||
            type === "heading_2" ||
            type === "heading_3" ||
            type === "paragraph" ||
            type === "quote"
          ) {
            return {
              text: {
                content: text,
              },
            } as unknown;
          }

          return base.content;
        })();

        result.push({
          ...base,
          type,
          content: nextContent,
          position,
        });

        dbById.delete(id);
      });

      return result;
    },
    [blocksData, yjsBlocksSnapshot, initialDocument.id]
  );
  const isLoading = blocksLoading && !blocksData;
  const sortedBlocksForCreate = useMemo(
    () => [...blocks].sort((a, b) => a.position - b.position),
    [blocks]
  );
  const lastBlockForCreate =
    sortedBlocksForCreate.length > 0
      ? sortedBlocksForCreate[sortedBlocksForCreate.length - 1]
      : null;

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
  const currentUserRef = useRef<CurrentUserPresence>(null);
  const awarenessRef = useRef<AwarenessLike | null>(null);

  useEffect(() => {
    saveYjsStateMutationRef.current = saveYjsStateMutation;
  }, [saveYjsStateMutation]);

  useEffect(() => {
    if (!currentUser) {
      currentUserRef.current = null;
      const awareness = awarenessRef.current;
      if (awareness) {
        const prevState = awareness.getLocalState() || {};
        const nextState: AwarenessState = {
          ...(prevState as AwarenessState),
          user: undefined,
        };
        awareness.setLocalState(nextState);
      }
      return;
    }
    currentUserRef.current = {
      id: currentUser.id,
      username: currentUser.username,
    };
    const awareness = awarenessRef.current;
    if (awareness) {
      const prevState = awareness.getLocalState() || {};
      const color = getUserColor(currentUser.id);
      const nextState: AwarenessState = {
        ...(prevState as AwarenessState),
        user: {
          id: currentUser.id,
          name: currentUser.username,
          color,
        },
      };
      awareness.setLocalState(nextState);
    }
  }, [currentUser]);

  useEffect(() => {
    const awareness = awarenessRef.current;
    if (!awareness) {
      return;
    }
    const prevState = awareness.getLocalState() || {};
    const nextState: AwarenessState = {
      ...(prevState as AwarenessState),
      cursor: selectedBlockId ? { blockId: selectedBlockId } : undefined,
    };
    awareness.setLocalState(nextState);
  }, [selectedBlockId]);

  const updateYjsBlocksSnapshot = useCallback(() => {
    const yBlocks = yBlocksRef.current;
    if (!yBlocks) {
      return;
    }

    const array = yBlocks.toArray() as Y.Map<unknown>[];
    const snapshot = array.map((item, index) => {
      const id = (item.get("id") as string) || "";
      const type = (item.get("type") as string) || "paragraph";
      const content = item.get("content");
      const rawPosition = item.get("position");
      const position =
        typeof rawPosition === "number" && Number.isFinite(rawPosition)
          ? (rawPosition as number)
          : index;
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
        position,
      };
    });

    setYjsBlocksSnapshot(snapshot);
  }, []);

  const selectedBlock = useMemo(
    () => (selectedBlockId ? blocks.find((block) => block.id === selectedBlockId) : undefined),
    [selectedBlockId, blocks]
  );

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

      utils.documents.getDocumentBlocksPage.setData(
        blocksQueryInput,
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

  const handleBlockSelectionChange = useCallback(
    (blockId: string, anchor: number, head: number) => {
      const awareness = awarenessRef.current;
      if (!awareness) {
        return;
      }
      const prevState = awareness.getLocalState() || {};
      const nextState: AwarenessState = {
        ...(prevState as AwarenessState),
        cursor: {
          blockId,
          anchor,
          head,
        },
      };
      awareness.setLocalState(nextState);
      setSelectedBlockId(blockId);
    },
    []
  );

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

  const handleBlockCreate = useCallback(
    async (blockData: Omit<Block, "id" | "createdAt" | "updatedAt">) => {
      try {
        if (!canEditDocument) {
          setError("你没有编辑文档的权限");
          setToastMessage("你没有编辑文档的权限");
          return;
        }

        setError(null);

        const yBlocks = yBlocksRef.current;
        if (!yBlocks) {
          return;
        }

        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);

        const position = (() => {
          if (typeof blockData.position === "number") {
            return blockData.position;
          }
          const array = yBlocks.toArray() as Y.Map<unknown>[];
          if (!array.length) {
            return 0;
          }
          const max = array.reduce((acc, item) => {
            const value = item.get("position");
            if (typeof value === "number" && value > acc) {
              return value;
            }
            return acc;
          }, 0);
          return max + 1;
        })();

        const yBlock = new Y.Map<unknown>();
        yBlock.set("id", id);
        yBlock.set("type", blockData.type);
        yBlock.set("position", position);

        const initialText = (() => {
          if (blockData.type === "code") {
            type CodeContent = {
              code?: {
                content?: string;
              };
            };
            const value = blockData.content as unknown as CodeContent;
            return value.code?.content ?? "";
          }
          type TextContent = {
            text?: {
              content?: string;
            };
          };
          const value = blockData.content as unknown as TextContent;
          return value.text?.content ?? "";
        })();

        const yText = new Y.Text(initialText);
        yBlock.set("content", yText);

        yBlocks.push([yBlock]);
      } catch (err) {
        console.error("Failed to create block:", err);
        setError(
          err instanceof Error ? err.message : "创建 Block 失败"
        );
      }
    },
    [canEditDocument]
  );

  const handleBlockCreateAfter = useCallback(
    async (
      afterBlockId: string,
      blockData: Omit<Block, "id" | "createdAt" | "updatedAt">
    ) => {
      try {
        if (!canEditDocument) {
          setError("你没有编辑文档的权限");
          setToastMessage("你没有编辑文档的权限");
          return;
        }

        setError(null);

        const yBlocks = yBlocksRef.current;
        if (!yBlocks) {
          return;
        }

        const array = yBlocks.toArray() as Y.Map<unknown>[];
        const afterIndex = array.findIndex(
          (item) => item.get("id") === afterBlockId
        );

        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);

        const insertIndex =
          afterIndex >= 0 ? afterIndex + 1 : array.length;

        const position = (() => {
          const next = array[insertIndex];
          const prev = array[insertIndex - 1];
          const prevPos =
            prev && typeof prev.get("position") === "number"
              ? (prev.get("position") as number)
              : insertIndex - 1;
          const nextPos =
            next && typeof next.get("position") === "number"
              ? (next.get("position") as number)
              : insertIndex;
          if (Number.isFinite(prevPos) && Number.isFinite(nextPos)) {
            return prevPos + (nextPos - prevPos) / 2;
          }
          return insertIndex;
        })();

        const yBlock = new Y.Map<unknown>();
        yBlock.set("id", id);
        yBlock.set("type", blockData.type);
        yBlock.set("position", position);

        const initialText = (() => {
          if (blockData.type === "code") {
            type CodeContent = {
              code?: {
                content?: string;
              };
            };
            const value = blockData.content as unknown as CodeContent;
            return value.code?.content ?? "";
          }
          type TextContent = {
            text?: {
              content?: string;
            };
          };
          const value = blockData.content as unknown as TextContent;
          return value.text?.content ?? "";
        })();

        const yText = new Y.Text(initialText);
        yBlock.set("content", yText);

        if (insertIndex >= yBlocks.length) {
          yBlocks.push([yBlock]);
        } else {
          yBlocks.insert(insertIndex, [yBlock]);
        }
      } catch (err) {
        console.error("Failed to create block after:", err);
        setError(
          err instanceof Error ? err.message : "创建 Block 失败"
        );
      }
    },
    [canEditDocument]
  );

  const handleBlockUpdate = useCallback(
    async (blockId: string, updates: Partial<Block>) => {
      try {
        if (!canEditDocument) {
          setError("你没有编辑文档的权限");
          setToastMessage("你没有编辑文档的权限");
          return;
        }

        setError(null);
        utils.documents.getDocumentBlocksPage.setData(
          blocksQueryInput,
          (oldData) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              blocks: oldData.blocks.map((block) =>
                block.id === blockId
                  ? { ...block, ...updates, updatedAt: new Date() }
                  : block
              ),
            };
          }
        );

        const yBlocks = yBlocksRef.current;
        if (!yBlocks) {
          return;
        }

        const array = yBlocks.toArray() as Y.Map<unknown>[];
        const target = array.find((item) => item.get("id") === blockId);
        if (!target) {
          return;
        }

        if (updates.type) {
          target.set("type", updates.type);
        }

        if (typeof updates.position === "number") {
          target.set("position", updates.position);
        }

        if (updates.content) {
          const content = target.get("content");
          const nextContent = updates.content as unknown;
          if (content instanceof Y.Text) {
            const value = (() => {
              if (!nextContent || typeof nextContent !== "object") {
                return "";
              }
              const v = nextContent as {
                text?: {
                  content?: string;
                };
                code?: {
                  content?: string;
                };
                list?: {
                  items?: string[];
                };
                todo?: {
                  items?: {
                    text?: string;
                    checked?: boolean;
                  }[];
                };
              };
              if (v.code && typeof v.code.content === "string") {
                return v.code.content;
              }
              if (v.text && typeof v.text.content === "string") {
                return v.text.content;
              }
              if (v.list && Array.isArray(v.list.items)) {
                return v.list.items
                  .map((item) => (typeof item === "string" ? item : ""))
                  .join("\n");
              }
              if (v.todo && Array.isArray(v.todo.items)) {
                const lines = v.todo.items.map((item) => {
                  const checked = !!item?.checked;
                  const prefix = checked ? "[x] " : "[ ] ";
                  const textValue =
                    typeof item?.text === "string" ? item.text : "";
                  return prefix + textValue.replace(/\r?\n/g, " ");
                });
                return lines.join("\n");
              }
              return "";
            })();
            content.delete(0, content.length);
            if (value) {
              content.insert(0, value);
            }
          }
        }
      } catch (err) {
        console.error("Failed to update block:", err);
        setError(
          err instanceof Error ? err.message : "更新 Block 失败"
        );
        await utils.documents.getDocumentBlocksPage.invalidate(
          blocksQueryInput
        );
      }
    },
    [canEditDocument, utils, blocksQueryInput]
  );

  const handleBlockDelete = useCallback(
    async (blockId: string) => {
      try {
        if (!canEditDocument) {
          setError("你没有编辑文档的权限");
          setToastMessage("你没有编辑文档的权限");
          return;
        }

        setError(null);
        deleteBlockFromYjs(blockId);
      } catch (err) {
        console.error("Failed to delete block:", err);
        setError(
          err instanceof Error ? err.message : "删除 Block 失败"
        );
      }
    },
    [canEditDocument, deleteBlockFromYjs]
  );

  useEffect(() => {
    void fetchOperations();
  }, [fetchOperations]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ydoc = new Y.Doc();

    if (initialDocument.yjsState && typeof initialDocument.yjsState === "string") {
      try {
        const buffer = Buffer.from(initialDocument.yjsState, "base64");
        const update = new Uint8Array(buffer);
        Y.applyUpdate(ydoc, update);
      } catch {
      }
    }
    const wsUrl =
      process.env.NEXT_PUBLIC_YJS_SERVER_WS_URL ||
      `ws://${window.location.hostname}:1234`;

    const provider = new WebsocketProvider(wsUrl, initialDocument.id, ydoc);
    const yBlocks = ydoc.getArray<Y.Map<unknown>>("blocks");
    const awareness = provider.awareness as unknown as AwarenessLike;

    ydocRef.current = ydoc;
    yBlocksRef.current = yBlocks;
    awarenessRef.current = awareness;

    const localUser = currentUserRef.current;
    if (localUser && localUser.id && localUser.username) {
      const prevState = awareness.getLocalState() || {};
      const color = getUserColor(localUser.id);
      const nextState: AwarenessState = {
        ...(prevState as AwarenessState),
        user: {
          id: localUser.id,
          name: localUser.username,
          color,
        },
      };
      awareness.setLocalState(nextState);
    }

    let saveTimeout: number | null = null;
    let updatesSinceLastPersist = 0;
    let lastPersistAt = Date.now();

    const handleYDocUpdate = () => {
      updateYjsBlocksSnapshot();

      if (!canEditDocument) {
        return;
      }

      updatesSinceLastPersist += 1;

      if (saveTimeout !== null) {
        window.clearTimeout(saveTimeout);
      }

      const now = Date.now();
      const isActive = updatesSinceLastPersist > 20 || now - lastPersistAt < 60000;
      const delay = isActive ? 5000 : 15000;

      saveTimeout = window.setTimeout(() => {
        if (!ydocRef.current) {
          return;
        }

        const update = Y.encodeStateAsUpdate(ydocRef.current);
        const stateArray = Array.from(update);

        const mutation = saveYjsStateMutationRef.current;
        void mutation.mutateAsync({
          documentId: initialDocument.id,
          state: stateArray,
        });
        updatesSinceLastPersist = 0;
        lastPersistAt = Date.now();
      }, delay);
    };

    const handleAwarenessChange = () => {
      const states = Array.from(awareness.getStates().values());
      const usernames = new Set<string>();
      const cursors: {
        blockId: string;
        username: string;
        color: string;
        anchor?: number;
        head?: number;
      }[] = [];
      const localUser = currentUserRef.current;
      const localUserId = localUser?.id;
      states.forEach((rawState) => {
        if (!rawState || typeof rawState !== "object") {
          return;
        }
        const state = rawState as AwarenessState;
        const user = state.user;
        const cursor = state.cursor;
        if (user && typeof user.name === "string") {
          usernames.add(user.name);
        }
        if (
          cursor &&
          typeof cursor.blockId === "string" &&
          (!localUserId || user?.id !== localUserId)
        ) {
          const baseId =
            (user && typeof user.id === "string" && user.id) ||
            (user && typeof user.name === "string" && user.name) ||
            cursor.blockId;
          const color =
            (user && typeof user.color === "string" && user.color) ||
            getUserColor(baseId);
          const username =
            (user && typeof user.name === "string" && user.name) ||
            "协作者";
          cursors.push({
            blockId: cursor.blockId,
            username,
            color,
            anchor: typeof cursor.anchor === "number" ? cursor.anchor : undefined,
            head: typeof cursor.head === "number" ? cursor.head : undefined,
          });
        }
      });
      setOnlineUsernames(Array.from(usernames));
      setRemoteCursors(cursors);
    };

    ydoc.on("update", handleYDocUpdate);
    awareness.on("change", handleAwarenessChange);
    updateYjsBlocksSnapshot();
    handleAwarenessChange();

    return () => {
      ydoc.off("update", handleYDocUpdate);
      awareness.off("change", handleAwarenessChange);
      if (saveTimeout !== null) {
        window.clearTimeout(saveTimeout);
      }
      yBlocksRef.current = null;
      ydocRef.current = null;
      awarenessRef.current = null;
      setOnlineUsernames([]);
      setRemoteCursors([]);
      provider.destroy();
      ydoc.destroy();
    };
  }, [initialDocument.id, canEditDocument, updateYjsBlocksSnapshot]);

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

  const getBlockTextContent = useCallback((block: Block | undefined) => {
    if (!block) {
      return "";
    }

    if (block.type === "code") {
      type CodeContent = {
        code?: {
          content?: string;
        };
      };
      const value = block.content as unknown as CodeContent;
      return value.code?.content ?? "";
    }

    if (block.type === "list") {
      type ListContent = {
        list?: {
          items?: string[];
        };
      };
      const value = block.content as unknown as ListContent;
      const items = value.list?.items ?? [];
      return items.join("\n");
    }

    if (block.type === "todo") {
      type TodoItem = {
        text?: string;
        checked?: boolean;
      };
      type TodoContent = {
        todo?: {
          items?: TodoItem[];
        };
      };
      const value = block.content as unknown as TodoContent;
      const items = value.todo?.items ?? [];
      return items.map((item) => item.text ?? "").join("\n");
    }

    type TextContent = {
      text?: {
        content?: string;
      };
    };
    const value = block.content as unknown as TextContent;
    return value.text?.content ?? "";
  }, []);

  const sendChat = useCallback(
    async (params: {
      content: string;
      mode?: "chat" | "edit";
      action?: RobotAction;
      useSelectedBlock?: boolean;
    }) => {
      const trimmed = params.content.trim();
      if (!trimmed) {
        return;
      }

      if (params.mode === "edit" && !canEditDocument) {
        setChatError("你没有编辑权限，无法对文档内容进行智能编辑");
        return;
      }

      const useBlock = params.useSelectedBlock ?? false;
      const targetBlock =
        useBlock && selectedBlock ? selectedBlock : undefined;

      if (useBlock && !targetBlock) {
        setChatError("请先在文档中点击一个段落，再使用该功能");
        return;
      }

      setChatError(null);
      setIsChatLoading(true);

      const now = new Date();
      const userMessage: ChatMessage = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${now.getTime()}_${Math.random().toString(36).slice(2)}`,
        role: "user",
        content: trimmed,
        createdAt: now,
      };

      const messagesForRequest = [...chatMessages, userMessage].map(
        (msg) => ({
          role: msg.role,
          content: msg.content,
        })
      );

      const documentContext: ChatRobotRequest["documentContext"] = {
        documentId: initialDocument.id,
        title: initialDocument.title,
      };

      if (targetBlock) {
        documentContext.blocks = [
          {
            documentId: initialDocument.id,
            blockId: targetBlock.id,
            content: getBlockTextContent(targetBlock),
          },
        ];
      }

      const target =
        targetBlock != null
          ? {
              type: "block" as const,
              documentId: initialDocument.id,
              blockId: targetBlock.id,
            }
          : {
              type: "document" as const,
              documentId: initialDocument.id,
            };

      const body: ChatRobotRequest = {
        messages: messagesForRequest,
        mode: params.mode ?? "chat",
        action: params.action ?? "chat",
        target,
        documentContext,
      };

      try {
        setChatMessages((prev) => [...prev, userMessage]);

        const response = await fetch("/api/chat/robot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          const message = errorData?.error ?? "聊天服务调用失败";
          setChatError(message);
          return;
        }

        const data = (await response.json()) as ChatRobotResponse;

        const fullText = data.reply ?? "";
        const assistantId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const assistantMessageBase: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: new Date(),
          metadata: data.metadata,
        };

        setChatMessages((prev) => [...prev, assistantMessageBase]);

        if (fullText) {
          let index = 0;
          const step = 4;

          const animate = () => {
            index += step;
            const nextText =
              index >= fullText.length ? fullText : fullText.slice(0, index);

            setChatMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: nextText } : msg
              )
            );

            if (index < fullText.length) {
              if (typeof window !== "undefined") {
                window.setTimeout(animate, 16);
              }
            }
          };

          if (typeof window !== "undefined") {
            window.setTimeout(animate, 0);
          } else {
            setChatMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: fullText } : msg
              )
            );
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "聊天服务调用失败";
        setChatError(message);
      } finally {
        setIsChatLoading(false);
      }
    },
    [
      canEditDocument,
      selectedBlock,
      chatMessages,
      initialDocument.id,
      initialDocument.title,
      getBlockTextContent,
    ]
  );

  const handleSendUserMessage = useCallback(async () => {
    const value = chatInput.trim();
    if (!value) {
      return;
    }
    await sendChat({
      content: value,
      mode: chatMode === "chat" ? "chat" : "edit",
      action: chatMode === "chat" ? "chat" : "rewrite",
      useSelectedBlock: chatMode === "article",
    });
    setChatInput("");
  }, [chatInput, sendChat, chatMode]);

  const handleQuickPolishCurrentBlock = useCallback(async () => {
    await sendChat({
      content:
        "请根据提供的文档上下文，对当前段落进行润色，改进表达并修正错别字，只返回修改后的完整段落。",
      mode: "edit",
      action: "polish",
      useSelectedBlock: true,
    });
  }, [sendChat]);

  const handleQuickFixTyposCurrentBlock = useCallback(async () => {
    await sendChat({
      content:
        "请只针对当前段落中的错别字和明显语法错误进行纠正，保持原意和结构不变，只返回纠正后的完整段落。",
      mode: "edit",
      action: "fix_typos",
      useSelectedBlock: true,
    });
  }, [sendChat]);

  const handleQuickSummarizeDocument = useCallback(async () => {
    await sendChat({
      content:
        "请基于当前文档内容生成一段简洁的中文摘要，突出核心结论和关键要点。",
      mode: "edit",
      action: "summarize",
      useSelectedBlock: false,
    });
  }, [sendChat]);

  const handleApplyLastAssistantToBlock = useCallback(() => {
    const lastAssistant = [...chatMessages]
      .reverse()
      .find((msg) => msg.role === "assistant");

    if (!lastAssistant) {
      setChatError("没有可应用的 AI 回复");
      return;
    }

    const targetBlockId =
      lastAssistant.metadata?.blockId ?? selectedBlockId;

    if (!targetBlockId) {
      setChatError("未找到目标内容块，请先选择一个段落");
      return;
    }

    const targetBlock = blocks.find((block) => block.id === targetBlockId);

    if (!targetBlock) {
      setChatError("目标内容块不存在或已被删除");
      return;
    }

    const newText = lastAssistant.content.trim();

    if (!newText) {
      setChatError("AI 返回内容为空，无法应用");
      return;
    }

    const updates: Partial<Block> = {};

    if (
      targetBlock.type === "heading_1" ||
      targetBlock.type === "heading_2" ||
      targetBlock.type === "heading_3" ||
      targetBlock.type === "paragraph" ||
      targetBlock.type === "quote"
    ) {
      updates.content = {
        text: {
          content: newText,
        },
      } as Block["content"];
    } else if (targetBlock.type === "code") {
      type CodeContent = {
        code?: {
          content?: string;
          language?: string;
        };
      };
      const value = targetBlock.content as unknown as CodeContent;
      updates.content = {
        code: {
          content: newText,
          language: value.code?.language ?? "javascript",
        },
      } as Block["content"];
    } else {
      setChatError("当前块类型暂不支持一键替换");
      return;
    }

    void handleBlockUpdate(targetBlock.id, updates);
  }, [chatMessages, selectedBlockId, blocks, handleBlockUpdate]);

  const handleInsertLastAssistantAsNewBlock = useCallback(() => {
    const lastAssistant = [...chatMessages]
      .reverse()
      .find((msg) => msg.role === "assistant");

    if (!lastAssistant) {
      setChatError("没有可插入的 AI 回复");
      return;
    }

    const baseBlockId = selectedBlockId ?? blocks[blocks.length - 1]?.id;

    if (!baseBlockId) {
      setChatError("未找到插入位置，请先创建至少一个内容块");
      return;
    }

    const baseBlock = blocks.find((block) => block.id === baseBlockId);

    if (!baseBlock) {
      setChatError("插入位置对应的内容块不存在");
      return;
    }

    const text = lastAssistant.content.trim();

    if (!text) {
      setChatError("AI 返回内容为空，无法插入");
      return;
    }

    void handleBlockCreateAfter(baseBlock.id, {
      documentId: initialDocument.id,
      parentId: baseBlock.parentId,
      type: "paragraph",
      content: {
        text: {
          content: text,
        },
      } as Block["content"],
      properties: {},
      position: baseBlock.position + 1,
      version: 1,
      createdBy: "",
    });
  }, [
    chatMessages,
    selectedBlockId,
    blocks,
    handleBlockCreateAfter,
    initialDocument.id,
  ]);

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
            type="button"
            onClick={() => setIsChatSidebarOpen((open) => !open)}
            size="sm"
            variant={isChatSidebarOpen ? "default" : "outline"}
            className="flex items-center gap-2"
          >
            <Bot className="size-4" />
            机器人
          </Button>
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

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-slate-900 text-white px-4 py-2 shadow-lg text-sm">
          {toastMessage}
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className={isChatSidebarOpen ? "flex-1" : "flex-1"}>
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="space-y-6">
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  readOnly={!canEditDocument}
                  placeholder="文档标题..."
                  className="text-3xl font-semibold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
                />

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
                    onBlockFocus={setSelectedBlockId}
                    remoteCursors={remoteCursors}
                    onSelectionChange={handleBlockSelectionChange}
                    readOnly={!canEditDocument}
                  />
                )}

                <div className="space-y-2">
                  <div className="text-xs text-slate-500">添加内容块</div>
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative inline-block">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() =>
                          setIsParagraphPopoverOpen((open) => !open)
                        }
                      >
                        <Plus className="size-4 mr-1" />
                        段落
                      </Button>
                      {isParagraphPopoverOpen && (
                        <div className="absolute z-20 mt-2 w-56 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md py-1">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={async () => {
                              if (lastBlockForCreate) {
                                await handleBlockCreateAfter(lastBlockForCreate.id, {
                                  documentId: initialDocument.id,
                                  parentId: lastBlockForCreate.parentId,
                                  type: "paragraph",
                                  content: { text: { content: "" } },
                                  properties: {},
                                  position: lastBlockForCreate.position + 1,
                                  version: 1,
                                  createdBy: "",
                                });
                              } else {
                                await handleBlockCreate({
                                  documentId: initialDocument.id,
                                  parentId: null,
                                  type: "paragraph",
                                  content: { text: { content: "" } },
                                  properties: {},
                                  position: 0,
                                  version: 1,
                                  createdBy: "",
                                });
                              }
                              setIsParagraphPopoverOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                段落
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                基础文本内容块，用于普通说明和叙述
                              </span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative inline-block">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() =>
                          setIsHeadingPopoverOpen((open) => !open)
                        }
                      >
                        <Heading1 className="size-4 mr-1" />
                        标题
                      </Button>
                      {isHeadingPopoverOpen && (
                        <div className="absolute z-20 mt-2 w-40 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md py-1">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={async () => {
                              if (lastBlockForCreate) {
                                await handleBlockCreateAfter(lastBlockForCreate.id, {
                                  documentId: initialDocument.id,
                                  parentId: lastBlockForCreate.parentId,
                                  type: "heading_1",
                                  content: { text: { content: "" } },
                                  properties: {},
                                  position: lastBlockForCreate.position + 1,
                                  version: 1,
                                  createdBy: "",
                                });
                              } else {
                                await handleBlockCreate({
                                  documentId: initialDocument.id,
                                  parentId: null,
                                  type: "heading_1",
                                  content: { text: { content: "" } },
                                  properties: {},
                                  position: 0,
                                  version: 1,
                                  createdBy: "",
                                });
                              }
                              setIsHeadingPopoverOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                标题
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                H1 标题，用于页面主标题
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={async () => {
                              if (lastBlockForCreate) {
                                await handleBlockCreateAfter(lastBlockForCreate.id, {
                                  documentId: initialDocument.id,
                                  parentId: lastBlockForCreate.parentId,
                                  type: "heading_2",
                                  content: { text: { content: "" } },
                                  properties: {},
                                  position: lastBlockForCreate.position + 1,
                                  version: 1,
                                  createdBy: "",
                                });
                              } else {
                                await handleBlockCreate({
                                  documentId: initialDocument.id,
                                  parentId: null,
                                  type: "heading_2",
                                  content: { text: { content: "" } },
                                  properties: {},
                                  position: 0,
                                  version: 1,
                                  createdBy: "",
                                });
                              }
                              setIsHeadingPopoverOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                小标题
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                H2 标题，用于章节标题
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={async () => {
                              if (lastBlockForCreate) {
                                await handleBlockCreateAfter(lastBlockForCreate.id, {
                                  documentId: initialDocument.id,
                                  parentId: lastBlockForCreate.parentId,
                                  type: "heading_3",
                                  content: { text: { content: "" } },
                                  properties: {},
                                  position: lastBlockForCreate.position + 1,
                                  version: 1,
                                  createdBy: "",
                                });
                              } else {
                                await handleBlockCreate({
                                  documentId: initialDocument.id,
                                  parentId: null,
                                  type: "heading_3",
                                  content: { text: { content: "" } },
                                  properties: {},
                                  position: 0,
                                  version: 1,
                                  createdBy: "",
                                });
                              }
                              setIsHeadingPopoverOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                次级标题
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                H3 标题，用于小节标题
                              </span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative inline-block">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setIsListPopoverOpen((open) => !open)}
                      >
                        <List className="size-4 mr-1" />
                        列表
                      </Button>
                      {isListPopoverOpen && (
                        <div className="absolute z-20 mt-2 w-56 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md py-1">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={async () => {
                              if (lastBlockForCreate) {
                                await handleBlockCreateAfter(lastBlockForCreate.id, {
                                  documentId: initialDocument.id,
                                  parentId: lastBlockForCreate.parentId,
                                  type: "list",
                                  content: { list: { items: [""] } },
                                  properties: {},
                                  position: lastBlockForCreate.position + 1,
                                  version: 1,
                                  createdBy: "",
                                });
                              } else {
                                await handleBlockCreate({
                                  documentId: initialDocument.id,
                                  parentId: null,
                                  type: "list",
                                  content: { list: { items: [""] } },
                                  properties: {},
                                  position: 0,
                                  version: 1,
                                  createdBy: "",
                                });
                              }
                              setIsListPopoverOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                项目列表
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                用于分条罗列要点或待办事项
                              </span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative inline-block">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setIsCodePopoverOpen((open) => !open)}
                      >
                        <Code className="size-4 mr-1" />
                        代码
                      </Button>
                      {isCodePopoverOpen && (
                        <div className="absolute z-20 mt-2 w-64 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md py-1">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={async () => {
                              if (lastBlockForCreate) {
                                await handleBlockCreateAfter(lastBlockForCreate.id, {
                                  documentId: initialDocument.id,
                                  parentId: lastBlockForCreate.parentId,
                                  type: "code",
                                  content: {
                                    code: {
                                      content: "",
                                      language: "javascript",
                                    },
                                  },
                                  properties: {},
                                  position: lastBlockForCreate.position + 1,
                                  version: 1,
                                  createdBy: "",
                                });
                              } else {
                                await handleBlockCreate({
                                  documentId: initialDocument.id,
                                  parentId: null,
                                  type: "code",
                                  content: {
                                    code: {
                                      content: "",
                                      language: "javascript",
                                    },
                                  },
                                  properties: {},
                                  position: 0,
                                  version: 1,
                                  createdBy: "",
                                });
                              }
                              setIsCodePopoverOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                代码块
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                展示格式化代码，默认语言为 JavaScript
                              </span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isChatSidebarOpen && (
          <div className="z-40 w-[360px] shrink-0 border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                    <Bot className="size-4" />
                  </span>
                  <span className="absolute -right-0.5 -bottom-0.5 inline-flex size-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-50">
                    文档助手
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    基于当前文档进行智能对话与编辑
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setIsChatSidebarOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="px-4 pt-2">
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/70 px-1 py-0.5 text-xs text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                  <Button
                    type="button"
                    size="sm"
                    variant={chatMode === "chat" ? "secondary" : "ghost"}
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => setChatMode("chat")}
                  >
                    对话模式
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={chatMode === "article" ? "secondary" : "ghost"}
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => setChatMode("article")}
                  >
                    段落改写
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    你可以直接提问，或切换到段落改写模式，并使用下方快捷按钮对当前段落进行润色、纠错或生成摘要。
                  </div>
                )}
                {chatMessages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          isUser
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>
              {chatError && (
                <div className="px-4 pb-2 text-xs text-red-500 dark:text-red-400">
                  {chatError}
                </div>
              )}
              <div className="px-4 pt-2 pb-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isChatLoading}
                    onClick={handleQuickPolishCurrentBlock}
                  >
                    润色当前段落
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isChatLoading}
                    onClick={handleQuickFixTyposCurrentBlock}
                  >
                    修正错别字
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isChatLoading}
                    onClick={handleQuickSummarizeDocument}
                  >
                    生成文档摘要
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isChatLoading}
                    onClick={handleApplyLastAssistantToBlock}
                  >
                    应用到当前段落
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isChatLoading}
                    onClick={handleInsertLastAssistantAsNewBlock}
                  >
                    插入为新段落
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="向机器人提问，或输入编辑指令..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!isChatLoading) {
                          await handleSendUserMessage();
                        }
                      }
                    }}
                    disabled={isChatLoading}
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleSendUserMessage}
                    disabled={isChatLoading || !chatInput.trim()}
                  >
                    {isChatLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
