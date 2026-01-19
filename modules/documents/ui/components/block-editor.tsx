"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Type, Heading1, Heading2, Heading3, List, Code, Image, FileText, Quote, CheckSquare, Minus, Plus, Loader2, Upload } from "lucide-react";
import type { blocks } from "@/db/schema";
import { trpc } from "@/trpc/client";

type Block = typeof blocks.$inferSelect;

type RemoteCursor = {
  blockId: string;
  username: string;
  color: string;
   anchor?: number;
   head?: number;
};

interface BlockEditorProps {
  blocks: Block[];
  onBlockCreate: (block: Omit<Block, "id" | "createdAt" | "updatedAt">) => void;
  onBlockUpdate: (blockId: string, updates: Partial<Block>) => void;
  onBlockDelete: (blockId: string) => void;
  onBlockCreateAfter?: (
    afterBlockId: string,
    block: Omit<Block, "id" | "createdAt" | "updatedAt">
  ) => void;
  onBlockFocus?: (blockId: string) => void;
  remoteCursors?: RemoteCursor[];
  onSelectionChange?: (blockId: string, anchor: number, head: number) => void;
  readOnly?: boolean;
}

interface BlockComponentProps {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
  onDelete: () => void;
  onCreateAfter?: (type: string) => void;
  onFocus?: () => void;
  remoteCursors?: RemoteCursor[];
  readOnly?: boolean;
  onSelectionChange?: (anchor: number, head: number) => void;
}

