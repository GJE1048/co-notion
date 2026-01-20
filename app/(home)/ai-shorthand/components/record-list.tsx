
"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { MicIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import type { Record } from "../page";

interface RecordListProps {
  records: Record[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function RecordList({ records, selectedId, onSelect }: RecordListProps) {
  return (
    <div className="space-y-1">
      {records.map((record) => (
        <button
          key={record.id}
          onClick={() => onSelect(record.id)}
          className={cn(
            "w-full text-left px-3 py-3 rounded-md transition-colors flex flex-col gap-1 group",
            selectedId === record.id
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className={cn(
                "font-medium truncate text-sm",
                selectedId === record.id ? "text-foreground" : "text-foreground/80"
            )}>
              {record.title}
            </span>
            {record.status === "recording" && (
                <div className="flex items-center gap-1 text-red-500 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-current" />
                </div>
            )}
            {record.status === "processing" && (
                <Loader2Icon className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground/70">
            <div className="flex items-center gap-2">
                <MicIcon className="w-3 h-3" />
                <span>{format(record.date, "HH:mm")}</span>
            </div>
            <span>
                {Math.floor(record.duration / 60)}:{(record.duration % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
