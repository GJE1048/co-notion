"use client";

import { trpc } from "@/trpc/client";
import { redirect, notFound } from "next/navigation";
import { DocumentEditor } from "../components/document-editor";

interface DocumentViewProps {
  documentId: string;
}

export const DocumentView = ({ documentId }: DocumentViewProps) => {
  // 在开发环境中使用开发模式的查询绕过认证
  const {
    data: document,
    isLoading: documentLoading,
    error: documentError
  } = trpc.dev.getDocument.useQuery({ id: documentId });

  if (documentError) {
    if (documentError.data?.code === "NOT_FOUND") {
      notFound();
    }
    if (documentError.data?.code === "UNAUTHORIZED") {
      redirect("/documents");
    }
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p className="text-red-600 dark:text-red-400">
            加载文档失败：{documentError.message}
          </p>
        </div>
      </div>
    );
  }

  if (documentLoading || !document) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-slate-500">加载文档中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <DocumentEditor document={document} />
    </div>
  );
};
