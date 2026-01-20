
import { MicIcon } from "lucide-react";

export default function AIShorthandPage() {
  return (
    <div className="flex flex-col min-h-screen p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <MicIcon className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">AI 语音速记</h1>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">实时录音</h2>
          <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg bg-muted/50">
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              <MicIcon className="w-4 h-4" />
              开始录音
            </button>
            <p className="text-sm text-muted-foreground mt-2">点击按钮开始记录会议或语音笔记</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">历史记录</h2>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground text-center py-8">
              暂无录音记录
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
