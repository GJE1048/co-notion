"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Users,
  Zap,
  BookOpen,
  BarChart3
} from "lucide-react";

const quickActions = [
  {
    title: "新建文档",
    description: "创建空白文档开始写作",
    icon: FileText,
    action: "new-document",
    color: "bg-blue-500 hover:bg-blue-600",
    href: "/documents/new",
  },
  {
    title: "邀请协作者",
    description: "与团队成员开始协作",
    icon: Users,
    action: "invite-collaborators",
    color: "bg-green-500 hover:bg-green-600",
    href: "/documents",
  },
  {
    title: "AI写作助手",
    description: "使用AI提升写作效率",
    icon: Zap,
    action: "ai-assistant",
    color: "bg-purple-500 hover:bg-purple-600",
    href: "/documents",
  },
  {
    title: "浏览模板",
    description: "选择专业模板快速开始",
    icon: BookOpen,
    action: "browse-templates",
    color: "bg-orange-500 hover:bg-orange-600",
    href: "/templates",
  },
  {
    title: "数据分析",
    description: "查看工作统计和报告",
    icon: BarChart3,
    action: "analytics",
    color: "bg-indigo-500 hover:bg-indigo-600",
    href: "/documents",
  },
];

export const QuickActions = () => {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const handleAction = (action: string, href?: string) => {
    // 如果认证状态还未加载，等待
    if (!isLoaded) {
      return;
    }

    // 如果用户未登录，跳转到登录页面
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    // 用户已登录，执行正常操作
    if (href) {
      router.push(href);
    } else {
      console.log("执行操作:", action);
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          快速开始
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {quickActions.map((action) => (
            <Button
              key={action.action}
              variant="ghost"
              className="h-auto p-4 flex flex-col items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 group"
              onClick={() => handleAction(action.action, action.href)}
            >
              <div className={`p-3 rounded-full text-white ${action.color} group-hover:scale-110 transition-transform duration-200`}>
                <action.icon size={20} />
              </div>
              <div className="text-center">
                <div className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                  {action.title}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {action.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
