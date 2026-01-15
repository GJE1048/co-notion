"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  FolderOpen,
  Activity
} from "lucide-react";

interface WorkspaceOverviewProps {
  userId?: string | null;
}

interface WorkspaceStats {
  totalDocuments: number;
  totalFolders: number;
  activeDocuments: number;
  storageUsed: number;
  storageLimit: number;
}

export const WorkspaceOverview = ({ userId }: WorkspaceOverviewProps) => {
  const [stats, setStats] = useState<WorkspaceStats>({
    totalDocuments: 0,
    totalFolders: 0,
    activeDocuments: 0,
    storageUsed: 0,
    storageLimit: 10,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await fetch("/api/documents");
        if (response.ok) {
          const data = await response.json();
          const documents = data.documents || [];

          // 计算存储使用（简单估算：每个文档平均50KB）
          const estimatedSize = documents.length * 50 / 1024 / 1024; // MB转GB

          setStats({
            totalDocuments: documents.length,
            totalFolders: 0, // 暂时没有文件夹功能
            activeDocuments: documents.filter((doc: { updatedAt: Date | null }) => {
              const updatedAt = doc.updatedAt ? new Date(doc.updatedAt) : null;
              if (!updatedAt) return false;
              const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
              return daysSinceUpdate < 7; // 7天内更新过的算活跃
            }).length,
            storageUsed: estimatedSize,
            storageLimit: 10,
          });
        }
      } catch (error) {
        console.error("获取统计数据失败:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  const storagePercentage = stats.storageLimit > 0
    ? (stats.storageUsed / stats.storageLimit) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* 工作区统计 */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            工作区概览
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <FileText className="size-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {isLoading ? "..." : stats.totalDocuments}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">文档总数</div>
            </div>

            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <FolderOpen className="size-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {isLoading ? "..." : stats.totalFolders}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">文件夹数</div>
            </div>

            <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <Activity className="size-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {isLoading ? "..." : stats.activeDocuments}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">活跃文档</div>
            </div>
          </div>

          {/* 存储使用情况 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">存储使用</span>
              <span className="text-slate-900 dark:text-slate-100">
                {isLoading ? "..." : `${stats.storageUsed.toFixed(2)}GB`} / {stats.storageLimit}GB
              </span>
            </div>
            <Progress value={storagePercentage} className="h-2" />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              剩余 {isLoading ? "..." : (stats.storageLimit - stats.storageUsed).toFixed(2)}GB 空间
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 最近活动 */}
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
