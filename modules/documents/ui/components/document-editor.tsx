"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import type { documents } from "@/db/schema";

type Document = typeof documents.$inferSelect;

interface DocumentEditorProps {
  document: Document;
}

export const DocumentEditor = ({ document: initialDocument }: DocumentEditorProps) => {
  const router = useRouter();
  const [title, setTitle] = useState(initialDocument.title);
  const [content, setContent] = useState(initialDocument.content || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 自动保存
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title !== initialDocument.title || content !== initialDocument.content) {
        handleSave(true);
      }
    }, 2000); // 2秒后自动保存

    return () => clearTimeout(timer);
  }, [title, content]);

  const handleSave = async (isAutoSave = false) => {
    if (isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${initialDocument.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "保存文档失败");
      }

      setLastSaved(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存文档时发生错误");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/documents")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          返回文档列表
        </Button>

        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              已保存 {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={() => handleSave(false)}
            disabled={isSaving || isLoading}
            size="sm"
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="size-4" />
                保存
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 文档编辑器 */}
      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* 标题输入 */}
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="文档标题..."
              className="text-3xl font-semibold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
            />

            {/* 内容编辑器 */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="开始输入文档内容..."
              className="w-full min-h-[500px] resize-none border-0 focus:outline-none focus:ring-0 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-base leading-relaxed"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

