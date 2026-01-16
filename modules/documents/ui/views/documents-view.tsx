"use client";

import Link from "next/link";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FileText, Plus } from "lucide-react";

export const DocumentsView = () => {
  // 使用开发模式的查询绕过认证
  const {
    data: documents,
    isLoading,
    error
  } = trpc.devGetUserDocuments.useQuery();

  const createDocumentMutation = trpc.documents.createDocument.useMutation({
    onSuccess: (newDocument) => {
      // 重定向到新创建的文档
      window.location.href = `/documents/${newDocument.id}`;
    },
  });

  const handleCreateDocument = () => {
    createDocumentMutation.mutate({
      title: "未命名文档",
    });
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="group"
            >
              <Card className="h-full border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all">
                <CardContent className="p-4">
                  <h2 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2">
                    {doc.title || "未命名文档"}
                  </h2>
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
    </div>
  );
};
