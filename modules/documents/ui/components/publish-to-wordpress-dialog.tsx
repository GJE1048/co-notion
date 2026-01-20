"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/trpc/client";
import { Loader2, Plus } from "lucide-react";
import { ConnectWordpressDialog } from "./connect-wordpress-dialog";

interface PublishToWordpressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle: string;
}

export function PublishToWordpressDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
}: PublishToWordpressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>发布到 WordPress</DialogTitle>
          <DialogDescription>
            将当前文档发布到连接的 WordPress 站点。
          </DialogDescription>
        </DialogHeader>
        <PublishForm 
          documentId={documentId} 
          documentTitle={documentTitle} 
        />
      </DialogContent>
    </Dialog>
  );
}

function PublishForm({ documentId, documentTitle }: { documentId: string, documentTitle: string }) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [title, setTitle] = useState(documentTitle);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"draft" | "publish">("draft");
  const [postType, setPostType] = useState<"post" | "page">("post");
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: sites, isLoading: isLoadingSites } = trpc.documents.getWordpressSites.useQuery();
  
  // Use derived state for site ID to avoid useEffect
  const activeSiteId = selectedSiteId || (sites && sites.length > 0 ? sites[0].id : "");

  const { data: taxonomies, isLoading: isLoadingTaxonomies } = trpc.documents.getWordpressTaxonomies.useQuery(
    { siteId: activeSiteId },
    { enabled: !!activeSiteId }
  );

  const publishMutation = trpc.documents.publishToWordpress.useMutation({
    onSuccess: (data) => {
      if (data.status === "success") {
        setPublishResult(`发布成功！链接：${data.remoteUrl}`);
      } else {
        setPublishResult(`发布失败：${data.errorMessage}`);
      }
    },
    onError: (error) => {
      setPublishResult(`发布出错：${error.message}`);
    },
  });

  const handlePublish = () => {
    if (!activeSiteId) return;

    publishMutation.mutate({
      documentId,
      target: {
        type: "wordpress",
        siteId: activeSiteId,
      },
      options: {
        status,
        type: postType,
        slug: slug || undefined,
        categories: postType === 'post' ? selectedCategories : undefined,
        tags: postType === 'post' ? selectedTags : undefined,
        title: title !== documentTitle ? title : undefined,
      },
    });
  };

  return (
    <div className="grid gap-4 py-4">
      {isLoadingSites && (
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoadingSites && sites && sites.length > 0 && (
        <>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="site" className="text-right text-sm font-medium">
              站点
            </label>
            <div className="col-span-3 flex gap-2">
              <select
                id="site"
                value={activeSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.displayName} ({site.siteUrl})
                  </option>
                ))}
              </select>
              <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0"
                onClick={() => setIsConnectDialogOpen(true)}
                title="连接新站点"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="title" className="text-right text-sm font-medium">
              标题
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="slug" className="text-right text-sm font-medium">
              别名 (Slug)
            </label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="可选"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="status" className="text-right text-sm font-medium">
              状态
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "publish")}
              className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="draft">草稿</option>
              <option value="publish">发布</option>
            </select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">
              类型
            </label>
            <div className="col-span-3 flex gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="postType"
                  value="post"
                  checked={postType === "post"}
                  onChange={(e) => setPostType(e.target.value as "post" | "page")}
                  className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">文章 (Post)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="postType"
                  value="page"
                  checked={postType === "page"}
                  onChange={(e) => setPostType(e.target.value as "post" | "page")}
                  className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">页面 (Page)</span>
              </label>
            </div>
          </div>
          
          {postType === 'post' && (
            <>
              <div className="grid grid-cols-4 items-start gap-4">
            <label className="text-right text-sm font-medium pt-2">
              分类
            </label>
            <div className="col-span-3">
              {isLoadingTaxonomies ? (
                <div className="text-sm text-muted-foreground">加载分类中...</div>
              ) : taxonomies?.categories?.length ? (
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2">
                  {taxonomies.categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`cat-${cat.id}`}
                        checked={selectedCategories.includes(cat.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories(prev => [...prev, cat.id]);
                          } else {
                            setSelectedCategories(prev => prev.filter(id => id !== cat.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer select-none flex-1">
                        {cat.name}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">无可用分类</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <label className="text-right text-sm font-medium pt-2">
              标签
            </label>
            <div className="col-span-3">
              {isLoadingTaxonomies ? (
                <div className="text-sm text-muted-foreground">加载标签中...</div>
              ) : taxonomies?.tags?.length ? (
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2">
                  {taxonomies.tags.map(tag => (
                    <div key={tag.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`tag-${tag.id}`}
                        checked={selectedTags.includes(tag.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTags(prev => [...prev, tag.id]);
                          } else {
                            setSelectedTags(prev => prev.filter(id => id !== tag.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor={`tag-${tag.id}`} className="text-sm cursor-pointer select-none flex-1">
                        {tag.name}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">无可用标签</div>
              )}
            </div>
          </div>
            </>
          )}
        </>
      )}

      {!isLoadingSites && !sites?.length && (
        <div className="text-center py-8">
          <p className="text-slate-500 mb-4">您还没有连接 WordPress 站点</p>
          <Button onClick={() => setIsConnectDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            连接站点
          </Button>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {publishResult && (
            <div className={`mr-auto text-sm ${publishResult.includes("成功") ? "text-green-600" : "text-red-600"}`}>
              {publishResult}
            </div>
          )}
        <Button onClick={handlePublish} disabled={publishMutation.isPending || !activeSiteId}>
          {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          发布
        </Button>
      </div>

      <ConnectWordpressDialog 
        open={isConnectDialogOpen} 
        onOpenChange={setIsConnectDialogOpen}
        onSuccess={() => {
          // No need to invalidate manually as the dialog does it.
          // The query hook will automatically refetch if invalidated.
        }}
      />
    </div>
  );
}
