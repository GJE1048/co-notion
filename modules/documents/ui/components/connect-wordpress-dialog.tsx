"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/trpc/client";
import { Loader2 } from "lucide-react";

interface ConnectWordpressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ConnectWordpressDialog({
  open,
  onOpenChange,
  onSuccess,
}: ConnectWordpressDialogProps) {
  const [siteUrl, setSiteUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const bindMutation = trpc.documents.bindWordpressSite.useMutation({
    onSuccess: (data) => {
      if (data.ok) {
        onOpenChange(false);
        utils.documents.getWordpressSites.invalidate();
        if (onSuccess) onSuccess();
        // Reset form
        setSiteUrl("");
        setDisplayName("");
        setUsername("");
        setApplicationPassword("");
        setError(null);
      } else {
        setError(data.errorMessage || "连接失败");
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const [activeTab, setActiveTab] = useState<"oauth" | "manual">("oauth");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteUrl || !displayName || !username || !applicationPassword) {
      setError("请填写所有必填字段");
      return;
    }

    bindMutation.mutate({
      siteUrl,
      displayName,
      authType: "application_password",
      username,
      applicationPassword,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>连接 WordPress 站点</DialogTitle>
          <DialogDescription>
            选择一种方式连接您的 WordPress 站点。
          </DialogDescription>
        </DialogHeader>

        <div className="flex border-b mb-4">
            <button
                className={`flex-1 pb-2 text-sm font-medium border-b-2 ${activeTab === 'oauth' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('oauth')}
            >
                WordPress.com / Jetpack
            </button>
            <button
                className={`flex-1 pb-2 text-sm font-medium border-b-2 ${activeTab === 'manual' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('manual')}
            >
                自托管站点 (手动)
            </button>
        </div>

        {activeTab === 'oauth' ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <p className="text-sm text-center text-muted-foreground px-4">
                    如果您使用 WordPress.com 或者安装了 Jetpack 插件的自托管站点，推荐使用此方式。
                </p>
                <Button onClick={() => window.location.href = "/api/auth/wordpress/login"} className="w-full max-w-xs">
                    <span className="mr-2">W</span> 连接 WordPress.com
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                    您将被重定向到 WordPress.com 进行授权。
                </p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">显示名称</label>
                <Input
                  id="displayName"
                  placeholder="例如：我的个人博客"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={bindMutation.isPending}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="siteUrl" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">站点地址</label>
                <Input
                  id="siteUrl"
                  placeholder="https://example.com"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  disabled={bindMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">用户名</label>
                <Input
                  id="username"
                  placeholder="WordPress 用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={bindMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="appPassword" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">应用程序密码</label>
                <Input
                  id="appPassword"
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={applicationPassword}
                  onChange={(e) => setApplicationPassword(e.target.value)}
                  disabled={bindMutation.isPending}
                />
                <p className="text-xs text-slate-500">
                  请在 WordPress 后台 &quot;用户&quot; -&gt; &quot;个人资料&quot; 中生成应用程序密码。
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-500">
                  {error}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={bindMutation.isPending}>
                  取消
                </Button>
                <Button type="submit" disabled={bindMutation.isPending}>
                  {bindMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  连接
                </Button>
              </DialogFooter>
            </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
