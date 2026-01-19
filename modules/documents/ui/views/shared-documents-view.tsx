"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UserX } from "lucide-react";

type CollaboratorRole = "owner" | "editor" | "viewer";

type ShareLog = {
  message: string;
  type: "share" | "revoke";
  createdAt: string;
};

export const SharedDocumentsView = () => {
  const [viewMode, setViewMode] = useState<"byMe" | "toMe">("byMe");

  const {
    data: sharedByMeData,
    isLoading: isLoadingByMe,
    error: errorByMe,
  } = trpc.documents.getSharedDocumentsByMe.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: sharedToMeData,
    isLoading: isLoadingToMe,
    error: errorToMe,
  } = trpc.documents.getDocumentsSharedWithMe.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: viewMode === "toMe",
  });

  const utils = trpc.useUtils();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const updateRoleMutation = trpc.documents.updateCollaboratorRole.useMutation({
    onMutate: async (input) => {
      setUpdatingKey(`${input.documentId}:${input.userId}:role`);

      await utils.documents.getSharedDocumentsByMe.cancel();

      const previous = utils.documents.getSharedDocumentsByMe.getData();

      utils.documents.getSharedDocumentsByMe.setData(undefined, (current) => {
        if (!current) return current;
        return current.map((doc) => {
          if (doc.id !== input.documentId) return doc;
          return {
            ...doc,
            collaborators: doc.collaborators.map((collab) =>
              collab.userId === input.userId
                ? { ...collab, role: input.role }
                : collab
            ),
          };
        });
      });

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        utils.documents.getSharedDocumentsByMe.setData(undefined, context.previous);
      }
      setUpdatingKey(null);
      alert("更新协作者权限失败，请稍后重试。");
    },
    onSuccess: () => {
      setUpdatingKey(null);
    },
    onSettled: async () => {
      await utils.documents.getSharedDocumentsByMe.invalidate();
    },
  });

  const removeMutation = trpc.documents.removeCollaborator.useMutation({
    onMutate: async (input) => {
      setUpdatingKey(`${input.documentId}:${input.userId}:remove`);

      await utils.documents.getSharedDocumentsByMe.cancel();

      const previous = utils.documents.getSharedDocumentsByMe.getData();

      utils.documents.getSharedDocumentsByMe.setData(undefined, (current) => {
        if (!current) return current;
        return current.map((doc) => {
          if (doc.id !== input.documentId) return doc;
          return {
            ...doc,
            collaborators: doc.collaborators.filter(
              (collab) => collab.userId !== input.userId
            ),
          };
        });
      });

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        utils.documents.getSharedDocumentsByMe.setData(undefined, context.previous);
      }
      setUpdatingKey(null);
      alert("移除协作者失败，请稍后重试。");
    },
    onSuccess: () => {
      setUpdatingKey(null);
    },
    onSettled: async () => {
      await utils.documents.getSharedDocumentsByMe.invalidate();
    },
  });

  const documentsByMe = useMemo(() => sharedByMeData ?? [], [sharedByMeData]);
  const documentsToMe = useMemo(() => sharedToMeData ?? [], [sharedToMeData]);

  const isLoading = viewMode === "byMe" ? isLoadingByMe : isLoadingToMe;
  const error = viewMode === "byMe" ? errorByMe : errorToMe;

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

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          共享文档
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {viewMode === "byMe"
            ? "查看你发起分享的文档，并管理每个协作者的权限。"
            : "查看其他用户分享给你的文档。"}
        </p>
      </div>
      <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1 text-xs">
        <button
          type="button"
          className={`px-3 py-1 rounded-full transition-colors ${
            viewMode === "byMe"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
          onClick={() => setViewMode("byMe")}
        >
          我分享的
        </button>
        <button
          type="button"
          className={`ml-1 px-3 py-1 rounded-full transition-colors ${
            viewMode === "toMe"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
          onClick={() => setViewMode("toMe")}
        >
          共享给我的
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <CardContent className="py-10 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            <span>
              {viewMode === "byMe" ? "正在加载你分享的文档..." : "正在加载共享给你的文档..."}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {header}
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

  return (
    <div className="space-y-6">
      {header}

      {viewMode === "byMe" ? (
        documentsByMe.length === 0 ? (
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
        ) : (
          <div className="space-y-4">
            {documentsByMe.map((doc) => {
              const shareLogs: ShareLog[] = Array.isArray(doc.shareLogs)
                ? doc.shareLogs.filter((log): log is ShareLog => {
                    if (!log || typeof log !== "object") return false;
                    const entry = log as Record<string, unknown>;
                    return (
                      typeof entry.message === "string" &&
                      (entry.type === "share" || entry.type === "revoke") &&
                      typeof entry.createdAt === "string"
                    );
                  })
                : [];

              return (
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
                    {shareLogs.length > 0 && (
                      <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          操作日志
                        </div>
                        <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                          {shareLogs
                            .slice()
                            .reverse()
                            .slice(0, 10)
                            .map((log, index) => (
                              <li key={index}>
                                <span className={log.type === "share" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                                  {log.message}
                                </span>
                                <span className="ml-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  {new Date(log.createdAt).toLocaleString()}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        documentsToMe.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <p className="text-slate-600 dark:text-slate-400">
                目前还没有其他用户向你分享文档。
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500">
                当其他用户使用分享功能邀请你协作时，你可以在这里看到对应的文档。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {documentsToMe.map((doc) => {
              const shareLogs: ShareLog[] = Array.isArray(doc.shareLogs)
                ? doc.shareLogs.filter((log): log is ShareLog => {
                    if (!log || typeof log !== "object") return false;
                    const entry = log as Record<string, unknown>;
                    return (
                      typeof entry.message === "string" &&
                      (entry.type === "share" || entry.type === "revoke") &&
                      typeof entry.createdAt === "string"
                    );
                  })
                : [];

              const roleLabel =
                doc.collaboratorRole === "owner"
                  ? "拥有者"
                  : doc.collaboratorRole === "editor"
                  ? "编辑者"
                  : "查看者";

              return (
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
                    <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                      <div>
                        拥有者：<span className="font-medium">{doc.owner.username}</span>
                      </div>
                      <div>
                        我的权限：<span className="font-medium">{roleLabel}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        分享时间：{new Date(doc.sharedAt).toLocaleString()}
                      </div>
                    </div>
                    {shareLogs.length > 0 && (
                      <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          操作日志
                        </div>
                        <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                          {shareLogs
                            .slice()
                            .reverse()
                            .slice(0, 10)
                            .map((log, index) => (
                              <li key={index}>
                                <span className={log.type === "share" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                                  {log.message}
                                </span>
                                <span className="ml-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  {new Date(log.createdAt).toLocaleString()}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};
