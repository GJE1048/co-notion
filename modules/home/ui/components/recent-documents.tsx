"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  MoreHorizontal,
  Calendar,
  RefreshCw
} from "lucide-react";
import { trpc } from "@/trpc/client";
import type { documents } from "@/db/schema";

type Document = typeof documents.$inferSelect;

interface RecentDocumentsProps {
  documents?: Document[];
}

export const RecentDocuments = ({ documents: initialDocuments }: RecentDocumentsProps) => {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const {
    data: dashboard,
    isLoading,
    error,
    refetch
  } = trpc.home.getDashboardData.useQuery(undefined, {
    enabled: isSignedIn && isLoaded,
  });

  const recentDocuments = dashboard?.recentDocuments || initialDocuments || [];

  const handleDocumentClick = (documentId: string) => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    router.push(`/documents/${documentId}`);
  };

  const handleViewAllClick = () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    router.push("/documents");
  };

  // 当页面可见时自动刷新（用户返回页面时）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSignedIn && isLoaded) {
        refetch();
      }
    };

    // 页面聚焦时也刷新
    const handleFocus = () => {
      if (isSignedIn && isLoaded) {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // 初始加载后也刷新一次，确保数据最新
    if (isSignedIn && isLoaded) {
      refetch();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetch, isSignedIn, isLoaded]);

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          最近文档
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600 dark:text-slate-400"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600 dark:text-slate-400"
            onClick={handleViewAllClick}
          >
            查看全部
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSignedIn ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-4 flex-1">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-56 mb-2" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
            <div className="text-center py-2 text-slate-500 dark:text-slate-400 text-sm">
              当前未登录，无文档
            </div>
          </div>
        ) : isLoading && recentDocuments.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-4 flex-1">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-56 mb-2" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500 dark:text-red-400">
            <p>加载文档失败，请重试</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-2"
            >
              重试
            </Button>
          </div>
        ) : (
          recentDocuments.slice(0, 5).map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
            onClick={() => handleDocumentClick(doc.id)}
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="block">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {doc.title}
                  </h3>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {doc.updatedAt
                      ? new Date(doc.updatedAt).toLocaleString("zh-CN", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "未知"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                文档
              </Badge>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal size={16} />
              </Button>
            </div>
          </div>
          ))
        )}

        {!isLoading && recentDocuments.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>还没有文档，开始创建你的第一个文档吧</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
