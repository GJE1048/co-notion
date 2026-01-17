"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@clerk/nextjs";
import { FileText, FolderOpen, Activity } from "lucide-react";
import { trpc } from "@/trpc/client";

interface WorkspaceStats {
  totalDocuments: number;
  totalFolders: number;
  activeDocuments: number;
  storageUsed: number;
  storageLimit: number;
}

export const WorkspaceOverview = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: dashboard, isLoading } = trpc.home.getDashboardData.useQuery(
    undefined,
    {
      enabled: isSignedIn && isLoaded,
    }
  );

  const stats: WorkspaceStats = {
    totalDocuments: dashboard?.stats.totalDocuments || 0,
    totalFolders: 0,
    activeDocuments: dashboard?.stats.activeDocuments || 0,
    storageUsed: ((dashboard?.stats.totalDocuments || 0) * 50) / 1024 / 1024,
    storageLimit: 10,
  };

  const storagePercentage =
    stats.storageLimit > 0 ? (stats.storageUsed / stats.storageLimit) * 100 : 0;

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              工作区概览
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              最近活动
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
              加载中...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            工作区概览
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSignedIn ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="text-center text-slate-500 dark:text-slate-400 text-sm">
                当前未登录，无文档统计数据
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <FileText className="size-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {isLoading ? "..." : stats.totalDocuments}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    文档总数
                  </div>
                </div>

                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <FolderOpen className="size-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {isLoading ? "..." : stats.totalFolders}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    文件夹数
                  </div>
                </div>

                <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <Activity className="size-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {isLoading ? "..." : stats.activeDocuments}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    活跃文档
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    存储使用
                  </span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {isLoading ? "..." : `${stats.storageUsed.toFixed(2)}GB`} /{" "}
                    {stats.storageLimit}GB
                  </span>
                </div>
                <Progress value={storagePercentage} className="h-2" />
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  剩余{" "}
                  {isLoading
                    ? "..."
                    : (stats.storageLimit - stats.storageUsed).toFixed(2)}
                  GB 空间
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            最近活动
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
            暂无最近活动
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
