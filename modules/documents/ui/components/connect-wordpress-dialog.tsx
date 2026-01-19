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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>连接 WordPress 站点</DialogTitle>
          <DialogDescription>
            输入您的 WordPress 站点信息和应用程序密码以进行连接。
            建议使用应用程序密码而不是登录密码。
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
