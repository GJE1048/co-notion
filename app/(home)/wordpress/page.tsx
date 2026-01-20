"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PlusIcon, TrashIcon, ExternalLinkIcon, SettingsIcon } from "lucide-react";
import { ConnectWordpressDialog } from "@/modules/documents/ui/components/connect-wordpress-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WordpressSite {
    id: string;
    siteUrl: string;
    displayName: string;
    authType: string;
    username: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export default function WordpressManagementPage() {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const utils = trpc.useUtils();
  
  const sitesQuery = trpc.documents.getWordpressSites.useQuery();
  const disconnectMutation = trpc.documents.disconnectWordpressSite.useMutation({
    onSuccess: () => {
      // toast.success("站点已断开连接");
      utils.documents.getWordpressSites.invalidate();
    },
    onError: (err) => {
      alert(`断开连接失败: ${err.message}`);
    }
  });

  const handleDisconnect = (siteId: string) => {
    if (confirm("确定要断开与该站点的连接吗？已发布的文章不会被删除。")) {
      disconnectMutation.mutate({ siteId });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WordPress 站点管理</h1>
          <p className="text-muted-foreground mt-2">
            管理您连接的 WordPress 站点，查看发布记录。
          </p>
        </div>
        <Button onClick={() => setConnectDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          添加站点
        </Button>
      </div>

      {sitesQuery.isLoading ? (
        <div>加载中...</div>
      ) : sitesQuery.data?.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] border rounded-lg bg-muted/10">
          <p className="text-muted-foreground mb-4">暂无连接的站点</p>
          <Button onClick={() => setConnectDialogOpen(true)}>
            连接您的第一个 WordPress 站点
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sitesQuery.data?.map((site) => (
            <SiteCard key={site.id} site={site as WordpressSite} onDisconnect={handleDisconnect} />
          ))}
        </div>
      )}

      <ConnectWordpressDialog 
        open={connectDialogOpen} 
        onOpenChange={setConnectDialogOpen}
        onSuccess={() => utils.documents.getWordpressSites.invalidate()}
      />
    </div>
  );
}

function SiteCard({ site, onDisconnect }: { site: WordpressSite, onDisconnect: (id: string) => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {site.displayName}
        </CardTitle>
        {site.authType === 'oauth' ? (
           <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">OAuth</span>
        ) : (
           <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">Basic</span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold truncate mb-1" title={site.siteUrl}>{site.siteUrl}</div>
        <p className="text-xs text-muted-foreground">
          用户: {site.username || 'N/A'}
        </p>
        <p className="text-xs text-muted-foreground">
          连接时间: {new Date(site.createdAt).toLocaleDateString()}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>
          <SettingsIcon className="mr-2 h-4 w-4" />
          详情 & 记录
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDisconnect(site.id)}>
          <TrashIcon className="h-4 w-4" />
        </Button>
        
        <SiteDetailsDialog 
            site={site} 
            open={detailsOpen} 
            onOpenChange={setDetailsOpen} 
        />
      </CardFooter>
    </Card>
  );
}

function SiteDetailsDialog({ site, open, onOpenChange }: { site: WordpressSite, open: boolean, onOpenChange: (open: boolean) => void }) {
    const postsQuery = trpc.documents.getSitePublishedPosts.useQuery(
        { siteId: site.id },
        { enabled: open }
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>站点详情: {site.displayName}</DialogTitle>
                    <DialogDescription>
                        {site.siteUrl}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4">发布历史</h3>
                    {postsQuery.isLoading ? (
                        <div>加载中...</div>
                    ) : postsQuery.data?.length === 0 ? (
                        <p className="text-muted-foreground">暂无发布记录</p>
                    ) : (
                        <div className="border rounded-md">
                             <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="p-3">文档标题</th>
                                        <th className="p-3">发布时间</th>
                                        <th className="p-3">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {postsQuery.data?.map((post) => (
                                        <tr key={post.id} className="border-t">
                                            <td className="p-3 font-medium">{post.title}</td>
                                            <td className="p-3 text-muted-foreground">
                                                {post.publishedInfo?.lastPublishedAt ? new Date(post.publishedInfo.lastPublishedAt).toLocaleString() : "-"}
                                            </td>
                                            <td className="p-3">
                                                {post.publishedInfo?.link && (
                                                    <a href={post.publishedInfo.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                                                        查看文章 <ExternalLinkIcon className="ml-1 h-3 w-3" />
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
