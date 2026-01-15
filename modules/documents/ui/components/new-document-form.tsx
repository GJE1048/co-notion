"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText } from "lucide-react";

interface NewDocumentFormProps {
  userId: string;
}

export const NewDocumentForm = ({ userId }: NewDocumentFormProps) => {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError("请输入文档标题");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          userId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "创建文档失败");
      }

      const { document } = await response.json();
      router.push(`/documents/${document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建文档时发生错误");
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <FileText className="size-5" />
          文档信息
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              文档标题
            </label>
            <Input
              id="title"
              type="text"
              placeholder="输入文档标题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  创建中...
                </>
              ) : (
                "创建文档"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              取消
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

