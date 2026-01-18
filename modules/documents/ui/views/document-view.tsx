"use client";

import { trpc } from "@/trpc/client";
import { redirect, notFound } from "next/navigation";
import { DocumentEditor } from "../components/document-editor";

interface DocumentViewProps {
  documentId: string;
}

export const DocumentView = ({ documentId }: DocumentViewProps) => {
  const utils = trpc.useUtils();
  const cachedDocuments = utils.documents.getUserDocuments.getData();
  const optimisticDocument = cachedDocuments?.find((doc) => doc.id === documentId);

  const {
    data: document,
    isLoading: documentLoading,
    isFetching: documentFetching,
    error: documentError,
  } = trpc.documents.getDocument.useQuery({ id: documentId });

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

  if (!document && !optimisticDocument && documentLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-2 text-slate-500">加载文档中...</span>
        </div>
      </div>
    );
  }

  if (document) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <DocumentEditor document={document} />
      </div>
    );
  }

  if (optimisticDocument) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="pt-8 space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {optimisticDocument.title || "未命名文档"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            正在加载协同编辑内容...
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-2 text-slate-500">
            {documentFetching ? "同步最新内容..." : "初始化文档内容..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-2 text-slate-500">加载文档中...</span>
      </div>
    </div>
  );
};
