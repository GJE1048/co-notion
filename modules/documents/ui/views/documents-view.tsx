"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Plus, FolderPlus } from "lucide-react";

export const DocumentsView = () => {
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const {
    data: documents,
    isLoading,
    error
  } = trpc.documents.getUserDocuments.useQuery();

  const { data: workspaces } = trpc.workspaces.getUserWorkspaces.useQuery();

  const createDocumentMutation = trpc.documents.createDocument.useMutation({
    onSuccess: (newDocument) => {
      // 重定向到新创建的文档
      window.location.href = `/documents/${newDocument.id}`;
    },
  });

  const createWorkspaceMutation = trpc.workspaces.createWorkspace.useMutation({
    onSuccess: () => {
      setIsCreateWorkspaceDialogOpen(false);
      setWorkspaceName("");
      // 重新获取文档列表以显示新工作区
      window.location.reload();
    },
  });

  const handleCreateDocument = () => {
    createDocumentMutation.mutate({
      title: "未命名文档",
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

  const workspaceGroups = useMemo(() => {
    if (!workspaces || workspaces.length === 0) {
      if (!documents || documents.length === 0) return [];
      return [
        {
          workspaceId: null as string | null,
          workspaceName: "我的文档",
          isPersonal: true,
          documents,
        },
      ];
    }

    const allDocuments = documents ?? [];

    const groups = workspaces.map((ws) => ({
      workspaceId: ws.id as string | null,
      workspaceName: ws.name,
      isPersonal: ws.isPersonal,
      documents: allDocuments.filter((doc) => doc.workspace?.id === ws.id),
    }));

    const unassignedDocuments = allDocuments.filter((doc) => !doc.workspace?.id);
    if (unassignedDocuments.length > 0) {
      groups.unshift({
        workspaceId: null,
        workspaceName: "未分配工作区",
        isPersonal: false,
        documents: unassignedDocuments,
      });
    }

    groups.sort((a, b) => {
      if (a.isPersonal && !b.isPersonal) return -1;
      if (!a.isPersonal && b.isPersonal) return 1;
      return a.workspaceName.localeCompare(b.workspaceName, "zh-CN");
    });

    return groups;
  }, [documents, workspaces]);

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
            onClick={handleCreateDocument}
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
              onClick={handleCreateDocument}
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
          {workspaceGroups.map((group) => (
            <section key={group.workspaceId ?? "unknown"} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {group.isPersonal ? "我的文档" : group.workspaceName}
                </h2>
                {!group.isPersonal && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {group.workspaceName}
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
                  {group.documents.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="group"
                    >
                      <Card className="h-full border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all">
                        <CardContent className="p-4">
                          <h3 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2">
                            {doc.title || "未命名文档"}
                          </h3>
                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>
                              更新时间：{new Date(doc.updatedAt).toLocaleDateString()}
                            </span>
                            {doc.workspace && (
                              <span className="text-slate-400 dark:text-slate-500">
                                {doc.workspace.name}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
