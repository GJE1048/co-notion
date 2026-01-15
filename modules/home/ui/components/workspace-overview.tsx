"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Users,
  FolderOpen,
  TrendingUp,
  Activity,
  Clock
} from "lucide-react";

// 模拟工作区统计数据
const workspaceStats = {
  totalDocuments: 24,
  totalFolders: 8,
  totalCollaborators: 12,
  activeDocuments: 6,
  storageUsed: 2.4, // GB
  storageLimit: 10, // GB
  recentActivity: 18,
};

const recentActivities = [
  {
    id: "1",
    action: "更新了",
    document: "项目需求文档",
    time: "2 分钟前",
    user: "张三",
  },
  {
    id: "2",
    action: "创建了",
    document: "技术架构设计",
    time: "15 分钟前",
    user: "李四",
  },
  {
    id: "3",
    action: "评论了",
    document: "API设计规范",
    time: "1 小时前",
    user: "王五",
  },
  {
    id: "4",
    action: "分享了",
    document: "会议纪要",
    time: "2 小时前",
    user: "赵六",
  },
];

export const WorkspaceOverview = () => {
  const storagePercentage = (workspaceStats.storageUsed / workspaceStats.storageLimit) * 100;

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
                {workspaceStats.totalDocuments}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">文档总数</div>
            </div>

            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <FolderOpen className="size-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {workspaceStats.totalFolders}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">文件夹数</div>
            </div>

            <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <Users className="size-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {workspaceStats.totalCollaborators}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">协作者</div>
            </div>

            <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <Activity className="size-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {workspaceStats.activeDocuments}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">活跃文档</div>
            </div>
          </div>

          {/* 存储使用情况 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">存储使用</span>
              <span className="text-slate-900 dark:text-slate-100">
                {workspaceStats.storageUsed}GB / {workspaceStats.storageLimit}GB
              </span>
            </div>
            <Progress value={storagePercentage} className="h-2" />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              剩余 {(workspaceStats.storageLimit - workspaceStats.storageUsed).toFixed(1)}GB 空间
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
          <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <TrendingUp size={14} />
            <span>{workspaceStats.recentActivity} 项</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400">
                {activity.user.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  <span className="font-medium">{activity.user}</span>
                  {" "}
                  {activity.action}
                  {" "}
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {activity.document}
                  </span>
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock size={12} />
                  <span>{activity.time}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
