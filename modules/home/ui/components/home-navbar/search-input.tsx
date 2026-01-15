"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileText,
  FolderOpen,
  Users,
  X,
  Command
} from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  type: "document" | "folder" | "user";
  description?: string;
  lastModified?: string;
}

// 模拟搜索结果数据
const mockSearchResults: SearchResult[] = [
  {
    id: "1",
    title: "项目需求文档",
    type: "document",
    description: "包含项目功能需求和技术规格",
    lastModified: "2024-01-15"
  },
  {
    id: "2",
    title: "技术文档",
    type: "folder",
    description: "存放所有技术相关文档",
    lastModified: "2024-01-14"
  },
  {
    id: "3",
    title: "张三",
    type: "user",
    description: "产品经理，负责需求分析",
  },
  {
    id: "4",
    title: "API设计规范",
    type: "document",
    description: "后端API接口设计标准",
    lastModified: "2024-01-13"
  }
];

export const SearchInput = () => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 处理搜索
  useEffect(() => {
    if (query.trim()) {
      // 模拟搜索API调用
      const filteredResults = mockSearchResults.filter(result =>
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        (result.description && result.description.toLowerCase().includes(query.toLowerCase()))
      );
      setResults(filteredResults);
      setIsOpen(true);
      setSelectedIndex(-1);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => prev < results.length - 1 ? prev + 1 : prev);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleResultClick(results[selectedIndex]);
        } else {
          // 搜索整个工作区
          router.push(`/search?q=${encodeURIComponent(query)}`);
          setIsOpen(false);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // 根据类型跳转到不同页面
    switch (result.type) {
      case "document":
        router.push(`/documents/${result.id}`);
        break;
      case "folder":
        router.push(`/folders/${result.id}`);
        break;
      case "user":
        router.push(`/users/${result.id}`);
        break;
    }
    setIsOpen(false);
    setQuery("");
  };

  const getTypeIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "document":
        return <FileText className="size-4 text-blue-500" />;
      case "folder":
        return <FolderOpen className="size-4 text-yellow-500" />;
      case "user":
        return <Users className="size-4 text-green-500" />;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "document":
        return "文档";
      case "folder":
        return "文件夹";
      case "user":
        return "用户";
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="搜索文档、文件夹或用户..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setIsOpen(true)}
          className="pl-10 pr-10 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-colors"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 size-8 hover:bg-slate-200 dark:hover:bg-slate-700"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
          >
            <X className="size-4" />
          </Button>
        )}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs opacity-50">
          <Command className="size-3" />
        </div>
      </div>

      {/* 搜索结果下拉框 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* 搜索结果 */}
          <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            {results.length > 0 ? (
              <div className="py-2">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 ${
                      index === selectedIndex ? "bg-slate-100 dark:bg-slate-800" : ""
                    }`}
                    onClick={() => handleResultClick(result)}
                  >
                    {getTypeIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {result.title}
                      </div>
                      {result.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {result.description}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                        {getTypeLabel(result.type)}
                      </span>
                      {result.lastModified && (
                        <span>{result.lastModified}</span>
                      )}
                    </div>
                  </button>
                ))}

                {/* 搜索全部结果 */}
                <div className="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
                  <button
                    className="w-full px-4 py-2 text-left text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                    onClick={() => {
                      router.push(`/search?q=${encodeURIComponent(query)}`);
                      setIsOpen(false);
                    }}
                  >
                    <Search className="size-4" />
                    <span className="text-sm">在整个工作区中搜索 "{query}"</span>
                  </button>
                </div>
              </div>
            ) : query ? (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                <Search className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">未找到匹配结果</p>
                <p className="text-xs mt-1">尝试使用不同的关键词</p>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};
