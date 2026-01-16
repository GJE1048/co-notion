"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Type, Heading1, Heading2, Heading3, List, Code, Image, FileText } from "lucide-react";
import type { blocks } from "@/db/schema";

type Block = typeof blocks.$inferSelect;

interface BlockEditorProps {
  blocks: Block[];
  onBlockCreate: (block: Omit<Block, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onBlockUpdate: (blockId: string, updates: Partial<Block>) => void;
  onBlockDelete: (blockId: string) => void;
  readOnly?: boolean;
}

interface BlockComponentProps {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

// 单个 Block 组件
const BlockComponent = ({ block, onUpdate, onDelete, readOnly }: BlockComponentProps) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleContentUpdate = useCallback((newContent: any) => {
    onUpdate({
      content: newContent,
      updatedAt: new Date(),
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
            className="min-h-[2rem] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 bg-transparent text-base leading-relaxed"
            placeholder="开始输入内容..."
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

      default:
        return (
          <div className="text-slate-500">
            未知块类型: {block.type}
          </div>
        );
    }
  };

  return (
    <div className="group relative">
      {/* Block 工具栏 */}
      {!readOnly && (
        <div className="absolute -left-10 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="size-6 p-0"
              onClick={() => setIsEditing(!isEditing)}
            >
              +
            </Button>
          </div>
        </div>
      )}

      {/* Block 内容 */}
      <div className="py-1">
        {renderBlockContent()}
      </div>

      {/* Block 操作菜单 */}
      {isEditing && !readOnly && (
        <Card className="absolute left-0 top-full mt-1 p-2 shadow-lg z-10">
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onUpdate({ type: 'heading_1' })}>
              <Heading1 className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onUpdate({ type: 'heading_2' })}>
              <Heading2 className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onUpdate({ type: 'heading_3' })}>
              <Heading3 className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onUpdate({ type: 'paragraph' })}>
              <Type className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onUpdate({ type: 'code' })}>
              <Code className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete()}>
              🗑️
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
  readOnly = false
}: BlockEditorProps) => {
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-2 min-h-[400px]">
      {sortedBlocks.map((block) => (
        <BlockComponent
          key={block.id}
          block={block}
          onUpdate={(updates) => onBlockUpdate(block.id, updates)}
          onDelete={() => onBlockDelete(block.id)}
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
