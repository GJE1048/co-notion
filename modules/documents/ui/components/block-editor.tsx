"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Type, Heading1, Heading2, Heading3, List, Code, Image, FileText, Quote, CheckSquare, Minus, Plus } from "lucide-react";
import type { blocks } from "@/db/schema";

type Block = typeof blocks.$inferSelect;

type RemoteCursor = {
  blockId: string;
  username: string;
  color: string;
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
}: BlockComponentProps) => {
  const [isEditing, setIsEditing] = useState(false);

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

  const handleContentUpdate = useCallback((newContent: Record<string, any>) => {
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
            value={(block.content as any)?.text?.content || ''}
            onChange={(e) => handleContentUpdate({
              text: { content: e.target.value }
            })}
            className="text-3xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
            placeholder="一级标题"
            readOnly={readOnly}
          />
        );

      case 'heading_2':
        return (
          <Input
            value={(block.content as any)?.text?.content || ''}
            onChange={(e) => handleContentUpdate({
              text: { content: e.target.value }
            })}
            className="text-2xl font-semibold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
            placeholder="二级标题"
            readOnly={readOnly}
          />
        );

      case 'heading_3':
        return (
          <Input
            value={(block.content as any)?.text?.content || ''}
            onChange={(e) => handleContentUpdate({
              text: { content: e.target.value }
            })}
            className="text-xl font-medium border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto bg-transparent"
            placeholder="三级标题"
            readOnly={readOnly}
          />
        );

      case 'paragraph':
        return (
          <Textarea
            value={(block.content as any)?.text?.content || ''}
            onChange={(e) => handleContentUpdate({
              text: { content: e.target.value }
            })}
            onKeyDown={(e) => {
              // 在段落末尾按 Enter 时创建新段落
              if (e.key === 'Enter' && !e.shiftKey && !readOnly) {
                const content = (block.content as any)?.text?.content || '';
                const cursorPosition = e.currentTarget.selectionStart;
                const isAtEnd = cursorPosition === content.length;
                
                if (isAtEnd && content.trim() !== '') {
                  e.preventDefault();
                  // 触发创建新段落的回调（通过父组件处理）
                  const event = new CustomEvent('createBlockAfter', {
                    detail: { blockId: block.id, type: 'paragraph' }
                  });
                  window.dispatchEvent(event);
                }
              }
            }}
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
                  value={(block.content as any)?.code?.content || ''}
                  onChange={(e) => handleContentUpdate({
                    code: { content: e.target.value, language: (block.content as any)?.code?.language || 'javascript' }
                  })}
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
              value={(block.content as any)?.text?.content || ''}
              onChange={(e) => handleContentUpdate({
                text: { content: e.target.value }
              })}
              className="min-h-[2rem] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent italic"
              placeholder="输入引用内容..."
              readOnly={readOnly}
            />
          </div>
        );

      case 'list':
        return (
          <div className="space-y-1">
            {(block.content as any)?.list?.items?.map((item: string, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                <Input
                  value={item}
                  onChange={(e) => {
                    const newItems = [...((block.content as any)?.list?.items || [])];
                    newItems[index] = e.target.value;
                    handleContentUpdate({
                      list: { items: newItems }
                    });
                  }}
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
            {(block.content as any)?.todo?.items?.map((item: any, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={item.checked || false}
                  onChange={(e) => {
                    const newItems = [...((block.content as any)?.todo?.items || [])];
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
                    const newItems = [...((block.content as any)?.todo?.items || [])];
                    newItems[index] = { ...newItems[index], text: e.target.value };
                    handleContentUpdate({
                      todo: { items: newItems }
                    });
                  }}
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
            {(block.content as any)?.image?.url ? (
              <img
                src={(block.content as any)?.image?.url}
                alt={(block.content as any)?.image?.caption || ''}
                className="max-w-full h-auto rounded-lg"
              />
            ) : (
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
                <p className="text-slate-500">点击上传图片</p>
                <Input
                  type="url"
                  onChange={(e) => handleContentUpdate({
                    image: { url: e.target.value, caption: '' }
                  })}
                  placeholder="输入图片 URL..."
                  className="mt-2"
                  readOnly={readOnly}
                />
              </div>
            )}
            {(block.content as any)?.image?.caption && (
              <Input
                value={(block.content as any)?.image?.caption || ''}
                onChange={(e) => handleContentUpdate({
                  image: {
                    url: (block.content as any)?.image?.url,
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

  return (
    <div className="group relative py-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-lg transition-colors">
      {remoteCursors && remoteCursors.length > 0 && (
        <div className="absolute -left-2 top-2 flex -space-x-1">
          {remoteCursors.slice(0, 3).map((cursor) => (
            <div
              key={`${block.id}-${cursor.username}`}
              className="size-3 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: cursor.color }}
            />
          ))}
        </div>
      )}
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
        className="px-2"
        onFocus={() => {
          setIsEditing(false);
          onFocus?.();
        }}
      >
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
  readOnly = false
}: BlockEditorProps) => {
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);

  const handleCreateAfter = useCallback((afterBlockId: string, type: string) => {
    if (!onBlockCreateAfter) return;
    
    const afterBlock = sortedBlocks.find(b => b.id === afterBlockId);
    if (!afterBlock) return;

    const newPosition = afterBlock.position + 1;
    // 更新后续块的位置
    const blocksToUpdate = sortedBlocks.filter(b => b.position >= newPosition);
    
    onBlockCreateAfter(afterBlockId, {
      documentId: afterBlock.documentId,
      parentId: afterBlock.parentId,
      type: type as any,
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
          onCreateAfter={(type) => handleCreateAfter(block.id, type)}
          remoteCursors={remoteCursors.filter((cursor) => cursor.blockId === block.id)}
          onFocus={() => onBlockFocus?.(block.id)}
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
