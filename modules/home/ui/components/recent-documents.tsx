"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  MoreHorizontal,
  Calendar
} from "lucide-react";
import type { documents } from "@/db/schema";

type Document = typeof documents.$inferSelect;

interface RecentDocumentsProps {
  documents: Document[];
}

export const RecentDocuments = ({ documents: recentDocuments }: RecentDocumentsProps) => {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

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

  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          最近文档
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-600 dark:text-slate-400"
          onClick={handleViewAllClick}
        >
          查看全部
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentDocuments.map((doc) => (
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
