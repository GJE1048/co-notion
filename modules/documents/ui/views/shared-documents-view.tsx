"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserX } from "lucide-react";

type CollaboratorRole = "owner" | "editor" | "viewer";

export const SharedDocumentsView = () => {
  const { data, isLoading, error } = trpc.documents.getSharedDocumentsByMe.useQuery();
  const utils = trpc.useUtils();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const updateRoleMutation = trpc.documents.updateCollaboratorRole.useMutation({
    onSuccess: async () => {
      setUpdatingKey(null);
      await utils.documents.getSharedDocumentsByMe.invalidate();
    },
    onError: () => {
      setUpdatingKey(null);
    },
  });

  const removeMutation = trpc.documents.removeCollaborator.useMutation({
    onSuccess: async () => {
      setUpdatingKey(null);
      await utils.documents.getSharedDocumentsByMe.invalidate();
    },
    onError: () => {
      setUpdatingKey(null);
    },
  });

  const documents = useMemo(() => data ?? [], [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          共享文档
        </h1>
        <Card>
          <CardContent className="py-10 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            <span>正在加载你的共享文档...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          共享文档
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>加载失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 dark:text-red-400">
              {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          共享文档
        </h1>
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-slate-600 dark:text-slate-400">
              你还没有向其他用户分享任何文档。
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              在文档编辑页中使用分享功能，邀请其他用户协作编辑文档。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleChangeRole = (documentId: string, userId: string, role: CollaboratorRole) => {
    setUpdatingKey(`${documentId}:${userId}:role`);
    updateRoleMutation.mutate({
      documentId,
      userId,
      role,
    });
  };

  const handleRemove = (documentId: string, userId: string) => {
    setUpdatingKey(`${documentId}:${userId}:remove`);
    removeMutation.mutate({
      documentId,
      userId,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          共享文档
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          查看你发起分享的文档，并管理每个协作者的权限。
        </p>
      </div>

      <div className="space-y-4">
        {documents.map((doc) => (
          <Card key={doc.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <Link href={`/documents/${doc.id}`} className="text-lg font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                  {doc.title || "未命名文档"}
                </Link>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  {doc.workspace?.name && (
                    <span>所在工作区：{doc.workspace.name}</span>
                  )}
                  <span>
                    最近更新：{new Date(doc.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {doc.collaborators.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  当前没有协作者。
                </p>
              ) : (
                <div className="space-y-3">
                  {doc.collaborators.map((collab) => {
                    const isUpdatingRole = updatingKey === `${doc.id}:${collab.userId}:role` && updateRoleMutation.isPending;
                    const isRemoving = updatingKey === `${doc.id}:${collab.userId}:remove` && removeMutation.isPending;

                    return (
                      <div
                        key={collab.userId}
                        className="flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-700 dark:text-slate-100">
                            {collab.username?.slice(0, 2) || "U"}
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {collab.username}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              加入时间：{new Date(collab.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="border rounded-md px-2 py-1 text-sm bg-white dark:bg-slate-900"
                            value={collab.role as CollaboratorRole}
                            onChange={(event) =>
                              handleChangeRole(
                                doc.id,
                                collab.userId,
                                event.target.value as CollaboratorRole,
                              )
                            }
                            disabled={isUpdatingRole || isRemoving}
                          >
                            <option value="owner">拥有者</option>
                            <option value="editor">编辑者</option>
                            <option value="viewer">查看者</option>
                          </select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                            onClick={() => handleRemove(doc.id, collab.userId)}
                            disabled={isRemoving || isUpdatingRole}
                          >
                            {isRemoving ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <UserX className="size-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
