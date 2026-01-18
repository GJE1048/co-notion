"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Plus, FolderPlus, MoreHorizontal, ChevronsDown } from "lucide-react";

export const DocumentsView = () => {
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("admin");
  const [inviteLink, setInviteLink] = useState("");
  const [isCreateDocumentDialogOpen, setIsCreateDocumentDialogOpen] = useState(false);
  const [newDocumentWorkspaceId, setNewDocumentWorkspaceId] = useState<string>("");
  const [activeDocumentMenuId, setActiveDocumentMenuId] = useState<string | null>(null);
  const [confirmDeleteDocumentId, setConfirmDeleteDocumentId] = useState<string | null>(null);
  const [confirmCopyDocumentId, setConfirmCopyDocumentId] = useState<string | null>(null);
  const [moveDocumentId, setMoveDocumentId] = useState<string | null>(null);
  const [moveTargetWorkspaceId, setMoveTargetWorkspaceId] = useState<string>("");
  const [shareDocumentId, setShareDocumentId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const {
    data: documents,
    isLoading,
    isFetching,
    error
  } = trpc.documents.getUserDocuments.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: workspaces } = trpc.workspaces.getUserWorkspaces.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();

  const createDocumentMutation = trpc.documents.createDocument.useMutation({
    onSuccess: (newDocument) => {
      // 重定向到新创建的文档
      window.location.href = `/documents/${newDocument.id}`;
    },
  });

  const deleteDocumentMutation = trpc.documents.deleteDocument.useMutation({
    onMutate: async (input) => {
      await utils.documents.getUserDocuments.cancel();

      const previousDocuments = utils.documents.getUserDocuments.getData();

      utils.documents.getUserDocuments.setData(undefined, (current) => {
        if (!current) return current;
        return current.filter((doc) => doc.id !== input.id);
      });

      return { previousDocuments };
    },
    onError: (_error, _input, context) => {
      if (context?.previousDocuments) {
        utils.documents.getUserDocuments.setData(undefined, context.previousDocuments);
      }
      alert("删除文档失败，请稍后重试。");
    },
    onSettled: async () => {
      await utils.documents.getUserDocuments.invalidate();
    },
  });

  const duplicateDocumentMutation = trpc.documents.duplicateDocument.useMutation({
    onSuccess: (newDocument) => {
      window.location.href = `/documents/${newDocument.id}`;
    },
  });

  const createWorkspaceMutation = trpc.workspaces.createWorkspace.useMutation({
    onMutate: async (input) => {
      setIsCreateWorkspaceDialogOpen(false);
      setWorkspaceName("");

      await utils.workspaces.getUserWorkspaces.cancel();

      const previousWorkspaces = utils.workspaces.getUserWorkspaces.getData() || [];

      const optimisticWorkspace: {
        id: string;
        name: string;
        isPersonal: boolean;
        permissions: unknown;
        createdAt: Date;
        updatedAt: Date;
        userRole: "creator";
      } = {
        id: `optimistic-${Date.now()}`,
        name: input.name,
        isPersonal: input.isPersonal ?? true,
        permissions: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        userRole: "creator",
      };

      const current = utils.workspaces.getUserWorkspaces.getData();
      if (!current) {
        utils.workspaces.getUserWorkspaces.setData(undefined, [optimisticWorkspace]);
      } else {
        utils.workspaces.getUserWorkspaces.setData(undefined, [...current, optimisticWorkspace]);
      }

      return { previousWorkspaces: previousWorkspaces.length ? previousWorkspaces : undefined };
    },
    onError: (_error, _input, context) => {
      if (context?.previousWorkspaces) {
        utils.workspaces.getUserWorkspaces.setData(undefined, context.previousWorkspaces);
      }
      alert("创建工作区失败，请稍后重试。");
    },
    onSettled: async () => {
      await utils.workspaces.getUserWorkspaces.invalidate();
    },
  });

  const handleOpenCreateDocumentDialog = () => {
    setNewDocumentWorkspaceId("");
    setIsCreateDocumentDialogOpen(true);
  };

  const handleConfirmCreateDocument = () => {
    createDocumentMutation.mutate({
      title: "未命名文档",
      workspaceId: newDocumentWorkspaceId || undefined,
    });
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;

    createWorkspaceMutation.mutate({
      name: workspaceName.trim(),
      isPersonal: false, // 创建团队工作区
    });
  };

  const handleGenerateInviteLink = () => {
    if (!inviteWorkspaceId) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.pathname = "/invite/workspace";
    url.searchParams.set("workspaceId", inviteWorkspaceId);
    url.searchParams.set("role", inviteRole);
    const fullLink = url.toString();
    setInviteLink(fullLink);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullLink).catch(() => {});
    }
  };

  const workspaceGroups = useMemo(() => {
    if (!documents || documents.length === 0) return [];

    const allDocuments = documents;
    const userWorkspaces = workspaces || [];

    if (userWorkspaces.length === 0) {
      return [
        {
          workspaceId: null as string | null,
          workspaceName: "我的文档",
          isPersonal: true,
          workspaceRole: "creator" as "creator" | "admin" | "viewer",
          documents: allDocuments,
        },
      ];
    }

    const groups = userWorkspaces.map((ws) => ({
      workspaceId: ws.id as string | null,
      workspaceName: ws.name,
      isPersonal: ws.isPersonal,
      workspaceRole: ws.userRole,
      documents: allDocuments.filter((doc) => doc.workspace?.id === ws.id),
    }));

    const unassignedDocuments = allDocuments.filter((doc) => !doc.workspace?.id);
    if (unassignedDocuments.length > 0) {
      groups.unshift({
        workspaceId: "unassigned" as string | null,
        workspaceName: "未分配工作区",
        isPersonal: false,
        workspaceRole: "creator" as "creator" | "admin" | "viewer",
        documents: unassignedDocuments,
      });
    }

    const sharedDocuments = allDocuments.filter((doc) => {
      if (!doc.workspace?.id) return false;
      return !userWorkspaces.some((ws) => ws.id === doc.workspace?.id);
    });

    if (sharedDocuments.length > 0) {
      groups.push({
        workspaceId: "shared" as string | null,
        workspaceName: "共享文档",
        isPersonal: false,
        workspaceRole: "viewer" as "creator" | "admin" | "viewer",
        documents: sharedDocuments,
      });
    }

    groups.sort((a, b) => {
      if (a.isPersonal && !b.isPersonal) return -1;
      if (!a.isPersonal && b.isPersonal) return 1;
      return a.workspaceName.localeCompare(b.workspaceName, "zh-CN");
    });

    return groups;
  }, [documents, workspaces]);

  const nonPersonalWorkspaces = (workspaces || []).filter((ws) => !ws.isPersonal);

  const isDeletingDocument = deleteDocumentMutation.isPending;
  const isDuplicatingDocument = duplicateDocumentMutation.isPending;

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          我的文档
        </h1>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p className="text-red-600 dark:text-red-400">
            加载文档失败：{error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            我的文档
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            管理你在 CO-NOTION 中的所有文档。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isCreateWorkspaceDialogOpen} onOpenChange={setIsCreateWorkspaceDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <FolderPlus className="size-4" />
                新建工作区
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>创建新工作区</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label htmlFor="workspace-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    工作区名称
                  </label>
                  <Input
                    id="workspace-name"
                    type="text"
                    placeholder="输入工作区名称..."
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    disabled={createWorkspaceMutation.isPending}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateWorkspaceDialogOpen(false)}
                    disabled={createWorkspaceMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={createWorkspaceMutation.isPending || !workspaceName.trim()}
                  >
                    {createWorkspaceMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        创建中...
                      </>
                    ) : (
                      "创建工作区"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            onClick={handleOpenCreateDocumentDialog}
            disabled={createDocumentMutation.isPending}
            className="flex items-center gap-2"
          >
            {createDocumentMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            新建文档
          </Button>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">邀请成员</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>邀请用户到工作区</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">选择工作区</label>
                  <select
                    className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-slate-900"
                    value={inviteWorkspaceId}
                    onChange={(e) => setInviteWorkspaceId(e.target.value)}
                  >
                    <option value="">请选择</option>
                    {(workspaces || []).map((ws) => (
                      <option key={ws.id} value={ws.id as string}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">权限</label>
                  <select
                    className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-slate-900"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "editor" | "viewer")}
                  >
                    <option value="admin">管理员</option>
                    <option value="editor">编辑者</option>
                    <option value="viewer">查看者</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    邀请链接
                  </label>
                  <Input
                    type="text"
                    readOnly
                    value={inviteLink}
                    placeholder="先选择工作区和权限，然后生成邀请链接"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInviteOpen(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    disabled={!inviteWorkspaceId}
                    onClick={handleGenerateInviteLink}
                  >
                    生成并复制链接
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-500">加载文档中...</span>
        </div>
      ) : !documents || documents.length === 0 ? (
        <Card className="mt-10 border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40">
          <CardContent className="p-8 text-center">
            <FileText className="size-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              你还没有任何文档。
            </p>
            <p className="text-slate-500 dark:text-slate-500 mb-4 text-sm">
              从一个空白文档开始，或者回到首页选择一个模板。
            </p>
            <Button
              onClick={handleOpenCreateDocumentDialog}
              disabled={createDocumentMutation.isPending}
              className="flex items-center gap-2"
            >
              {createDocumentMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              新建你的第一个文档
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {workspaceGroups.map((group) => {
            const groupKey = group.workspaceId ?? "personal";
            const isCollapsible = !group.isPersonal;
            const isCollapsed = isCollapsible ? collapsedGroups[groupKey] ?? true : false;
            const documentsToRender = isCollapsed ? group.documents.slice(0, 3) : group.documents;

            return (
              <section key={groupKey} className="space-y-3">
                <div className="flex items-baseline space-x-4">
                  <div className="flex items-center gap-2">
                    {isCollapsible && (
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGroups((prev) => ({
                            ...prev,
                            [groupKey]: !isCollapsed,
                          }))
                        }
                        className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-transform"
                        aria-label={isCollapsed ? "展开工作区文档" : "收起工作区文档"}
                      >
                        <ChevronsDown
                          strokeWidth={2.5}
                          className={`size-5 transform transition-transform ${
                            isCollapsed ? "-rotate-90" : "rotate-0"
                          }`}
                        />
                      </button>
                    )}
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {group.workspaceId === "shared"
                        ? "共享文档"
                        : group.isPersonal
                        ? "我的文档"
                        : group.workspaceName}
                    </h2>
                  </div>
                  {group.workspaceId !== "shared" && !group.isPersonal && group.workspaceRole && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {group.workspaceRole === "creator"
                        ? "创建者"
                        : group.workspaceRole === "admin"
                        ? "管理员"
                        : "查看者"}
                    </span>
                  )}
                </div>
              {group.documents.length === 0 ? (
                <Card className="border-dashed border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40">
                  <CardContent className="p-6 text-sm text-slate-500 dark:text-slate-400">
                    暂无文档。
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documentsToRender.map((doc) => (
                    <Card
                      key={doc.id}
                      className="group relative h-full border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="flex-1"
                          >
                            <h3 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2">
                              {doc.title || "未命名文档"}
                            </h3>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                              <span>
                                更新时间：{new Date(doc.updatedAt).toLocaleDateString()}
                              </span>
                              
                            </div>
                          </Link>
                          {(group.workspaceRole === "creator" || group.workspaceRole === "admin" || group.isPersonal) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveDocumentMenuId((current) =>
                                  current === doc.id ? null : doc.id
                                );
                              }}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          )}
                        </div>
                        {activeDocumentMenuId === doc.id && (group.workspaceRole === "creator" || group.workspaceRole === "admin" || group.isPersonal) && (
                          <div className="absolute top-2 right-2 z-20 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md py-1 min-w-[140px]">
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={() => {
                                setMoveDocumentId(doc.id);
                                setMoveTargetWorkspaceId(doc.workspace?.id ? String(doc.workspace.id) : "");
                                setActiveDocumentMenuId(null);
                              }}
                            >
                              移动
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={() => {
                                setShareDocumentId(doc.id);
                                setShareLink("");
                                setActiveDocumentMenuId(null);
                              }}
                            >
                              分享
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={() => {
                                setConfirmCopyDocumentId(doc.id);
                                setActiveDocumentMenuId(null);
                              }}
                              disabled={isDuplicatingDocument}
                            >
                              复制
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => {
                                setConfirmDeleteDocumentId(doc.id);
                                setActiveDocumentMenuId(null);
                              }}
                              disabled={isDeletingDocument}
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
            );
          })}
        </div>
      )}

      <Dialog
        open={isCreateDocumentDialogOpen}
        onOpenChange={(open) => {
          if (!createDocumentMutation.isPending) {
            setIsCreateDocumentDialogOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择工作区</DialogTitle>
            <DialogDescription>
              请选择新文档要放入的工作区，默认放入“我的文档”。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                工作区
              </label>
              <select
                className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-slate-900"
                value={newDocumentWorkspaceId}
                onChange={(e) => setNewDocumentWorkspaceId(e.target.value)}
                disabled={createDocumentMutation.isPending}
              >
                <option value="">我的文档</option>
                {nonPersonalWorkspaces.map((ws) => (
                  <option key={ws.id} value={ws.id as string}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateDocumentDialogOpen(false)}
              disabled={createDocumentMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCreateDocument}
              disabled={createDocumentMutation.isPending}
            >
              {createDocumentMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  创建中...
                </>
              ) : (
                "创建文档"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmDeleteDocumentId}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDeleteDocumentId(null);
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
              onClick={() => setConfirmDeleteDocumentId(null)}
              disabled={isDeletingDocument}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (!confirmDeleteDocumentId) return;
                try {
                  await deleteDocumentMutation.mutateAsync({ id: confirmDeleteDocumentId });
                  setConfirmDeleteDocumentId(null);
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
        open={!!confirmCopyDocumentId}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmCopyDocumentId(null);
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
              onClick={() => setConfirmCopyDocumentId(null)}
              disabled={isDuplicatingDocument}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!confirmCopyDocumentId) return;
                try {
                  await duplicateDocumentMutation.mutateAsync({ documentId: confirmCopyDocumentId });
                  setConfirmCopyDocumentId(null);
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

      <Dialog
        open={!!moveDocumentId}
        onOpenChange={(open) => {
          if (!open) {
            setMoveDocumentId(null);
            setMoveTargetWorkspaceId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>移动文档</DialogTitle>
            <DialogDescription>
              选择一个目标工作区，将文档从当前工作区移动过去。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                目标工作区
              </label>
              <select
                className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-slate-900"
                value={moveTargetWorkspaceId}
                onChange={(event) => setMoveTargetWorkspaceId(event.target.value)}
              >
                <option value="">请选择</option>
                {nonPersonalWorkspaces.map((ws) => (
                  <option key={ws.id} value={String(ws.id)}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMoveDocumentId(null);
                setMoveTargetWorkspaceId("");
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={!moveDocumentId || !moveTargetWorkspaceId}
              onClick={async () => {
                if (!moveDocumentId || !moveTargetWorkspaceId) return;
                try {
                  await trpc.documents.updateDocument.mutateAsync({
                    id: moveDocumentId,
                    data: { workspaceId: moveTargetWorkspaceId },
                  } as never);
                  setMoveDocumentId(null);
                  setMoveTargetWorkspaceId("");
                  await utils.documents.getUserDocuments.invalidate();
                  await utils.workspaces.getUserWorkspaces.invalidate();
                } catch {
                }
              }}
            >
              确认移动
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!shareDocumentId}
        onOpenChange={(open) => {
          if (!open) {
            setShareDocumentId(null);
            setShareLink("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>分享文档</DialogTitle>
            <DialogDescription>
              生成一个分享链接，邀请其他用户协同编辑此文档。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                分享链接
              </label>
              <Input
                type="text"
                readOnly
                value={shareLink}
                placeholder="点击下方按钮生成分享链接"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShareDocumentId(null);
                setShareLink("");
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={!shareDocumentId}
              onClick={() => {
                if (!shareDocumentId || typeof window === "undefined") return;
                const url = new URL(window.location.href);
                url.pathname = "/invite/document";
                url.searchParams.set("documentId", shareDocumentId);
                const fullLink = url.toString();
                setShareLink(fullLink);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(fullLink).catch(() => {});
                }
              }}
            >
              生成并复制链接
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