// 单个 Block 组件
const BlockComponent = ({
  block,
  onUpdate,
  onDelete,
  onCreateAfter,
  onFocus,
  remoteCursors,
  readOnly,
  onSelectionChange,
}: BlockComponentProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUploadUrlMutation = trpc.storage.getUploadUrl.useMutation();

  const handleImageUpload = async (file: File) => {
    try {
      setIsUploading(true);
      
      // 1. 获取预签名 URL
      const { uploadUrl, fileUrl } = await getUploadUrlMutation.mutateAsync({
        filename: file.name,
        contentType: file.type,
      });

      // 2. 上传文件到 S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      // 3. 更新 Block 内容
      handleContentUpdate({
        image: {
          url: fileUrl,
          caption: file.name,
        }
      });
    } catch (error) {
      console.error("Image upload failed:", error);
      alert("图片上传失败，请重试");
    } finally {
      setIsUploading(false);
      // 清空 input 防止重复选择同一文件不触发 onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSelectionChange = useCallback(
    (target: HTMLTextAreaElement | HTMLInputElement) => {
      if (!onSelectionChange) {
        return;
      }
      const anchor = target.selectionStart ?? 0;
      const head = target.selectionEnd ?? anchor;
      onSelectionChange(anchor, head);
    },
    [onSelectionChange]
  );

  // 监听创建新块的全局事件
  useEffect(() => {
    const handleCreateBlockAfter = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.blockId === block.id && onCreateAfter) {
        onCreateAfter(customEvent.detail.type);
      }
    };

    window.addEventListener('createBlockAfter', handleCreateBlockAfter);
    return () => {
      window.removeEventListener('createBlockAfter', handleCreateBlockAfter);
    };
  }, [block.id, onCreateAfter]);

  const handleContentUpdate = useCallback((newContent: Record<string, unknown>) => {
    // 立即更新，不等待防抖
    onUpdate({
      content: newContent,
    });
  }, [onUpdate]);

  const renderBlockContent = () => {
    switch (block.type) {
      case 'heading_1':
        return (
          <Input
            value={(block.content as { text?: { content?: string } })?.text?.content || ''}
            onChange={(e) => handleContentUpdate({
              text: { content: e.target.value }
            })}
            onSelect={(e) => handleSelectionChange(e.currentTarget)}
            onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
            className="text-3xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
            placeholder="一级标题"
            readOnly={readOnly}
          />
        );

      case 'heading_2':
        return (
          <Input
            value={(block.content as { text?: { content?: string } })?.text?.content || ''}
            onChange={(e) => handleContentUpdate({
              text: { content: e.target.value }
            })}
            onSelect={(e) => handleSelectionChange(e.currentTarget)}
            onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
            className="text-2xl font-semibold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
            placeholder="二级标题"
            readOnly={readOnly}
          />
        );

      case 'heading_3':
        return (
          <Input
            value={(block.content as { text?: { content?: string } })?.text?.content || ''}
            onChange={(e) => handleContentUpdate({
              text: { content: e.target.value }
            })}
            onSelect={(e) => handleSelectionChange(e.currentTarget)}
            onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
            className="text-xl font-medium border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
            placeholder="三级标题"
            readOnly={readOnly}
          />
        );

      case 'paragraph':
        return (
            <Textarea
              value={(block.content as { text?: { content?: string } })?.text?.content || ''}
              onChange={(e) => handleContentUpdate({
                text: { content: e.target.value }
              })}
              onKeyDown={(e) => {
              // 在段落末尾按 Enter 时创建新段落
              if (e.key === 'Enter' && !e.shiftKey && !readOnly) {
                const content = (block.content as { text?: { content?: string } })?.text?.content || '';
                const cursorPosition = e.currentTarget.selectionStart;
                const isAtEnd = cursorPosition === content.length;
                
                if (isAtEnd && typeof content === 'string' && content.trim() !== '') {
                  e.preventDefault();
                  // 触发创建新段落的回调（通过父组件处理）
                  const event = new CustomEvent('createBlockAfter', {
                    detail: { blockId: block.id, type: 'paragraph' }
                  });
                  window.dispatchEvent(event);
                }
              }
            }}
            onSelect={(e) => handleSelectionChange(e.currentTarget)}
            onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
            className="min-h-[2rem] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent text-base leading-relaxed"
            placeholder="开始输入内容... (按 Enter 创建新段落)"
            readOnly={readOnly}
          />
        );

      case 'code':
        return (
          <div className="relative">
            <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto">
              <code className="text-sm">
                <Textarea
                  value={(block.content as { code?: { content?: string; language?: string } })?.code?.content || ''}
                  onChange={(e) => handleContentUpdate({
                    code: { content: e.target.value, language: (block.content as { code?: { language?: string } })?.code?.language || 'javascript' }
                  })}
                  onSelect={(e) => handleSelectionChange(e.currentTarget)}
                  onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
                  className="min-h-[4rem] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent font-mono text-sm"
                  placeholder="输入代码..."
                  readOnly={readOnly}
                />
              </code>
            </pre>
          </div>
        );

      case 'quote':
        return (
          <div className="border-l-4 border-slate-300 pl-4 italic">
            <Textarea
              value={(block.content as { text?: { content?: string } })?.text?.content || ''}
              onChange={(e) => handleContentUpdate({
                text: { content: e.target.value }
              })}
              onSelect={(e) => handleSelectionChange(e.currentTarget)}
              onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
              className="min-h-[2rem] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent italic"
              placeholder="输入引用内容..."
              readOnly={readOnly}
            />
          </div>
        );

      case 'list':
        return (
          <div className="space-y-1">
            {(block.content as { list?: { items?: string[] } })?.list?.items?.map((item: string, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                <Input
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(((block.content as { list?: { items?: string[] } })?.list?.items) || [])];
                    newItems[index] = e.target.value;
                    handleContentUpdate({
                      list: { items: newItems }
                    });
                  }}
                  onSelect={(e) => handleSelectionChange(e.currentTarget)}
                  onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent"
                  placeholder="列表项..."
                  readOnly={readOnly}
                />
              </div>
            )) || (
              <div className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                <Input
                  onChange={(e) => handleContentUpdate({
                    list: { items: [e.target.value] }
                  })}
                  onSelect={(e) => handleSelectionChange(e.currentTarget)}
                  onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent"
                  placeholder="列表项..."
                  readOnly={readOnly}
                />
              </div>
            )}
          </div>
        );

      case 'todo':
        return (
          <div className="space-y-1">
            {(block.content as { todo?: { items?: { text?: string; checked?: boolean }[] } })?.todo?.items?.map((item: { text?: string; checked?: boolean }, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={item.checked || false}
                  onChange={(e) => {
                    const newItems = [...(((block.content as { todo?: { items?: { text?: string; checked?: boolean }[] } })?.todo?.items) || [])];
                    newItems[index] = { ...newItems[index], checked: e.target.checked };
                    handleContentUpdate({
                      todo: { items: newItems }
                    });
                  }}
                  className="mt-1"
                  disabled={readOnly}
                />
                <Input
                  value={item.text || ''}
                  onChange={(e) => {
                    const newItems = [...(((block.content as { todo?: { items?: { text?: string; checked?: boolean }[] } })?.todo?.items) || [])];
                    newItems[index] = { ...newItems[index], text: e.target.value };
                    handleContentUpdate({
                      todo: { items: newItems }
                    });
                  }}
                  onSelect={(e) => handleSelectionChange(e.currentTarget)}
                  onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
                  className={`border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent ${
                    item.checked ? 'line-through text-slate-500' : ''
                  }`}
                  placeholder="待办事项..."
                  readOnly={readOnly}
                />
              </div>
            )) || (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={readOnly}
                />
                <Input
                  onChange={(e) => handleContentUpdate({
                    todo: { items: [{ text: e.target.value, checked: false }] }
                  })}
                  onSelect={(e) => handleSelectionChange(e.currentTarget)}
                  onKeyUp={(e) => handleSelectionChange(e.currentTarget)}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent"
                  placeholder="待办事项..."
                  readOnly={readOnly}
                />
              </div>
            )}
          </div>
        );

      case 'divider':
        return (
          <hr className="border-slate-300 dark:border-slate-600 my-4" />
        );

      case 'image':
        return (
          <div className="space-y-2">
            {(block.content as { image?: { url?: string; caption?: string } })?.image?.url ? (
              <img
                src={(block.content as { image?: { url?: string } })?.image?.url}
                alt={(block.content as { image?: { caption?: string } })?.image?.caption || ''}
                className="max-w-full h-auto rounded-lg"
              />
            ) : (
              <div 
                className={`border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center transition-colors ${
                  isUploading ? "bg-slate-50 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                }`}
                onClick={() => !isUploading && !readOnly && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file);
                    }
                  }}
                  disabled={readOnly || isUploading}
                />
                
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-8 animate-spin text-blue-500" />
                    <p className="text-slate-500">正在上传图片...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="size-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-slate-500 font-medium">点击上传图片</p>
                    <p className="text-xs text-slate-400 mt-1">支持 JPG, PNG, GIF, WebP</p>
                    <div className="relative mt-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white dark:bg-slate-950 px-2 text-slate-500">或者输入 URL</span>
                      </div>
                    </div>
                    <Input
                      type="url"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleContentUpdate({
                        image: { url: e.target.value, caption: '' }
                      })}
                      placeholder="https://example.com/image.png"
                      className="mt-4"
                      readOnly={readOnly}
                    />
                  </>
                )}
              </div>
            )}
            {(block.content as { image?: { caption?: string } })?.image?.caption && (
              <Input
                value={(block.content as { image?: { caption?: string } })?.image?.caption || ''}
                onChange={(e) => handleContentUpdate({
                  image: {
                    url: (block.content as { image?: { url?: string } })?.image?.url,
                    caption: e.target.value
                  }
                })}
                placeholder="图片说明..."
                className="text-sm text-slate-600"
                readOnly={readOnly}
              />
            )}
          </div>
        );

      default:
        return (
          <div className="text-slate-500">
            未知块类型: {block.type}
          </div>
        );
    }
  };

  const hasRemoteCursors = !!remoteCursors && remoteCursors.length > 0;
  const mainCursor = hasRemoteCursors ? remoteCursors[0] : undefined;
  const hasRemoteSelection =
    !!remoteCursors?.some(
      (cursor) =>
        typeof cursor.anchor === "number" &&
        typeof cursor.head === "number" &&
        cursor.anchor !== cursor.head
    );

  return (
    <div className="group relative py-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-lg transition-colors">
      {/* Block 工具栏 */}
      {!readOnly && (
        <div className="absolute -left-12 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="size-8 p-0 hover:bg-slate-200 dark:hover:bg-slate-700"
              onClick={() => setIsEditing(!isEditing)}
              title="转换块类型"
            >
              <Type className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="size-8 p-0 hover:bg-slate-200 dark:hover:bg-slate-700 text-red-500"
              onClick={onDelete}
              title="删除块"
            >
              🗑️
            </Button>
          </div>
        </div>
      )}

      {/* Block 内容 */}
      <div
        className={`px-2 relative ${
          hasRemoteSelection ? "bg-slate-100/60 dark:bg-slate-800/40" : ""
        }`}
        onFocus={() => {
          setIsEditing(false);
          onFocus?.();
        }}
      >
        {mainCursor && (
          <div
            className="absolute -left-1 top-0 bottom-0 w-0.5 rounded-full"
            style={{ backgroundColor: mainCursor.color }}
          />
        )}
        {hasRemoteCursors && mainCursor && (
          <div className="absolute -left-1 -top-4 flex items-center gap-1">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
              style={{ backgroundColor: mainCursor.color }}
            >
              {remoteCursors.length === 1
                ? mainCursor.username
                : `${mainCursor.username} 等 ${remoteCursors.length} 人`}
            </span>
          </div>
        )}
        {renderBlockContent()}
      </div>

      {/* 在块下方显示添加按钮 */}
      {!readOnly && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 mb-1 px-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 h-6"
            onClick={() => onCreateAfter?.('paragraph')}
          >
            <Plus className="size-3 mr-1" />
            添加段落
          </Button>
        </div>
      )}

      {/* Block 操作菜单 */}
      {isEditing && !readOnly && (
        <Card className="absolute left-0 top-full mt-2 p-3 shadow-xl border border-slate-200 dark:border-slate-700 z-20 bg-white dark:bg-slate-800">
          <div className="grid grid-cols-4 gap-2 min-w-[240px]">
            <div className="col-span-4 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              转换为：
            </div>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'heading_1' }); setIsEditing(false); }} title="一级标题" className="flex flex-col items-center gap-1 h-auto py-2">
              <Heading1 className="size-4" />
              <span className="text-xs">标题1</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'heading_2' }); setIsEditing(false); }} title="二级标题" className="flex flex-col items-center gap-1 h-auto py-2">
              <Heading2 className="size-4" />
              <span className="text-xs">标题2</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'heading_3' }); setIsEditing(false); }} title="三级标题" className="flex flex-col items-center gap-1 h-auto py-2">
              <Heading3 className="size-4" />
              <span className="text-xs">标题3</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'paragraph' }); setIsEditing(false); }} title="段落" className="flex flex-col items-center gap-1 h-auto py-2">
              <Type className="size-4" />
              <span className="text-xs">段落</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'list' }); setIsEditing(false); }} title="列表" className="flex flex-col items-center gap-1 h-auto py-2">
              <List className="size-4" />
              <span className="text-xs">列表</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'todo' }); setIsEditing(false); }} title="待办事项" className="flex flex-col items-center gap-1 h-auto py-2">
              <CheckSquare className="size-4" />
              <span className="text-xs">待办</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'code' }); setIsEditing(false); }} title="代码块" className="flex flex-col items-center gap-1 h-auto py-2">
              <Code className="size-4" />
              <span className="text-xs">代码</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'quote' }); setIsEditing(false); }} title="引用" className="flex flex-col items-center gap-1 h-auto py-2">
              <Quote className="size-4" />
              <span className="text-xs">引用</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'divider' }); setIsEditing(false); }} title="分割线" className="flex flex-col items-center gap-1 h-auto py-2">
              <Minus className="size-4" />
              <span className="text-xs">分割</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { onUpdate({ type: 'image' }); setIsEditing(false); }} title="图片" className="flex flex-col items-center gap-1 h-auto py-2">
              <Image className="size-4" />
              <span className="text-xs">图片</span>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

