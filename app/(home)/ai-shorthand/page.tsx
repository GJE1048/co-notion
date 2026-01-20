
"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { MicIcon, PlusIcon, ClockIcon, FileTextIcon, MoreHorizontalIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RecordDetail } from "./components/record-detail";
import { RecordList } from "./components/record-list";

export type Record = {
  id: string;
  title: string;
  date: Date;
  duration: number; // seconds
  status: "recording" | "processing" | "completed";
  transcript?: string;
  summary?: string;
  notes?: string;
};

export default function AIShorthandPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRecords = async () => {
    try {
      const res = await fetch("/api/ai-shorthand");
      if (!res.ok) throw new Error("Failed to fetch records");
      const data = await res.json();
      const formattedRecords = (data.records as unknown as Record[]).map((r) => ({
        ...r,
        date: new Date(r.date),
      }));
      setRecords(formattedRecords);
      if (formattedRecords.length > 0 && !selectedRecordId) {
        setSelectedRecordId(formattedRecords[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch records:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleCreateRecord = async () => {
    try {
      const title = `新录音 @${format(new Date(), "HH:mm")}`;
      const res = await fetch("/api/ai-shorthand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date: new Date(),
        }),
      });

      if (!res.ok) throw new Error("Failed to create record");
      
      const data = await res.json();
      const newRecord = { ...data.record, date: new Date(data.record.date) };
      
      setRecords([newRecord, ...records]);
      setSelectedRecordId(newRecord.id);
    } catch (error) {
      console.error("Failed to create record:", error);
    }
  };

  const handleUpdateRecord = async (id: string, updates: Partial<Record>) => {
    // Optimistic update
    setRecords((prev) =>
      prev.map((record) => (record.id === id ? { ...record, ...updates } : record))
    );

    try {
      const res = await fetch(`/api/ai-shorthand/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error("Failed to update record");
    } catch (error) {
      console.error("Failed to update record:", error);
      // TODO: Revert optimistic update if needed
    }
  };

  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Left Sidebar: List */}
      <div className="w-80 border-r flex flex-col bg-muted/10">
        <div className="p-4 flex items-center justify-between border-b bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground">
            <FileTextIcon className="w-4 h-4" />
            AI 速记
          </div>
          <div className="flex gap-2">
             <Button size="sm" variant="default" className="h-7 px-2" onClick={handleCreateRecord}>
                <PlusIcon className="w-4 h-4 mr-1" />
                新建
             </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
            <div className="text-xs font-medium text-muted-foreground mb-2 px-2 mt-2">列表</div>
            {loading ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2Icon className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <RecordList 
                    records={records} 
                    selectedId={selectedRecordId} 
                    onSelect={setSelectedRecordId} 
                />
            )}
        </div>
      </div>

      {/* Main Content: Detail */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {selectedRecord ? (
          <RecordDetail 
            record={selectedRecord} 
            onUpdate={(updates) => handleUpdateRecord(selectedRecord.id, updates)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MicIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>选择或创建一个录音以开始</p>
          </div>
        )}
      </div>
    </div>
  );
}
