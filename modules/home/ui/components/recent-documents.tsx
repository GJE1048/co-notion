"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  Users,
  MoreHorizontal,
  Eye,
  Calendar
} from "lucide-react";
import Link from "next/link";

// 模拟最近文档数据
const recentDocuments = [
  {
    id: "1",
    title: "项目需求文档",
    type: "需求文档",
    lastModified: "2024-01-15 14:30",
    collaborators: 3,
    isPublic: false,
    status: "draft",
  },
  {
    id: "2",
    title: "技术架构设计",
    type: "技术文档",
    lastModified: "2024-01-15 10:15",
    collaborators: 5,
    isPublic: true,
    status: "published",
  },
  {
    id: "3",
    title: "会议纪要 - Q1规划",
    type: "会议记录",
    lastModified: "2024-01-14 16:45",
    collaborators: 2,
    isPublic: false,
    status: "published",
  },
  {
    id: "4",
    title: "API设计规范",
    type: "技术文档",
    lastModified: "2024-01-14 09:20",
    collaborators: 4,
    isPublic: true,
    status: "published",
  },
];

export const RecentDocuments = () => {
  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          最近文档
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
          查看全部
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentDocuments.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/documents/${doc.id}`} className="block">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {doc.title}
                  </h3>
                </Link>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {doc.lastModified}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {doc.collaborators} 人
                  </span>
                  {doc.isPublic && (
                    <span className="flex items-center gap-1">
                      <Eye size={14} />
                      公开
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={doc.status === "published" ? "default" : "secondary"}
                className="text-xs"
              >
                {doc.status === "published" ? "已发布" : "草稿"}
              </Badge>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal size={16} />
              </Button>
            </div>
          </div>
        ))}

        {recentDocuments.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>还没有文档，开始创建你的第一个文档吧</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
