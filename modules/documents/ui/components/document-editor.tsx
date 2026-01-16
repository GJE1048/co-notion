"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, ArrowLeft, Plus, Heading1, List, Code } from "lucide-react";
import { trpc } from "@/trpc/client";
import { BlockEditor } from "./block-editor";
import type { documents, blocks } from "@/db/schema";

type Document = typeof documents.$inferSelect;
type Block = typeof blocks.$inferSelect;

interface DocumentEditorProps {
  document: Document;
}

export const DocumentEditor = ({ document: initialDocument }: DocumentEditorProps) => {
  const router = useRouter();
  const [title, setTitle] = useState(initialDocument.title);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 使用 tRPC 获取文档 blocks（开发模式下使用绕过认证的查询）
  const {
    data: blocksData,
    isLoading: blocksLoading,
    error: blocksError
  } = trpc.devGetDocumentBlocks.useQuery({
    documentId: initialDocument.id
  });

  // Block 操作 mutations
  const createBlockMutation = trpc.documents.createBlock.useMutation();
  const updateBlockMutation = trpc.blocks.updateBlock.useMutation();
  const deleteBlockMutation = trpc.blocks.deleteBlock.useMutation();
  const updateDocumentMutation = trpc.documents.updateDocument.useMutation();

  const blocks = blocksData?.blocks || [];
  const isLoading = blocksLoading;

  // 使用 tRPC 的查询重获取功能
  const utils = trpc.useUtils();

  // 处理加载错误
  useEffect(() => {
    if (blocksError) {
      setError('加载文档内容失败');
      console.error('Failed to load blocks:', blocksError);
    }
  }, [blocksError]);

  const handleSave = useCallback(async () => {
    try {
      setError(null);

      // 保存文档标题
      await updateDocumentMutation.mutateAsync({
        id: initialDocument.id,
        data: {
          title: title.trim(),
        },
      });

      // TODO: 保存 blocks（后续通过操作日志实现）
      // 这里暂时只保存标题，blocks的保存会在操作日志系统中实现

      setLastSaved(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存文档时发生错误");
    }
  }, [updateDocumentMutation, initialDocument.id, title]);

  const isSaving = updateDocumentMutation.isPending;

  // Block 操作处理函数
  const handleBlockCreate = useCallback(async (blockData: Omit<Block, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createBlockMutation.mutateAsync(blockData);
      // 重新获取 blocks 数据
      await utils.documents.getDocumentBlocks.invalidate();
    } catch (err) {
      console.error('Failed to create block:', err);
      setError('创建 Block 失败');
    }
  }, [createBlockMutation, utils]);

  const handleBlockUpdate = useCallback(async (blockId: string, updates: Partial<Block>) => {
    try {
      await updateBlockMutation.mutateAsync({
        id: blockId,
        data: updates,
      });
      // 重新获取 blocks 数据
      await utils.documents.getDocumentBlocks.invalidate();
    } catch (err) {
      console.error('Failed to update block:', err);
      setError('更新 Block 失败');
    }
  }, [updateBlockMutation, utils]);

  const handleBlockDelete = useCallback(async (blockId: string) => {
    try {
      await deleteBlockMutation.mutateAsync({
        id: blockId,
      });
      // 重新获取 blocks 数据
      await utils.documents.getDocumentBlocks.invalidate();
    } catch (err) {
      console.error('Failed to delete block:', err);
      setError('删除 Block 失败');
    }
  }, [deleteBlockMutation, utils]);

  // 自动保存（简化版，后续会用操作日志替换）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title !== initialDocument.title) {
        handleSave();
      }
    }, 2000); // 2秒后自动保存

    return () => clearTimeout(timer);
  }, [title, handleSave, initialDocument.title]);

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

            {/* Block 编辑器 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-500">加载文档内容...</span>
              </div>
            ) : (
              <BlockEditor
                blocks={blocks}
                onBlockCreate={handleBlockCreate}
                onBlockUpdate={handleBlockUpdate}
                onBlockDelete={handleBlockDelete}
                readOnly={false}
              />
            )}

            {/* 添加新 Block 按钮 */}
            {!isLoading && (
              <div className="space-y-2">
                <div className="text-xs text-slate-500">添加内容块</div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBlockCreate({
                      documentId: initialDocument.id,
                      parentId: null,
                      type: 'paragraph',
                      content: { text: { content: '' } },
                      properties: {},
                      position: blocks.length,
                      version: 1,
                      createdBy: '', // 这个字段会在服务器端设置
                    })}
                  >
                    <Plus className="size-4 mr-1" />
                    段落
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBlockCreate({
                      documentId: initialDocument.id,
                      parentId: null,
                      type: 'heading_1',
                      content: { text: { content: '' } },
                      properties: {},
                      position: blocks.length,
                      version: 1,
                      createdBy: '',
                    })}
                  >
                    <Heading1 className="size-4 mr-1" />
                    标题
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBlockCreate({
                      documentId: initialDocument.id,
                      parentId: null,
                      type: 'list',
                      content: { list: { items: [''] } },
                      properties: {},
                      position: blocks.length,
                      version: 1,
                      createdBy: '',
                    })}
                  >
                    <List className="size-4 mr-1" />
                    列表
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBlockCreate({
                      documentId: initialDocument.id,
                      parentId: null,
                      type: 'code',
                      content: { code: { content: '', language: 'javascript' } },
                      properties: {},
                      position: blocks.length,
                      version: 1,
                      createdBy: '',
                    })}
                  >
                    <Code className="size-4 mr-1" />
                    代码
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