// 主 Block 编辑器组件
export const BlockEditor = ({
  blocks,
  onBlockCreate,
  onBlockUpdate,
  onBlockDelete,
  onBlockCreateAfter,
  onBlockFocus,
  remoteCursors = [],
  onSelectionChange,
  readOnly = false
}: BlockEditorProps) => {
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);

  const handleCreateAfter = useCallback((afterBlockId: string, type: Block["type"]) => {
    if (!onBlockCreateAfter) return;
    
    const afterBlock = sortedBlocks.find(b => b.id === afterBlockId);
    if (!afterBlock) return;

    const newPosition = afterBlock.position + 1;
    // 更新后续块的位置
    const blocksToUpdate = sortedBlocks.filter(b => b.position >= newPosition);
    
    onBlockCreateAfter(afterBlockId, {
      documentId: afterBlock.documentId,
      parentId: afterBlock.parentId,
      type: type,
      content: type === 'paragraph' 
        ? { text: { content: '' } }
        : type === 'heading_1'
        ? { text: { content: '' } }
        : type === 'list'
        ? { list: { items: [''] } }
        : type === 'code'
        ? { code: { content: '', language: 'javascript' } }
        : { text: { content: '' } },
      properties: {},
      position: newPosition,
      version: 1,
      createdBy: '', // 服务器端设置
    });
  }, [onBlockCreateAfter, sortedBlocks]);

  return (
    <div className="space-y-2 min-h-[400px]">
      {sortedBlocks.map((block) => (
        <BlockComponent
          key={block.id}
          block={block}
          onUpdate={(updates) => onBlockUpdate(block.id, updates)}
          onDelete={() => onBlockDelete(block.id)}
          onCreateAfter={(type) => handleCreateAfter(block.id, type as Block["type"])}
          remoteCursors={remoteCursors.filter((cursor) => cursor.blockId === block.id)}
          onFocus={() => onBlockFocus?.(block.id)}
          onSelectionChange={
            onSelectionChange
              ? (anchor, head) => onSelectionChange(block.id, anchor, head)
              : undefined
          }
          readOnly={readOnly}
        />
      ))}

      {sortedBlocks.length === 0 && !readOnly && (
        <div className="text-center py-12 text-slate-500">
          <FileText className="size-12 mx-auto mb-4 opacity-50" />
          <p>开始创建你的第一个内容块</p>
        </div>
      )}
    </div>
  );
};
