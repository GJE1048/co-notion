"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { trpc } from "@/trpc/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const WorkspaceInvitePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();

  const workspaceId = searchParams.get("workspaceId") ?? "";
  const roleParam = searchParams.get("role") ?? "editor";
  const role =
    roleParam === "admin" || roleParam === "viewer" ? roleParam : "editor";

  const acceptMutation = trpc.workspaces.acceptWorkspaceInvite.useMutation({
    onSuccess: () => {
      router.replace("/documents");
    },
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!workspaceId) return;
    if (!isSignedIn) return;
    if (acceptMutation.isPending || acceptMutation.isSuccess) return;
    acceptMutation.mutate({
      workspaceId,
      role,
    });
  }, [
    isLoaded,
    isSignedIn,
    workspaceId,
    role,
    acceptMutation,
  ]);

  if (!workspaceId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>邀请链接无效</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              缺少工作区信息，请向邀请方确认链接是否正确。
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
    const redirectUrl = `/invite/workspace?workspaceId=${encodeURIComponent(
      workspaceId,
    )}&role=${encodeURIComponent(role)}`;

    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>加入工作区</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              你收到一个加入工作区的邀请，请先登录账户，登录后会自动完成加入并跳转到文档页面。
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
          <CardTitle>正在加入工作区...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            正在接受邀请并跳转到文档页面，请稍候。
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkspaceInvitePage;
