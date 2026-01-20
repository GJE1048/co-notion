
"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { 
    MicIcon, 
    StopCircleIcon, 
    SparklesIcon, 
    AlignLeftIcon, 
    FileEditIcon, 
    FileTypeIcon,
    MoreHorizontalIcon,
    PlayIcon,
    PauseIcon,
    type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Record } from "../page";

interface RecordDetailProps {
  record: Record;
  onUpdate: (updates: Partial<Record>) => void;
}

type Tab = "summary" | "notes" | "transcript";

export function RecordDetail({ record, onUpdate }: RecordDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [elapsed, setElapsed] = useState(record.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 录音计时器
  useEffect(() => {
    if (record.status === "recording") {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(record.duration);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [record.status, record.duration]);

  // 停止录音并开始处理
  const handleStopRecording = async () => {
    onUpdate({ status: "processing", duration: elapsed });
    
    try {
      // 1. 调用 AI 生成模拟转录 (在真实场景中这里应上传音频文件到 STT 服务)
      // 这里我们复用 AI 聊天接口来生成一段逼真的会议记录
      const transcribeRes = await fetch("/api/chat/robot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            messages: [{ 
                role: "user", 
                content: "请生成一段模拟的会议录音转录文本，模拟 2-3 个人的对话，讨论关于软件开发、产品设计或项目管理的话题。内容要自然、口语化，包含一些语气词。字数在 300 字左右。直接输出内容，不要带任何前缀或后缀。" 
            }],
            mode: "chat"
        })
      });

      if (!transcribeRes.ok) throw new Error("Transcription generation failed");
      
      const transcribeData = await transcribeRes.json();
      const transcript = transcribeData.reply;
      
      onUpdate({ 
          transcript: transcript
      });

      // 2. 调用 AI 总结
      await generateSummary(transcript);

    } catch (error) {
      console.error("Processing failed:", error);
      onUpdate({
        status: "completed",
        summary: "处理过程中发生错误，请重试。",
        notes: "无法生成笔记。"
      });
    }
  };

  const generateSummary = async (text: string) => {
    try {
      // 调用真实的 AI 接口
      const response = await fetch("/api/chat/robot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            messages: [{ role: "user", content: text }],
            action: "summarize",
            mode: "edit"
        })
      });

      if (!response.ok) throw new Error("API call failed");
      
      const data = await response.json();
      
      onUpdate({
        status: "completed",
        summary: data.reply || "无法生成摘要",
        notes: "基于录音内容的智能笔记:\n" + (data.reply || "暂无笔记")
      });
      
    } catch (error) {
       console.error("Summary generation failed:", error);
       onUpdate({
        status: "completed",
        summary: "生成摘要失败，请检查 API 配置。",
        notes: "生成笔记失败。"
    });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b flex-shrink-0">
        <div className="flex items-start justify-between mb-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-1">
                    {record.title}
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="font-normal text-xs">
                        AI 速记
                    </Badge>
                    <span>•</span>
                    <span>{format(record.date, "yyyy年MM月dd日 HH:mm")}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                {record.status === "recording" ? (
                    <Button variant="destructive" onClick={handleStopRecording} className="animate-pulse">
                        <StopCircleIcon className="w-4 h-4 mr-2" />
                        停止录音 ({Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')})
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" disabled={record.status === "processing"}>
                         {record.status === "processing" ? "处理中..." : "继续录音"}
                    </Button>
                )}
                <Button variant="ghost" size="icon">
                    <MoreHorizontalIcon className="w-4 h-4" />
                </Button>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit">
            <TabButton 
                active={activeTab === "summary"} 
                onClick={() => setActiveTab("summary")}
                icon={SparklesIcon}
                label="摘要"
            />
            <TabButton 
                active={activeTab === "notes"} 
                onClick={() => setActiveTab("notes")}
                icon={FileEditIcon}
                label="笔记"
            />
            <TabButton 
                active={activeTab === "transcript"} 
                onClick={() => setActiveTab("transcript")}
                icon={AlignLeftIcon}
                label="转录"
            />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/50">
        {record.status === "processing" ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                    <SparklesIcon className="w-12 h-12 text-primary relative z-10 animate-bounce" />
                </div>
                <p>AI 正在智能分析录音内容...</p>
            </div>
        ) : (
            <div className="max-w-3xl mx-auto">
                {activeTab === "summary" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-card border rounded-xl p-6 shadow-sm">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4 text-primary" />
                                智能摘要
                            </h3>
                            <div className="prose prose-sm dark:prose-invert text-muted-foreground leading-relaxed whitespace-pre-line">
                                {record.summary || "暂无摘要"}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "notes" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-card border rounded-xl p-6 shadow-sm">
                             <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <FileEditIcon className="w-4 h-4 text-primary" />
                                重点笔记
                            </h3>
                             <div className="prose prose-sm dark:prose-invert text-muted-foreground leading-relaxed whitespace-pre-line">
                                {record.notes || "暂无笔记"}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "transcript" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-card border rounded-xl p-6 shadow-sm">
                             <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <AlignLeftIcon className="w-4 h-4 text-primary" />
                                全文转写
                            </h3>
                            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {record.transcript || "暂无转录内容"}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
      
      {/* Player Bar (Mock) */}
      {record.status !== "recording" && record.status !== "processing" && (
          <div className="border-t p-4 bg-background flex items-center gap-4">
            <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                onClick={() => setIsPlaying(!isPlaying)}
            >
                {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
            </Button>
            <div className="flex-1">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-1/3 rounded-full" />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>00:24</span>
                    <span>{Math.floor(record.duration / 60)}:{(record.duration % 60).toString().padStart(2, '0')}</span>
                </div>
            </div>
          </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                active 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    )
}
