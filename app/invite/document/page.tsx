"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { trpc } from "@/trpc/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DocumentInvitePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();

  const documentId = searchParams.get("documentId") ?? "";

  const acceptMutation = trpc.documents.acceptDocumentInvite.useMutation({
    onSuccess: (result) => {
      if (result?.documentId) {
        router.replace(`/documents/${result.documentId}`);
      } else {
        router.replace("/documents");
      }
    },
  });

  if (!documentId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>邀请链接无效</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              缺少文档信息，请向邀请方确认链接是否正确。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>加载中...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              正在检查邀请链接状态，请稍候。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>加入文档协作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              你收到一个文档协作邀请，请先登录账户，登录后会自动完成加入并跳转到文档页面。
            </p>
            <SignInButton mode="modal">
              <Button className="w-full">登录并接受邀请</Button>
            </SignInButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>加入文档协作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            你收到一个文档协作邀请，是否将该文档添加到你的文档列表中？
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              disabled={acceptMutation.isPending}
              onClick={() => {
                router.replace("/documents");
              }}
            >
              暂不加入
            </Button>
            <Button
              disabled={acceptMutation.isPending}
              onClick={() => {
                if (!documentId) return;
                acceptMutation.mutate({
                  documentId,
                });
              }}
            >
              {acceptMutation.isPending ? (
                "正在加入..."
              ) : (
                "接受并加入"
              )}
            </Button>
          </div>
          {acceptMutation.error && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {acceptMutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentInvitePage;
